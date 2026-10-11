import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { CashflowPoint, CategorySlice } from "@/lib/finance/calc";
import { compactIdr, formatIdr, formatPercent } from "@/lib/finance/format";
import { useFinanceStore } from "@/lib/finance/store";

const SLICE_COLORS = [
  "var(--color-primary)",
  "var(--color-expense)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
];

export function sliceColor(index: number): string {
  return SLICE_COLORS[index % SLICE_COLORS.length] ?? "var(--color-primary)";
}

function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  const style = useFinanceStore((state) => state.currencyStyle);
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-card">
      {label ? <p className="font-semibold text-ink">{label}</p> : null}
      {payload.map((item) => (
        <p key={item.name} className="tabular-nums text-muted">
          {item.name}: {formatIdr(item.value ?? 0, style)}
        </p>
      ))}
    </div>
  );
}

export function SpendingChart({ rows }: { rows: CategorySlice[] }) {
  const style = useFinanceStore((state) => state.currencyStyle);
  if (rows.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 text-center text-sm text-muted">
        Belum ada pengeluaran pada periode ini.
      </div>
    );
  }

  return (
    <div className="grid items-center gap-4 md:grid-cols-[16rem_1fr]">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="amount" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2} stroke="none">
              {rows.map((row, index) => (
                <Cell key={row.categoryId} fill={sliceColor(index)} />
              ))}
            </Pie>
            <Tooltip content={<MoneyTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-3">
        {rows.map((row, index) => (
          <li key={row.categoryId} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <span className="size-3 rounded-full" style={{ background: sliceColor(index) }} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{row.name}</span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                <span className="block h-full rounded-full" style={{ width: `${Math.min(100, row.percent)}%`, background: sliceColor(index) }} />
              </span>
            </span>
            <span className="text-right text-sm tabular-nums text-ink">
              <span className="block font-semibold">{formatIdr(row.amount, style)}</span>
              <span className="text-muted">{formatPercent(row.percent)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CashflowChart({ points }: { points: CashflowPoint[] }) {
  const hasValue = points.some((point) => point.income > 0 || point.expense > 0);
  if (!hasValue) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 text-center text-sm text-muted">
        Belum ada pemasukan atau pengeluaran pada periode ini.
      </div>
    );
  }

  return (
    <div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} barGap={4}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="label" tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={12} />
            <YAxis
              tickFormatter={(value: number) => compactIdr(value)}
              tick={{ fill: "var(--color-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip content={<MoneyTooltip />} cursor={{ fill: "var(--color-surface-2)" }} />
            <Bar dataKey="income" name="Pemasukan" fill="var(--color-primary)" radius={[6, 6, 0, 0]} maxBarSize={28} />
            <Bar dataKey="expense" name="Pengeluaran" fill="var(--color-expense)" radius={[6, 6, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-4 text-sm text-muted">
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-primary" /> Pemasukan
        </li>
        <li className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-expense" /> Pengeluaran
        </li>
      </ul>
    </div>
  );
}
