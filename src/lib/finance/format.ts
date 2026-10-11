import type { CurrencyStyle } from "@/lib/finance/types";

export function formatIdr(amount: number, style: CurrencyStyle = "tight"): string {
  const negative = amount < 0;
  const abs = Math.abs(Math.round(amount));
  const digits = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const core = style === "spaced" ? `Rp ${digits}` : `Rp${digits}`;
  return negative ? `−${core}` : core;
}

export function formatSignedIdr(
  amount: number,
  style: CurrencyStyle,
  mode: "income" | "expense" | "transfer" | "plain",
): string {
  const body = formatIdr(Math.abs(amount), style);
  if (mode === "income") return `+${body}`;
  if (mode === "expense" || mode === "transfer") return `−${body}`;
  return amount < 0 ? `−${body}` : body;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
  return `${text}%`;
}

export function compactIdr(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  }
  if (abs >= 1_000_000) {
    const value = abs / 1_000_000;
    const text = value >= 10 ? String(Math.round(value)) : value.toFixed(1).replace(".", ",");
    return `${sign}${text} jt`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)} rb`;
  }
  return `${sign}${Math.round(abs)}`;
}

/** Parse Indonesian or plain numeric input into whole rupiah. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "," || cleaned === ".") return null;

  let normalized = cleaned;
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    const parts = normalized.split(".");
    if (parts.length > 2 || (parts[1] !== undefined && parts[1].length === 3)) {
      normalized = parts.join("");
    }
  } else if (hasComma) {
    const parts = normalized.split(",");
    if (parts.length > 2 || (parts[1] !== undefined && parts[1].length === 3)) {
      normalized = parts.join("");
    } else {
      normalized = normalized.replace(",", ".");
    }
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}
