import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { controlClass, Field, TextInput } from "@/components/ui/field";
import { availableBalance } from "@/lib/finance/calc";
import { orderedCategories, SAVINGS_CATEGORY_ID } from "@/lib/finance/defaults";
import { formatIdr, parseAmount } from "@/lib/finance/format";
import { todayISO } from "@/lib/finance/period";
import { useFinanceStore } from "@/lib/finance/store";
import type { TransactionDraft, TxKind } from "@/lib/finance/types";
import { useUiStore } from "@/lib/finance/ui-store";
import { cn } from "@/lib/utils";

const KINDS: { id: TxKind; label: string }[] = [
  { id: "expense", label: "Pengeluaran" },
  { id: "income", label: "Pemasukan" },
  { id: "transfer", label: "Tabungan" },
];

type Errors = Partial<Record<"name" | "amount" | "categoryId" | "date" | "notes" | "goalId" | "goalName" | "goalTarget" | "goalDate", string>>;

export function TransactionDialog() {
  const open = useUiStore((state) => state.txOpen);
  const editingId = useUiStore((state) => state.editingId);
  const closeTx = useUiStore((state) => state.closeTx);
  const categories = useFinanceStore((state) => state.categories);
  const goals = useFinanceStore((state) => state.goals);
  const style = useFinanceStore((state) => state.currencyStyle);

  const [kind, setKind] = useState<TxKind>("expense");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("makanan");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [goalId, setGoalId] = useState("");
  const [newGoal, setNewGoal] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!open) return;
    const { transactions, goals: currentGoals } = useFinanceStore.getState();
    const presetGoalId = useUiStore.getState().presetGoalId;
    const editing = editingId ? transactions.find((transaction) => transaction.id === editingId) : undefined;
    if (editing) {
      setKind(editing.kind);
      setName(editing.name);
      setAmount(String(editing.amount));
      setCategoryId(editing.categoryId);
      setDate(editing.date);
      setNotes(editing.notes);
      setGoalId(editing.goalId ?? currentGoals[0]?.id ?? "");
      setNewGoal(false);
    } else {
      const nextKind: TxKind = presetGoalId ? "transfer" : "expense";
      setKind(nextKind);
      setName("");
      setAmount("");
      setCategoryId(nextKind === "transfer" ? SAVINGS_CATEGORY_ID : "makanan");
      setDate(todayISO());
      setNotes("");
      setGoalId(presetGoalId ?? currentGoals[0]?.id ?? "");
      setNewGoal(!presetGoalId && currentGoals.length === 0);
    }
    setGoalName("");
    setGoalTarget("");
    setGoalDate("");
    setErrors({});
  }, [open, editingId]);

  function changeKind(next: TxKind) {
    setKind(next);
    setErrors({});
    if (next === "transfer") {
      setCategoryId(SAVINGS_CATEGORY_ID);
      if (!goalId && goals.length === 0) setNewGoal(true);
      return;
    }
    const options = orderedCategories(categories, next).filter((category) => category.systemRole !== "savings");
    if (!options.some((category) => category.id === categoryId)) {
      setCategoryId(options[0]?.id ?? "");
    }
  }

  function save() {
    const nextErrors: Errors = {};
    const trimmed = name.trim();
    if (!trimmed) nextErrors.name = "Nama transaksi wajib diisi.";
    else if (trimmed.length > 140) nextErrors.name = "Nama terlalu panjang (maks. 140 karakter).";

    const parsed = parseAmount(amount);
    if (parsed === null) nextErrors.amount = "Masukkan jumlah yang valid.";
    else if (parsed <= 0) nextErrors.amount = "Jumlah harus lebih dari nol.";
    else if (parsed > 1_000_000_000_000) nextErrors.amount = "Jumlah terlalu besar.";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) nextErrors.date = "Tanggal tidak valid.";
    if (notes.trim().length > 500) nextErrors.notes = "Catatan terlalu panjang (maks. 500 karakter).";

    let resolvedGoalId: string | null = null;
    let resolvedCategory = categoryId;

    if (kind === "transfer") {
      resolvedCategory = SAVINGS_CATEGORY_ID;
      if (newGoal) {
        if (!goalName.trim()) nextErrors.goalName = "Nama target wajib diisi.";
        else if (goalName.trim().length > 80) nextErrors.goalName = "Nama target terlalu panjang.";
        const target = parseAmount(goalTarget);
        if (target === null || target <= 0) nextErrors.goalTarget = "Target harus lebih dari nol.";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(goalDate)) nextErrors.goalDate = "Tanggal target wajib diisi.";
      } else if (!goalId) {
        nextErrors.goalId = "Pilih target tabungan.";
      } else {
        resolvedGoalId = goalId;
      }
    } else {
      const match = categories.find(
        (category) => category.id === categoryId && category.kind === kind && category.systemRole !== "savings",
      );
      if (!match) nextErrors.categoryId = "Pilih kategori.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || parsed === null) return;

    if (kind === "transfer" && newGoal) {
      const target = parseAmount(goalTarget);
      if (target === null) return;
      resolvedGoalId = useFinanceStore.getState().addGoal({
        name: goalName,
        targetAmount: target,
        targetDate: goalDate,
      });
    }

    const draft: TransactionDraft = {
      kind,
      name: trimmed,
      amount: parsed,
      categoryId: resolvedCategory,
      date,
      notes: notes.trim(),
      goalId: resolvedGoalId,
    };

    if (editingId) {
      useFinanceStore.getState().updateTransaction(editingId, draft);
      toast.success("Transaksi diperbarui");
    } else {
      useFinanceStore.getState().addTransaction(draft);
      toast.success("Transaksi tersimpan");
    }
    closeTx();
  }

  const categoryOptions = orderedCategories(categories, kind === "income" ? "income" : "expense").filter(
    (category) => category.systemRole !== "savings",
  );
  const balance = availableBalance(
    useFinanceStore((state) => state.openingBalance),
    useFinanceStore((state) => state.transactions),
  );
  const parsedAmount = parseAmount(amount);
  const shortfall =
    kind === "transfer" && parsedAmount !== null && parsedAmount > 0 && parsedAmount > balance;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && closeTx()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 bg-ink/40" />
        <Dialog.Content className="dialog-panel fixed inset-x-4 top-4 mx-auto flex w-auto max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card focus:outline-none sm:inset-x-0">
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <div>
              <Dialog.Title className="font-display text-2xl text-ink">
                {editingId ? "Ubah transaksi" : "Catat transaksi"}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Pemasukan menambah saldo. Pengeluaran menguranginya. Tabungan hanya memindahkan uang yang sudah ada.
              </Dialog.Description>
            </div>
            <Dialog.Close className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2" aria-label="Tutup">
              <X className="size-5" />
            </Dialog.Close>
          </div>

          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div role="radiogroup" aria-label="Jenis transaksi" className="grid grid-cols-3 gap-2">
              {KINDS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={kind === option.id}
                  data-testid={`tx-kind-${option.id}`}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-semibold",
                    kind === option.id ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-muted",
                  )}
                  onClick={() => changeKind(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <Field label="Nama" htmlFor="tx-name" error={errors.name}>
              <TextInput
                id="tx-name"
                data-testid="tx-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={kind === "income" ? "Gaji Oktober" : kind === "transfer" ? "Setoran tabungan" : "Makan siang"}
                autoComplete="off"
              />
            </Field>

            <Field label="Jumlah (IDR)" htmlFor="tx-amount" error={errors.amount}>
              <TextInput
                id="tx-amount"
                data-testid="tx-amount"
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="25000"
              />
            </Field>

            {kind === "transfer" ? (
              <div className="space-y-4 rounded-2xl bg-surface-2 p-4">
                <p className="text-sm text-muted">Kategori terkunci ke Tabungan. Setoran tidak dihitung sebagai pengeluaran biasa.</p>
                <Field label="Target tabungan" htmlFor="tx-goal" error={errors.goalId}>
                  <select
                    id="tx-goal"
                    className={controlClass}
                    value={newGoal ? "__new__" : goalId}
                    onChange={(event) => {
                      if (event.target.value === "__new__") {
                        setNewGoal(true);
                        setGoalId("");
                      } else {
                        setNewGoal(false);
                        setGoalId(event.target.value);
                      }
                    }}
                  >
                    {goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name}
                      </option>
                    ))}
                    <option value="__new__">Target baru</option>
                  </select>
                </Field>
                {newGoal ? (
                  <>
                    <Field label="Nama target" htmlFor="goal-name" error={errors.goalName}>
                      <TextInput id="goal-name" value={goalName} onChange={(event) => setGoalName(event.target.value)} placeholder="Beli laptop" />
                    </Field>
                    <Field label="Nominal target" htmlFor="goal-target" error={errors.goalTarget}>
                      <TextInput id="goal-target" inputMode="numeric" value={goalTarget} onChange={(event) => setGoalTarget(event.target.value)} placeholder="5000000" />
                    </Field>
                    <Field label="Tanggal target" htmlFor="goal-date" error={errors.goalDate}>
                      <TextInput id="goal-date" type="date" value={goalDate} onChange={(event) => setGoalDate(event.target.value)} />
                    </Field>
                  </>
                ) : null}
                {shortfall ? (
                  <p className="text-sm text-expense">
                    Jumlah ini lebih besar dari saldo tersedia ({formatIdr(balance, style)}). Transaksi tetap bisa disimpan.
                  </p>
                ) : null}
              </div>
            ) : (
              <Field label="Kategori" htmlFor="tx-category" error={errors.categoryId}>
                <select
                  id="tx-category"
                  data-testid="tx-category"
                  className={controlClass}
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Tanggal" htmlFor="tx-date" error={errors.date}>
              <TextInput id="tx-date" data-testid="tx-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>

            <Field label="Catatan (opsional)" htmlFor="tx-notes" error={errors.notes}>
              <textarea
                id="tx-notes"
                className={`${controlClass} h-24 py-2`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Detail tambahan"
              />
            </Field>

            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeTx}>
                Batal
              </Button>
              <Button type="submit" data-testid="tx-save">
                Simpan
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function DeleteTransactionDialog() {
  const deleteId = useUiStore((state) => state.deleteId);
  const cancelDelete = useUiStore((state) => state.cancelDelete);
  const transaction = useFinanceStore((state) => state.transactions.find((item) => item.id === deleteId));

  return (
    <Dialog.Root open={Boolean(deleteId)} onOpenChange={(next) => !next && cancelDelete()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 bg-ink/40" />
        <Dialog.Content className="dialog-panel fixed inset-x-4 top-1/3 mx-auto max-w-md rounded-2xl border border-line bg-surface p-5 shadow-card focus:outline-none sm:inset-x-0">
          <Dialog.Title className="font-display text-2xl text-ink">Hapus transaksi?</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-pretty text-muted">
            {transaction
              ? `"${transaction.name}" akan dihapus dan saldo dihitung ulang.`
              : "Transaksi ini akan dihapus dan saldo dihitung ulang."}
          </Dialog.Description>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={cancelDelete}>
              Batal
            </Button>
            <Button
              variant="danger"
              data-testid="confirm-delete"
              onClick={() => {
                if (!deleteId) return;
                useFinanceStore.getState().removeTransaction(deleteId);
                cancelDelete();
                toast.success("Transaksi dihapus");
              }}
            >
              Hapus
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
