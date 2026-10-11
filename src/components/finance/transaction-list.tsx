import { Pencil, Trash2 } from "lucide-react";
import { CategoryIcon } from "@/components/finance/icons";
import { Button } from "@/components/ui/button";
import { categoryName } from "@/lib/finance/defaults";
import { formatDateID } from "@/lib/finance/period";
import { useFinanceStore } from "@/lib/finance/store";
import { formatSignedIdr } from "@/lib/finance/format";
import type { Transaction } from "@/lib/finance/types";
import { useUiStore } from "@/lib/finance/ui-store";
import { cn } from "@/lib/utils";

const KIND_LABEL = {
  income: "Pemasukan",
  expense: "Pengeluaran",
  transfer: "Tabungan",
} as const;

export function TransactionList({
  transactions,
  emptyTitle,
  emptyBody,
}: {
  transactions: Transaction[];
  emptyTitle: string;
  emptyBody: string;
}) {
  const categories = useFinanceStore((state) => state.categories);
  const style = useFinanceStore((state) => state.currencyStyle);
  const openEdit = useUiStore((state) => state.openEdit);
  const askDelete = useUiStore((state) => state.askDelete);

  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
        <p className="font-display text-2xl text-ink">{emptyTitle}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-pretty text-muted">{emptyBody}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      {transactions.map((transaction) => {
        const tone =
          transaction.kind === "income"
            ? "text-primary"
            : transaction.kind === "expense"
              ? "text-expense"
              : "text-ink";
        const badge =
          transaction.kind === "income"
            ? "bg-primary-soft text-primary"
            : transaction.kind === "expense"
              ? "bg-expense-soft text-expense"
              : "bg-surface-2 text-ink";
        return (
          <li key={transaction.id} className="flex items-start gap-3 px-4 py-3 sm:items-center">
            <span className={cn("mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full sm:mt-0", badge)}>
              <CategoryIcon id={transaction.categoryId} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{transaction.name}</p>
              <p className="truncate text-sm text-muted">
                {KIND_LABEL[transaction.kind]} · {categoryName(categories, transaction.categoryId)} ·{" "}
                {formatDateID(transaction.date)}
              </p>
              {transaction.notes ? <p className="mt-0.5 truncate text-sm text-muted">{transaction.notes}</p> : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <p className={cn("font-semibold tabular-nums", tone)} data-kind={transaction.kind}>
                {formatSignedIdr(transaction.amount, style, transaction.kind)}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Ubah ${transaction.name}`}
                  onClick={() => openEdit(transaction.id)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Hapus ${transaction.name}`}
                  onClick={() => askDelete(transaction.id)}
                >
                  <Trash2 className="size-4 text-expense" />
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
