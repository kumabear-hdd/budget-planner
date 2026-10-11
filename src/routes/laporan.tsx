import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CashflowChart, SpendingChart } from "@/components/finance/charts";
import { PeriodPicker } from "@/components/finance/period-picker";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import {
  cashflowSeries,
  compareLabel,
  expenseByCategory,
  flowTotals,
  spendingSummary,
} from "@/lib/finance/calc";
import { formatIdr } from "@/lib/finance/format";
import {
  autoGranularity,
  formatDateID,
  inPeriod,
  periodLabel,
  previousPeriod,
  type Granularity,
} from "@/lib/finance/period";
import { useFinanceStore } from "@/lib/finance/store";
import { useUiStore } from "@/lib/finance/ui-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/laporan")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Laporan · Budget Planner" }] }),
});

const GRAINS: { id: Granularity; label: string }[] = [
  { id: "day", label: "Harian" },
  { id: "week", label: "Mingguan" },
  { id: "month", label: "Bulanan" },
];

function ReportsPage() {
  const transactions = useFinanceStore((state) => state.transactions);
  const categories = useFinanceStore((state) => state.categories);
  const style = useFinanceStore((state) => state.currencyStyle);
  const period = useUiStore((state) => state.period);
  const [grain, setGrain] = useState<Granularity | "auto">("auto");
  const granularity = grain === "auto" ? autoGranularity(period) : grain;
  const current = flowTotals(transactions, period);
  const previousWindow = previousPeriod(period);
  const previous = previousWindow ? flowTotals(transactions, previousWindow) : null;
  const series = cashflowSeries(transactions, period, granularity);
  const summary = spendingSummary(transactions, period);
  const breakdown = expenseByCategory(transactions, categories, period);

  const exportPdf = async () => {
    const rows = transactions
      .filter((transaction) => inPeriod(transaction.date, period))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    if (rows.length === 0) {
      toast.error("Tidak ada transaksi pada periode ini.");
      return;
    }
    // Lazy-loaded so jsPDF stays out of the first-paint bundle.
    const { exportTransactionsPdf } = await import("@/lib/finance/pdf");
    const range =
      period.from && period.to ? `-${period.from}-${period.to}` : "";
    exportTransactionsPdf({
      transactions: rows,
      categories,
      currencyStyle: style,
      periodText: periodLabel(period),
      subtitle: "Laporan ini memuat seluruh transaksi pada periode terpilih.",
      filename: `budget-planner-laporan${range}.pdf`,
    });
    toast.success("PDF laporan diunduh");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Laporan"
        title="Arus kas"
        description="Semua angka dihitung dari transaksi yang tercatat. Setoran tabungan tidak masuk pengeluaran."
        actions={
          <>
            <PeriodPicker />
            <Button
              variant="secondary"
              data-testid="download-pdf"
              onClick={() => {
                void exportPdf();
              }}
            >
              <Download className="size-4" />
              Unduh PDF
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <ReportStat label="Pemasukan" value={formatIdr(current.income, style)} tone="income" hint={compareLabel(current.income, previous ? previous.income : null)} />
        <ReportStat label="Pengeluaran" value={formatIdr(current.expense, style)} tone="expense" hint={compareLabel(current.expense, previous ? previous.expense : null)} />
        <ReportStat label="Arus kas bersih" value={formatIdr(current.net, style)} tone={current.net < 0 ? "expense" : "income"} hint={compareLabel(current.net, previous ? previous.net : null)} />
      </section>

      {previousWindow ? (
        <p className="text-sm text-muted">
          Dibandingkan dengan {periodLabel(previousWindow)}. Periode ini: {periodLabel(period)}.
        </p>
      ) : (
        <p className="text-sm text-muted">Semua waktu tidak punya periode pembanding.</p>
      )}

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-2xl text-ink">Pemasukan dan pengeluaran</h2>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Ringkasan waktu">
            <GrainButton active={grain === "auto"} onClick={() => setGrain("auto")}>
              Otomatis
            </GrainButton>
            {GRAINS.map((item) => (
              <GrainButton key={item.id} active={grain === item.id} onClick={() => setGrain(item.id)}>
                {item.label}
              </GrainButton>
            ))}
          </div>
        </div>
        <CashflowChart points={series} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 font-semibold">Periode</th>
                <th className="py-2 text-right font-semibold">Pemasukan</th>
                <th className="py-2 text-right font-semibold">Pengeluaran</th>
                <th className="py-2 text-right font-semibold">Arus kas</th>
              </tr>
            </thead>
            <tbody>
              {series.map((point) => (
                <tr key={point.key} className="border-t border-line">
                  <td className="py-2">{point.label}</td>
                  <td className="py-2 text-right tabular-nums text-primary">{formatIdr(point.income, style)}</td>
                  <td className="py-2 text-right tabular-nums text-expense">{formatIdr(point.expense, style)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums">{formatIdr(point.income - point.expense, style)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Mini label="Rata-rata harian" value={formatIdr(summary.avgDay, style)} />
        <Mini label="Rata-rata mingguan" value={formatIdr(summary.avgWeek, style)} />
        <Mini label="Rata-rata bulanan" value={formatIdr(summary.avgMonth, style)} />
        <Mini
          label="Hari pengeluaran terbesar"
          value={summary.peakDay ? formatIdr(summary.peakAmount, style) : "—"}
          hint={summary.peakDay ? formatDateID(summary.peakDay) : "Belum ada pengeluaran"}
        />
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl text-ink">Pengeluaran per kategori</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Total {formatIdr(breakdown.total, style)}
          {breakdown.rows[0] ? `. Terbesar: ${breakdown.rows[0].name}.` : "."}
        </p>
        <SpendingChart rows={breakdown.rows} />
      </section>
    </div>
  );
}

function ReportStat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: "income" | "expense" }) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={cn("mt-2 font-display text-3xl tabular-nums", tone === "income" ? "text-primary" : "text-expense")}>{value}</p>
      <p className="mt-2 text-sm text-muted">{hint}</p>
    </article>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-semibold tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
    </article>
  );
}

function GrainButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "h-11 rounded-xl px-3 text-sm font-semibold",
        active ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
