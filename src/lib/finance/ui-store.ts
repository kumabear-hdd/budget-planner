import { create } from "zustand";
import { periodFromPreset, type Period, type PeriodPreset } from "@/lib/finance/period";

interface UiState {
  period: Period;
  setPreset: (preset: PeriodPreset) => void;
  setCustomRange: (from: string, to: string) => void;
  txOpen: boolean;
  editingId: string | null;
  presetGoalId: string | null;
  openCreate: (opts?: { goalId?: string }) => void;
  openEdit: (id: string) => void;
  closeTx: () => void;
  deleteId: string | null;
  askDelete: (id: string) => void;
  cancelDelete: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  period: periodFromPreset("month"),
  setPreset: (preset) =>
    set((state) => {
      if (preset === "custom") {
        const base =
          state.period.from && state.period.to ? state.period : periodFromPreset("month");
        return { period: { preset: "custom", from: base.from, to: base.to } };
      }
      return { period: periodFromPreset(preset) };
    }),
  setCustomRange: (from, to) => set({ period: periodFromPreset("custom", new Date(), { from, to }) }),
  txOpen: false,
  editingId: null,
  presetGoalId: null,
  openCreate: (opts) => set({ txOpen: true, editingId: null, presetGoalId: opts?.goalId ?? null }),
  openEdit: (id) => set({ txOpen: true, editingId: id, presetGoalId: null }),
  closeTx: () => set({ txOpen: false, editingId: null, presetGoalId: null }),
  deleteId: null,
  askDelete: (id) => set({ deleteId: id }),
  cancelDelete: () => {
    if (get().deleteId) set({ deleteId: null });
  },
}));
