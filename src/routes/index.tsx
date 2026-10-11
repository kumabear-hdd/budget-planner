import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PeriodPicker } from "@/components/finance/period-picker";
import { TransactionList } from "@/components/finance/transaction-list";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { availableBalance, expenseByCategory, flowTotals, goalProgress, goalSaved } from "@/lib/finance/calc";
import { formatIdr, formatPercent } from "@/lib/finance/format";
import { periodLabel } from "@/lib/finance/period";
import { useFinanceStore } from "@/lib/finance/store";
import { useUiStore } from "@/lib/finance/ui-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dasbor · Budget Planner" }] }),
});

function DashboardPage() {
  const openingBalance = useFinanceStore((state) => state.openingBalance);
  const transactions = useFinanceStore((state) => state.transactions);
  const categories = useFinanceStore((state) => state.categories);
  const goals = useFinanceStore((state) => state.goals);
  const style = useFinanceStore((state) => state.currencyStyle);
  const period = useUiStore((state) => state.period);
  const openCreate = useUiStore((state) => state.openCreate);

  const balance = availableBalance(openingBalance, transactions);
  const periodFlow = flowTotals(transactions, period);
  const allFlow = flowTotals(transactions);
  const breakdown = expenseByCategory(transactions, categories, period).rows.slice(0, 4);
  const goal = [...goals].sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0];
  const saved = goal ? goalSaved(transactions, goal.id) : 0;
  const progress = goal ? goalProgress(goal, saved) : 0;
  const recent = [...transactions]
    .filter((transaction) => {
      if (period.from && transaction.date < period.from) return false;
      if (period.to && transaction.date > period.to) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
  const isNew = transactions.length === 0 && openingBalance === 0 && goals.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ringkasan"
        title="Dasbor"
        description="Saldo dihitung dari saldo awal, seluruh pemasukan, pengeluaran, dan setoran tabungan."
        actions={
          <>
            <PeriodPicker />
            <Button onClick={() => openCreate()}>
              <Plus className="size-4" />
              Catat transaksi
            </Button>
          </>
        }
      />

      {isNew ? (
        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="border-l-4 border-l-primary p-5">
            <h2 className="font-display text-2xl text-ink">Mulai dari saldo yang Anda pegang sekarang</h2>
            <ol className="mt-3 space-y-2 text-sm text-muted">
              <li>1. Atur saldo awal di Pengaturan. Angka ini bukan pemasukan baru.</li>
              <li>2. Catat gaji, uang saku, atau pemasukan lain.</li>
              <li>3. Catat pengeluaran harian agar saldo dan kategori ikut berubah.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/pengaturan" className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">
                Atur saldo awal
              </Link>
              <Button variant="secondary" onClick={() => openCreate()}>
                Catat transaksi
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <p className="text-sm font-semibold text-muted">Saldo tersedia</p>
          <p
            data-testid="available-balance"
            className={cn("mt-2 font-display text-3xl tabular-nums tracking-tight", balance < 0 && "text-expense")}
          >
            {formatIdr(balance, style)}
          </p>
          <p className="mt-2 text-sm text-muted">Saldo awal + pemasukan − pengeluaran − tabungan. Semua waktu.</p>
        </article>
        <article className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <p className="text-sm font-semibold text-muted">Total pemasukan</p>
          <p data-testid="period-income" className="mt-2 font-display text-3xl tabular-nums tracking-tight text-primary">
            {formatIdr(periodFlow.income, style)}
          </p>
          <p className="mt-2 text-sm text-muted">{periodLabel(period)}</p>
        </article>
        <article className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <p className="text-sm font-semibold text-muted">Total pengeluaran</p>
          <p data-testid="period-expense" className="mt-2 font-display text-3xl tabular-nums tracking-tight text-expense">
            {formatIdr(periodFlow.expense, style)}
          </p>
          <p className="mt-2 text-sm text-muted">{periodLabel(period)}. Tidak termasuk setoran tabungan.</p>
        </article>
        <article className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <p className="text-sm font-semibold text-muted">Target tabungan</p>
          {goal ? (
            <>
              <p className="mt-2 truncate font-display text-2xl text-ink">{goal.name}</p>
              <p className="mt-1 text-sm tabular-nums text-muted">
                {formatIdr(saved, style)} dari {formatIdr(goal.targetAmount, style)}
              </p>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-primary-soft"
                role="progressbar"
                aria-valuenow={Math.round(Math.min(100, progress))}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progres ${goal.name}`}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, progress)}%` }} />
              </div>
              <p className="mt-2 text-sm font-semibold text-primary">{formatPercent(progress)}</p>
            </>
          ) : (
            <>
              <p className="mt-2 font-display text-2xl text-ink">Belum ada target</p>
              <Link to="/tabungan" className="mt-3 inline-flex text-sm font-semibold text-primary">
                Buat target tabungan
              </Link>
            </>
          )}
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-ink">Transaksi terbaru</h2>
            <Link to="/transaksi" className="text-sm font-semibold text-primary">
              Lihat semua
            </Link>
          </div>
          <TransactionList
            transactions={recent}
            emptyTitle="Belum ada transaksi"
            emptyBody="Catatan pada periode ini akan muncul di sini. Saldo awal tidak dihitung sebagai transaksi."
          />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="font-display text-2xl text-ink">Porsi pengeluaran</h2>
          <p className="mt-1 text-sm text-muted">{periodLabel(period)}</p>
          {breakdown.length === 0 ? (
            <p className="mt-6 text-sm text-muted">Belum ada pengeluaran pada periode ini.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {breakdown.map((row) => (
                <li key={row.categoryId}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-ink">{row.name}</span>
                    <span className="tabular-nums text-muted">{formatPercent(row.percent)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-expense" style={{ width: `${Math.min(100, row.percent)}%` }} />
                  </div>
                  <p className="mt-1 text-sm tabular-nums text-muted">{formatIdr(row.amount, style)}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
            Pemasukan tercatat {formatIdr(allFlow.income, style)}. Pengeluaran tercatat {formatIdr(allFlow.expense, style)}.
          </p>
        </div>
      </section>
    </div>
  );
}
