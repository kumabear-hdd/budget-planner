import type { Category } from "@/lib/finance/types";

export const SAVINGS_CATEGORY_ID = "tabungan";

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "makanan", name: "Makanan & Minuman", kind: "expense", builtin: true },
  { id: "transportasi", name: "Transportasi", kind: "expense", builtin: true },
  { id: "belanja", name: "Belanja", kind: "expense", builtin: true },
  { id: "tagihan", name: "Tagihan & Utilitas", kind: "expense", builtin: true },
  { id: "pendidikan", name: "Pendidikan", kind: "expense", builtin: true },
  { id: "kesehatan", name: "Kesehatan", kind: "expense", builtin: true },
  { id: "hiburan", name: "Hiburan", kind: "expense", builtin: true },
  {
    id: SAVINGS_CATEGORY_ID,
    name: "Tabungan",
    kind: "expense",
    builtin: true,
    systemRole: "savings",
  },
  { id: "lain-pengeluaran", name: "Pengeluaran Lain", kind: "expense", builtin: true },
  { id: "gaji", name: "Gaji", kind: "income", builtin: true },
  { id: "uang-saku", name: "Uang Saku", kind: "income", builtin: true },
  { id: "freelance", name: "Freelance", kind: "income", builtin: true },
  { id: "bisnis", name: "Bisnis", kind: "income", builtin: true },
  { id: "afiliasi", name: "Pendapatan Afiliasi", kind: "income", builtin: true },
  { id: "hadiah", name: "Hadiah", kind: "income", builtin: true },
  { id: "lain-pemasukan", name: "Pemasukan Lain", kind: "income", builtin: true },
];

export function normalizeCategories(incoming: Category[]): Category[] {
  const defaults = new Map(DEFAULT_CATEGORIES.map((category) => [category.id, category]));
  const map = new Map<string, Category>();

  for (const category of incoming) {
    const base = defaults.get(category.id);
    if (base) {
      map.set(category.id, {
        ...category,
        builtin: true,
        kind: base.kind,
        systemRole: base.systemRole,
        name: category.name.trim() || base.name,
      });
    } else if (category.systemRole === "savings") {
      continue;
    } else {
      map.set(category.id, {
        ...category,
        builtin: false,
        systemRole: undefined,
        name: category.name.trim(),
      });
    }
  }

  for (const category of DEFAULT_CATEGORIES) {
    if (!map.has(category.id)) map.set(category.id, category);
  }

  return [...map.values()];
}

export function orderedCategories(categories: Category[], kind?: Category["kind"]): Category[] {
  const rank = new Map(DEFAULT_CATEGORIES.map((category, index) => [category.id, index]));
  return categories
    .filter((category) => !kind || category.kind === kind)
    .slice()
    .sort(
      (a, b) =>
        (rank.get(a.id) ?? 1000) - (rank.get(b.id) ?? 1000) || a.name.localeCompare(b.name, "id"),
    );
}

export function categoryName(categories: Category[], id: string): string {
  return categories.find((category) => category.id === id)?.name ?? "Tanpa kategori";
}
