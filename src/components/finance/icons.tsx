import {
  Banknote,
  Briefcase,
  Bus,
  Clapperboard,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Megaphone,
  MoreHorizontal,
  PiggyBank,
  Receipt,
  ShoppingBag,
  Store,
  Tag,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  makanan: Utensils,
  transportasi: Bus,
  belanja: ShoppingBag,
  tagihan: Receipt,
  pendidikan: GraduationCap,
  kesehatan: HeartPulse,
  hiburan: Clapperboard,
  tabungan: PiggyBank,
  "lain-pengeluaran": MoreHorizontal,
  gaji: Banknote,
  "uang-saku": HandCoins,
  freelance: Briefcase,
  bisnis: Store,
  afiliasi: Megaphone,
  hadiah: Gift,
  "lain-pemasukan": Wallet,
};

export function CategoryIcon({ id, className }: { id: string; className?: string }) {
  const Icon = ICONS[id] ?? Tag;
  return <Icon className={className} aria-hidden="true" />;
}
