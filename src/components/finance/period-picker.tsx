import { controlClass } from "@/components/ui/field";
import { PRESET_OPTIONS, periodLabel } from "@/lib/finance/period";
import { useUiStore } from "@/lib/finance/ui-store";

export function PeriodPicker() {
  const period = useUiStore((state) => state.period);
  const setPreset = useUiStore((state) => state.setPreset);
  const setCustomRange = useUiStore((state) => state.setCustomRange);

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        <span className="sr-only">Periode</span>
        <select
          aria-label="Periode"
          className={controlClass}
          value={period.preset}
          onChange={(event) => setPreset(event.target.value as typeof period.preset)}
        >
          {PRESET_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {period.preset === "custom" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm font-medium text-muted">
            Dari
            <input
              type="date"
              className={`${controlClass} mt-1`}
              value={period.from ?? ""}
              onChange={(event) => setCustomRange(event.target.value, period.to ?? event.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-muted">
            Sampai
            <input
              type="date"
              className={`${controlClass} mt-1`}
              value={period.to ?? ""}
              onChange={(event) => setCustomRange(period.from ?? event.target.value, event.target.value)}
            />
          </label>
        </div>
      ) : (
        <p className="text-sm text-muted">{periodLabel(period)}</p>
      )}
    </div>
  );
}
