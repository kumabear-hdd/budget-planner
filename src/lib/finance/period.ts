import {
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";
import { id as localeId } from "date-fns/locale";

export type PeriodPreset = "today" | "week" | "month" | "year" | "all" | "custom";

export interface Period {
  preset: PeriodPreset;
  from: string | null;
  to: string | null;
}

export type Granularity = "day" | "week" | "month";

export function todayISO(now = new Date()): string {
  return format(now, "yyyy-MM-dd");
}

export function formatDateID(iso: string): string {
  return format(parseISO(iso), "d MMM yyyy", { locale: localeId });
}

export function formatDateLong(iso: string): string {
  return format(parseISO(iso), "d MMMM yyyy", { locale: localeId });
}

export function periodFromPreset(
  preset: PeriodPreset,
  now = new Date(),
  custom?: { from: string; to: string },
): Period {
  const today = todayISO(now);
  if (preset === "all") return { preset, from: null, to: null };
  if (preset === "today") return { preset, from: today, to: today };
  if (preset === "week") {
    return {
      preset,
      from: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      to: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    };
  }
  if (preset === "month") {
    return {
      preset,
      from: format(startOfMonth(now), "yyyy-MM-dd"),
      to: format(endOfMonth(now), "yyyy-MM-dd"),
    };
  }
  if (preset === "year") {
    return {
      preset,
      from: format(startOfYear(now), "yyyy-MM-dd"),
      to: format(endOfYear(now), "yyyy-MM-dd"),
    };
  }
  const from = custom?.from || today;
  const to = custom?.to || today;
  return {
    preset: "custom",
    from: from <= to ? from : to,
    to: from <= to ? to : from,
  };
}

export function previousPeriod(period: Period): Period | null {
  if (period.preset === "all" || !period.from || !period.to) return null;
  const from = parseISO(period.from);
  const to = parseISO(period.to);

  if (period.preset === "today") {
    const day = format(subDays(from, 1), "yyyy-MM-dd");
    return { preset: "custom", from: day, to: day };
  }
  if (period.preset === "week") {
    return {
      preset: "custom",
      from: format(subWeeks(from, 1), "yyyy-MM-dd"),
      to: format(subWeeks(to, 1), "yyyy-MM-dd"),
    };
  }
  if (period.preset === "month") {
    const prev = subMonths(from, 1);
    return {
      preset: "custom",
      from: format(startOfMonth(prev), "yyyy-MM-dd"),
      to: format(endOfMonth(prev), "yyyy-MM-dd"),
    };
  }
  if (period.preset === "year") {
    const prev = subYears(from, 1);
    return {
      preset: "custom",
      from: format(startOfYear(prev), "yyyy-MM-dd"),
      to: format(endOfYear(prev), "yyyy-MM-dd"),
    };
  }

  const days = differenceInCalendarDays(to, from) + 1;
  const prevTo = subDays(from, 1);
  const prevFrom = subDays(prevTo, days - 1);
  return {
    preset: "custom",
    from: format(prevFrom, "yyyy-MM-dd"),
    to: format(prevTo, "yyyy-MM-dd"),
  };
}

export function periodLabel(period: Period): string {
  if (period.preset === "all" || !period.from || !period.to) return "Semua waktu";
  if (period.from === period.to) return formatDateID(period.from);
  return `${formatDateID(period.from)} – ${formatDateID(period.to)}`;
}

export function inPeriod(date: string, period: Period): boolean {
  if (period.from && date < period.from) return false;
  if (period.to && date > period.to) return false;
  return true;
}

export function autoGranularity(period: Period): Granularity {
  if (period.preset === "year" || period.preset === "all") return "month";
  if (!period.from || !period.to) return "month";
  const days = differenceInCalendarDays(parseISO(period.to), parseISO(period.from)) + 1;
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

export const PRESET_OPTIONS: { id: PeriodPreset; label: string }[] = [
  { id: "today", label: "Hari ini" },
  { id: "week", label: "Minggu ini" },
  { id: "month", label: "Bulan ini" },
  { id: "year", label: "Tahun ini" },
  { id: "all", label: "Semua waktu" },
  { id: "custom", label: "Rentang tanggal" },
];

export function bucketRange(period: Period, dates: string[]): { from: Date; to: Date } {
  if (period.from && period.to) {
    return { from: parseISO(period.from), to: parseISO(period.to) };
  }
  const sorted = dates.slice().sort();
  if (sorted.length === 0) {
    const today = parseISO(todayISO());
    return { from: today, to: today };
  }
  return { from: parseISO(sorted[0]!), to: parseISO(sorted[sorted.length - 1]!) };
}

export interface TimeBucket {
  key: string;
  label: string;
  start: string;
  end: string;
}

export function buildTimeBuckets(period: Period, granularity: Granularity, dates: string[]): TimeBucket[] {
  const range = bucketRange(period, dates);
  let from = range.from;
  const to = range.to;

  if (granularity === "day") {
    const span = differenceInCalendarDays(to, from);
    if (span > 62) from = subDays(to, 61);
    return eachDayOfInterval({ start: from, end: to }).map((day) => {
      const key = format(day, "yyyy-MM-dd");
      return { key, label: format(day, "d MMM", { locale: localeId }), start: key, end: key };
    });
  }

  if (granularity === "week") {
    return eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 }).map((week) => {
      const start = format(startOfWeek(week, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const end = format(endOfWeek(week, { weekStartsOn: 1 }), "yyyy-MM-dd");
      return { key: start, label: format(parseISO(start), "d MMM", { locale: localeId }), start, end };
    });
  }

  return eachMonthOfInterval({ start: startOfMonth(from), end: startOfMonth(to) }).map((month) => {
    const start = format(startOfMonth(month), "yyyy-MM-dd");
    const end = format(endOfMonth(month), "yyyy-MM-dd");
    return {
      key: format(month, "yyyy-MM"),
      label: format(month, "MMM yy", { locale: localeId }),
      start,
      end,
    };
  });
}
