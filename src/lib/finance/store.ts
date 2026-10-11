import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { idbStorage } from "@/lib/finance/idb-storage";
import { DEFAULT_CATEGORIES, normalizeCategories, SAVINGS_CATEGORY_ID } from "@/lib/finance/defaults";
import type {
  Category,
  CurrencyStyle,
  GoalDraft,
  SavingsGoal,
  Transaction,
  TransactionDraft,
} from "@/lib/finance/types";

interface FinanceState {
  openingBalance: number;
  currencyStyle: CurrencyStyle;
  transactions: Transaction[];
  categories: Category[];
  goals: SavingsGoal[];
  setOpeningBalance: (amount: number) => void;
  setCurrencyStyle: (style: CurrencyStyle) => void;
  addTransaction: (draft: TransactionDraft) => string;
  updateTransaction: (id: string, draft: TransactionDraft) => void;
  removeTransaction: (id: string) => void;
  addCategory: (name: string, kind: Category["kind"]) => string | null;
  removeCategory: (id: string) => boolean;
  addGoal: (draft: GoalDraft) => string;
  updateGoal: (id: string, draft: GoalDraft) => void;
  removeGoal: (id: string) => void;
  replaceAll: (data: {
    openingBalance: number;
    currencyStyle: CurrencyStyle;
    transactions: Transaction[];
    categories: Category[];
    goals: SavingsGoal[];
  }) => void;
  resetAll: () => void;
}

function uid(): string {
  return crypto.randomUUID();
}

function normalizeDraft(draft: TransactionDraft): TransactionDraft {
  return {
    ...draft,
    name: draft.name.trim(),
    notes: draft.notes.trim(),
    amount: Math.round(draft.amount),
    categoryId: draft.kind === "transfer" ? SAVINGS_CATEGORY_ID : draft.categoryId,
    goalId: draft.kind === "transfer" ? draft.goalId : null,
  };
}

const initialData = {
  openingBalance: 0,
  currencyStyle: "tight" as CurrencyStyle,
  transactions: [] as Transaction[],
  categories: DEFAULT_CATEGORIES,
  goals: [] as SavingsGoal[],
};

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      ...initialData,
      setOpeningBalance: (amount) => set({ openingBalance: Math.round(amount) }),
      setCurrencyStyle: (currencyStyle) => set({ currencyStyle }),
      addTransaction: (draft) => {
        const id = uid();
        const transaction: Transaction = {
          ...normalizeDraft(draft),
          id,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ transactions: [transaction, ...state.transactions] }));
        return id;
      },
      updateTransaction: (id, draft) =>
        set((state) => ({
          transactions: state.transactions.map((transaction) =>
            transaction.id === id ? { ...transaction, ...normalizeDraft(draft) } : transaction,
          ),
        })),
      removeTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((transaction) => transaction.id !== id),
        })),
      addCategory: (name, kind) => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const exists = get().categories.some(
          (category) =>
            category.kind === kind && category.name.localeCompare(trimmed, "id", { sensitivity: "accent" }) === 0,
        );
        if (exists) return null;
        const category: Category = {
          id: `kategori-${uid()}`,
          name: trimmed,
          kind,
          builtin: false,
        };
        set((state) => ({ categories: [...state.categories, category] }));
        return category.id;
      },
      removeCategory: (id) => {
        const category = get().categories.find((item) => item.id === id);
        if (!category || category.builtin) return false;
        const used = get().transactions.some((transaction) => transaction.categoryId === id);
        if (used) return false;
        set((state) => ({ categories: state.categories.filter((item) => item.id !== id) }));
        return true;
      },
      addGoal: (draft) => {
        const id = uid();
        const goal: SavingsGoal = {
          id,
          name: draft.name.trim(),
          targetAmount: Math.round(draft.targetAmount),
          targetDate: draft.targetDate,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ goals: [goal, ...state.goals] }));
        return id;
      },
      updateGoal: (id, draft) =>
        set((state) => ({
          goals: state.goals.map((goal) =>
            goal.id === id
              ? {
                  ...goal,
                  name: draft.name.trim(),
                  targetAmount: Math.round(draft.targetAmount),
                  targetDate: draft.targetDate,
                }
              : goal,
          ),
        })),
      removeGoal: (id) =>
        set((state) => ({
          goals: state.goals.filter((goal) => goal.id !== id),
          transactions: state.transactions.filter((transaction) => transaction.goalId !== id),
        })),
      replaceAll: (data) =>
        set({
          openingBalance: Math.round(data.openingBalance),
          currencyStyle: data.currencyStyle,
          transactions: data.transactions,
          categories: normalizeCategories(data.categories),
          goals: data.goals,
        }),
      resetAll: () => set({ ...initialData, categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })) }),
    }),
    {
      name: "budget-planner-v1",
      version: 1,
      // Offline-first spec: transactions/categories/goals persist in
      // IndexedDB (idb-storage imports any legacy localStorage copy once),
      // so add/edit/delete and every on-device recalculation keep working
      // with no connection. There is no cloud sync target to reconcile.
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        openingBalance: state.openingBalance,
        currencyStyle: state.currencyStyle,
        transactions: state.transactions,
        categories: state.categories,
        goals: state.goals,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<FinanceState>;
        return {
          ...current,
          openingBalance: typeof saved.openingBalance === "number" ? saved.openingBalance : 0,
          currencyStyle: saved.currencyStyle === "spaced" ? "spaced" : "tight",
          transactions: Array.isArray(saved.transactions) ? saved.transactions : [],
          categories: normalizeCategories(Array.isArray(saved.categories) ? saved.categories : []),
          goals: Array.isArray(saved.goals) ? saved.goals : [],
        };
      },
    },
  ),
);

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const finish = () => setHydrated(true);
    const unsub = useFinanceStore.persist.onFinishHydration(finish);
    if (useFinanceStore.persist.hasHydrated()) finish();
    return unsub;
  }, []);

  return hydrated;
}
