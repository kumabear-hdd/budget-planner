import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Category, SavingsGoal, Transaction, TxKind } from "@/lib/finance/types";
import { categoryName } from "@/lib/finance/defaults";
import {
  buildTimeBuckets,
  inPeriod,
  todayISO,
  type Granularity,
  type Period,
} from "@/lib/finance/period";

export interface FlowTotals {
  income: number;
  expense: number;
  savings: number;
  net: number;
}

export function flowTotals(transactions: Transaction[], period?: Period): FlowTotals {
  let income = 0;
  let expense = 0;
  let savings = 0;
  for (const transaction of transactions) {
    if (period && !inPeriod(transaction.date, period)) continue;
    if (transaction.kind === "income") income += transaction.amount;
    else if (transaction.kind === "expense") expense += transaction.amount;
    else savings += transaction.amount;
  }
  return { income, expense, savings, net: income - expense };
}

/** Opening balance + income − ordinary expenses − savings transfers. */
export function availableBalance(openingBalance: number, transactions: Transaction[]): number {
  const totals = flowTotals(transactions);
  return openingBalance + totals.income - totals.expense - totals.savings;
}

export function goalSaved(transactions: Transaction[], goalId: string): number {
  return transactions.reduce(
    (sum, transaction) =>
      transaction.kind === "transfer" && transaction.goalId === goalId ? sum + transaction.amount : sum,
    0,
  );
}

export function goalProgress(goal: SavingsGoal, saved: number): number {
  if (goal.targetAmount <= 0) return 0;
  return (saved / goal.targetAmount) * 100;
}

export interface CategorySlice {
  categoryId: string;
  name: string;
  amount: number;
  percent: number;
}

export function expenseByCategory(
  transactions: Transaction[],
  categories: Category[],
  period: Period,
): { total: number; rows: CategorySlice[] } {
  const amounts = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.kind !== "expense") continue;
    if (!inPeriod(transaction.date, period)) continue;
    amounts.set(transaction.categoryId, (amounts.get(transaction.categoryId) ?? 0) + transaction.amount);
  }
  const total = [...amounts.values()].reduce((sum, amount) => sum + amount, 0);
  const rows = [...amounts.entries()]
    .map(([categoryId, amount]) => ({
      categoryId,
      name: categoryName(categories, categoryId),
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "id"));
  return { total, rows };
}

export interface CashflowPoint {
  key: string;
  label: string;
  income: number;
  expense: number;
}

export function cashflowSeries(
  transactions: Transaction[],
  period: Period,
  granularity: Granularity,
): CashflowPoint[] {
  const buckets = buildTimeBuckets(
    period,
    granularity,
    transactions.map((transaction) => transaction.date),
  );
  return buckets.map((bucket) => {
    let income = 0;
    let expense = 0;
    for (const transaction of transactions) {
      if (transaction.date < bucket.start || transaction.date > bucket.end) continue;
      if (!inPeriod(transaction.date, period)) continue;
      if (transaction.kind === "income") income += transaction.amount;
      else if (transaction.kind === "expense") expense += transaction.amount;
    }
    return { key: bucket.key, label: bucket.label, income, expense };
  });
}

export interface SpendingSummary {
  total: number;
  days: number;
  avgDay: number;
  avgWeek: number;
  avgMonth: number;
  peakDay: string | null;
  peakAmount: number;
}

export function spendingSummary(transactions: Transaction[], period: Period): SpendingSummary {
  const byDay = new Map<string, number>();
  let total = 0;
  for (const transaction of transactions) {
    if (transaction.kind !== "expense") continue;
    if (!inPeriod(transaction.date, period)) continue;
    total += transaction.amount;
    byDay.set(transaction.date, (byDay.get(transaction.date) ?? 0) + transaction.amount);
  }

  let from = period.from;
  let to = period.to;
  if (!from || !to) {
    const dates = [...byDay.keys()].sort();
    from = dates[0] ?? todayISO();
    to = dates[dates.length - 1] ?? from;
  }
  const days = Math.max(1, differenceInCalendarDays(parseISO(to), parseISO(from)) + 1);

  let peakDay: string | null = null;
  let peakAmount = 0;
  for (const [day, amount] of byDay) {
    if (amount > peakAmount) {
      peakAmount = amount;
      peakDay = day;
    }
  }

  return {
    total,
    days,
    avgDay: total / days,
    avgWeek: total / Math.max(1, days / 7),
    avgMonth: total / Math.max(1, days / 30.4375),
    peakDay,
    peakAmount,
  };
}

export interface TxQuery {
  query: string;
  kind: "all" | TxKind;
  categoryId: string;
  from: string;
  to: string;
  sort: "newest" | "oldest";
}

export function filterTransactions(transactions: Transaction[], query: TxQuery): Transaction[] {
  const needle = query.query.trim().toLowerCase();
  const filtered = transactions.filter((transaction) => {
    if (query.kind !== "all" && transaction.kind !== query.kind) return false;
    if (query.categoryId !== "all" && transaction.categoryId !== query.categoryId) return false;
    if (query.from && transaction.date < query.from) return false;
    if (query.to && transaction.date > query.to) return false;
    if (!needle) return true;
    return `${transaction.name} ${transaction.notes}`.toLowerCase().includes(needle);
  });

  filtered.sort((a, b) => {
    if (a.date !== b.date) {
      return query.sort === "newest" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
    }
    return query.sort === "newest"
      ? b.createdAt.localeCompare(a.createdAt)
      : a.createdAt.localeCompare(b.createdAt);
  });
  return filtered;
}

export function compareLabel(current: number, previous: number | null): string {
  if (previous === null) return "Tidak ada periode pembanding";
  if (previous === 0 && current === 0) return "Sama dengan periode sebelumnya";
  if (previous === 0) return "Periode sebelumnya kosong";
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 0.05) return "Sama dengan periode sebelumnya";
  const direction = pct > 0 ? "naik" : "turun";
  const rounded = Math.round(Math.abs(pct) * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
  return `${direction} ${text}% dari periode sebelumnya`;
}
