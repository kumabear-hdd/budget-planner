import * as Dialog from "@radix-ui/react-dialog";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TransactionList } from "@/components/finance/transaction-list";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { goalProgress, goalSaved } from "@/lib/finance/calc";
import { formatDateLong } from "@/lib/finance/period";
import { formatIdr, formatPercent, parseAmount } from "@/lib/finance/format";
import { useFinanceStore } from "@/lib/finance/store";
import type { SavingsGoal } from "@/lib/finance/types";
import { useUiStore } from "@/lib/finance/ui-store";
import { todayISO } from "@/lib/finance/period";

export const Route = createFileRoute("/tabungan")({
  component: SavingsPage,
  head: () => ({ meta: [{ title: "Tabungan · Budget Planner" }] }),
});

function SavingsPage() {
  const goals = useFinanceStore((state) => state.goals);
  const transactions = useFinanceStore((state) => state.transactions);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tujuan"
        title="Tabungan"
        description="Setoran diambil dari saldo yang sudah ada. Uang tidak dihitung dua kali sebagai pengeluaran atau pemasukan."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Target baru
          </Button>
        }
      />

      {goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <p className="font-display text-2xl text-ink">Belum ada target tabungan</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-pretty text-muted">
            Contoh: beli laptop senilai Rp5.000.000. Setiap setoran memperbarui progres tanpa mengurangi angka pengeluaran biasa.
          </p>
          <Button className="mt-4" onClick={() => setCreating(true)}>
            Buat target
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}

      <section>
        <h2 className="mb-3 font-display text-2xl text-ink">Riwayat setoran</h2>
        <TransactionList
          transactions={transactions
            .filter((transaction) => transaction.kind === "transfer")
            .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))}
          emptyTitle="Belum ada setoran"
          emptyBody="Catat setoran dari kartu target. Saldo tersedia berkurang, tetapi total pengeluaran tidak berubah."
        />
      </section>

      <GoalDialog open={creating} goal={null} onClose={() => setCreating(false)} />
    </div>
  );
}

function GoalCard({ goal }: { goal: SavingsGoal }) {
  const transactions = useFinanceStore((state) => state.transactions);
  const style = useFinanceStore((state) => state.currencyStyle);
  const openCreate = useUiStore((state) => state.openCreate);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saved = goalSaved(transactions, goal.id);
  const remaining = goal.targetAmount - saved;
  const progress = goalProgress(goal, saved);
  const overdue = goal.targetDate < todayISO() && saved < goal.targetAmount;

  return (
    <article className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-ink">{goal.name}</h2>
          <p className="mt-1 text-sm text-muted">Target {formatDateLong(goal.targetDate)}</p>
        </div>
        <p className="font-display text-3xl tabular-nums text-primary">{formatPercent(Math.min(progress, 999))}</p>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-primary-soft"
        role="progressbar"
        aria-valuenow={Math.round(Math.min(100, progress))}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progres ${goal.name}`}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted">Terkumpul</dt>
          <dd className="font-semibold tabular-nums">{formatIdr(saved, style)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Target</dt>
          <dd className="font-semibold tabular-nums">{formatIdr(goal.targetAmount, style)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{remaining > 0 ? "Sisa" : "Lebih dari target"}</dt>
          <dd className="font-semibold tabular-nums">{formatIdr(Math.abs(remaining), style)}</dd>
        </div>
      </dl>
      {overdue ? <p className="mt-3 text-sm text-expense">Tenggat sudah lewat dan target belum tercapai.</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => openCreate({ goalId: goal.id })}>Setor</Button>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Ubah target
        </Button>
        <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
          Hapus
        </Button>
      </div>
      <GoalDialog open={editing} goal={goal} onClose={() => setEditing(false)} />
      <Dialog.Root open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay fixed inset-0 bg-ink/40" />
          <Dialog.Content className="dialog-panel fixed inset-x-4 top-1/3 mx-auto max-w-md rounded-2xl border border-line bg-surface p-5 shadow-card focus:outline-none sm:inset-x-0">
            <Dialog.Title className="font-display text-2xl">Hapus target?</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-pretty text-muted">
              Setoran untuk {goal.name} juga dihapus. Uang itu kembali dihitung sebagai saldo tersedia, bukan sebagai pemasukan baru.
            </Dialog.Description>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Batal
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  useFinanceStore.getState().removeGoal(goal.id);
                  toast.success("Target dihapus");
                }}
              >
                Hapus target
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </article>
  );
}

function GoalDialog({ open, goal, onClose }: { open: boolean; goal: SavingsGoal | null; onClose: () => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 bg-ink/40" />
        <Dialog.Content className="dialog-panel fixed inset-x-4 top-16 mx-auto max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-card focus:outline-none sm:inset-x-0">
          <GoalForm goal={goal} onClose={onClose} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function GoalForm({ goal, onClose }: { goal: SavingsGoal | null; onClose: () => void }) {
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? String(goal.targetAmount) : "");
  const [date, setDate] = useState(goal?.targetDate ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const next: Record<string, string> = {};
        if (!name.trim()) next.name = "Nama target wajib diisi.";
        const amount = parseAmount(target);
        if (amount === null || amount <= 0) next.target = "Target harus lebih dari nol.";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) next.date = "Tanggal target wajib diisi.";
        setErrors(next);
        if (Object.keys(next).length || amount === null) return;
        const draft = { name, targetAmount: amount, targetDate: date };
        if (goal) useFinanceStore.getState().updateGoal(goal.id, draft);
        else useFinanceStore.getState().addGoal(draft);
        toast.success(goal ? "Target diperbarui" : "Target tersimpan");
        onClose();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <Dialog.Title className="font-display text-2xl">{goal ? "Ubah target" : "Target baru"}</Dialog.Title>
        <Dialog.Close className="flex size-11 items-center justify-center rounded-xl hover:bg-surface-2" aria-label="Tutup">
          <X className="size-5" />
        </Dialog.Close>
      </div>
      <Dialog.Description className="text-sm text-muted">
        Target hanya menandai tujuan. Uang baru berpindah saat Anda mencatat setoran.
      </Dialog.Description>
      <Field label="Nama target" htmlFor="savings-name" error={errors.name}>
        <TextInput id="savings-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Beli laptop" />
      </Field>
      <Field label="Nominal target" htmlFor="savings-target" error={errors.target}>
        <TextInput id="savings-target" inputMode="numeric" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="5000000" />
      </Field>
      <Field label="Tanggal target" htmlFor="savings-date" error={errors.date}>
        <TextInput id="savings-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Batal
        </Button>
        <Button type="submit">Simpan</Button>
      </div>
    </form>
  );
}
