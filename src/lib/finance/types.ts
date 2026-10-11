export type TxKind = "income" | "expense" | "transfer";

export type CurrencyStyle = "tight" | "spaced";

export interface Category {
  id: string;
  name: string;
  kind: "income" | "expense";
  builtin: boolean;
  systemRole?: "savings";
}

export interface Transaction {
  id: string;
  kind: TxKind;
  name: string;
  amount: number;
  categoryId: string;
  date: string;
  notes: string;
  goalId: string | null;
  createdAt: string;
}

export interface TransactionDraft {
  kind: TxKind;
  name: string;
  amount: number;
  categoryId: string;
  date: string;
  notes: string;
  goalId: string | null;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string;
  createdAt: string;
}

export interface GoalDraft {
  name: string;
  targetAmount: number;
  targetDate: string;
}
