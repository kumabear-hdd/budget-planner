import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SpendingChart } from "@/components/finance/charts";
import { CategoryIcon } from "@/components/finance/icons";
import { PeriodPicker } from "@/components/finance/period-picker";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { controlClass, Field, TextInput } from "@/components/ui/field";
import { expenseByCategory, flowTotals } from "@/lib/finance/calc";
import { orderedCategories } from "@/lib/finance/defaults";
import { formatIdr } from "@/lib/finance/format";
import { inPeriod, periodLabel } from "@/lib/finance/period";
import { useFinanceStore } from "@/lib/finance/store";
import type { Category } from "@/lib/finance/types";
import { useUiStore } from "@/lib/finance/ui-store";

export const Route = createFileRoute("/kategori")({
  component: CategoriesPage,
  head: () => ({ meta: [{ title: "Kategori · Budget Planner" }] }),
});

function CategoriesPage() {
  const categories = useFinanceStore((state) => state.categories);
  const transactions = useFinanceStore((state) => state.transactions);
  const style = useFinanceStore((state) => state.currencyStyle);
  const period = useUiStore((state) => state.period);
  const breakdown = expenseByCategory(transactions, categories, period);
  const income = flowTotals(transactions, period).income;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Alokasi"
        title="Kategori"
        description="Pengeluaran dikelompokkan agar terlihat ke mana uang pergi. Setoran tabungan tidak masuk diagram ini."
        actions={<PeriodPicker />}
      />

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-ink">Rincian pengeluaran</h2>
            <p className="text-sm text-muted">{periodLabel(period)}</p>
          </div>
          <p className="font-display text-2xl tabular-nums text-expense">{formatIdr(breakdown.total, style)}</p>
        </div>
        <SpendingChart rows={breakdown.rows} />
        {breakdown.rows[0] ? (
          <p className="mt-4 text-sm text-muted">
            Porsi terbesar: <span className="font-semibold text-ink">{breakdown.rows[0].name}</span>.
          </p>
        ) : null}
      </section>

      <AddCategoryForm />

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryColumn
          title="Pengeluaran"
          categories={orderedCategories(categories, "expense")}
          amountFor={(category) =>
            transactions
              .filter(
                (transaction) =>
                  transaction.categoryId === category.id &&
                  transaction.kind === "expense" &&
                  inPeriod(transaction.date, period),
              )
              .reduce((sum, transaction) => sum + transaction.amount, 0)
          }
        />
        <CategoryColumn
          title="Pemasukan"
          totalHint={formatIdr(income, style)}
          categories={orderedCategories(categories, "income")}
          amountFor={(category) =>
            transactions
              .filter(
                (transaction) =>
                  transaction.categoryId === category.id &&
                  transaction.kind === "income" &&
                  inPeriod(transaction.date, period),
              )
              .reduce((sum, transaction) => sum + transaction.amount, 0)
          }
        />
      </div>
    </div>
  );
}

function AddCategoryForm() {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Category["kind"]>("expense");
  const [error, setError] = useState("");

  return (
    <form
      className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card sm:grid-cols-[1fr_12rem_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        const id = useFinanceStore.getState().addCategory(name, kind);
        if (!id) {
          setError("Nama kategori wajib diisi dan belum dipakai pada jenis yang sama.");
          return;
        }
        setName("");
        setError("");
        toast.success("Kategori ditambahkan");
      }}
    >
      <Field label="Kategori baru" htmlFor="category-name" error={error}>
        <TextInput id="category-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Hewan peliharaan" />
      </Field>
      <label className="text-sm font-semibold text-ink">
        Jenis
        <select className={`${controlClass} mt-1.5`} value={kind} onChange={(event) => setKind(event.target.value as Category["kind"])}>
          <option value="expense">Pengeluaran</option>
          <option value="income">Pemasukan</option>
        </select>
      </label>
      <Button type="submit">Tambah</Button>
    </form>
  );
}

function CategoryColumn({
  title,
  categories,
  amountFor,
  totalHint,
}: {
  title: string;
  categories: Category[];
  amountFor: (category: Category) => number;
  totalHint?: string;
}) {
  const style = useFinanceStore((state) => state.currencyStyle);
  const transactions = useFinanceStore((state) => state.transactions);

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl text-ink">{title}</h2>
        {totalHint ? <p className="text-sm tabular-nums text-muted">{totalHint}</p> : null}
      </div>
      <ul className="mt-4 divide-y divide-line">
        {categories.map((category) => {
          const amount = amountFor(category);
          const used = transactions.some((transaction) => transaction.categoryId === category.id);
          return (
            <li key={category.id} className="flex items-center gap-3 py-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink">
                <CategoryIcon id={category.id} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{category.name}</p>
                <p className="text-sm text-muted">
                  {category.systemRole === "savings"
                    ? "Khusus transfer internal, tidak masuk total pengeluaran"
                    : category.builtin
                      ? "Kategori bawaan"
                      : "Kategori Anda"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{formatIdr(amount, style)}</p>
                {!category.builtin ? (
                  <button
                    type="button"
                    className="mt-1 text-sm font-semibold text-expense disabled:opacity-40"
                    disabled={used}
                    onClick={() => {
                      const ok = useFinanceStore.getState().removeCategory(category.id);
                      if (ok) toast.success("Kategori dihapus");
                      else toast.error("Kategori masih dipakai transaksi");
                    }}
                  >
                    Hapus
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
