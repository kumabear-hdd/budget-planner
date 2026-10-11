import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, PieChart, PiggyBank, Plus, Receipt, Settings, Tags } from "lucide-react";
import type { ReactNode } from "react";
import { DeleteTransactionDialog, TransactionDialog } from "@/components/finance/transaction-dialog";
import { InstallAppButton } from "@/components/pwa/install-app";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/finance/store";
import { useUiStore } from "@/lib/finance/ui-store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dasbor", icon: LayoutDashboard, exact: true },
  { to: "/transaksi", label: "Transaksi", icon: Receipt, exact: false },
  { to: "/kategori", label: "Kategori", icon: Tags, exact: false },
  { to: "/tabungan", label: "Tabungan", icon: PiggyBank, exact: false },
  { to: "/laporan", label: "Laporan", icon: PieChart, exact: false },
  { to: "/pengaturan", label: "Pengaturan", icon: Settings, exact: false },
] as const;

function useActive(to: string, exact: boolean) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (exact) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavItem({
  to,
  label,
  icon: Icon,
  exact,
  compact,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact: boolean;
  compact?: boolean;
}) {
  const active = useActive(to, exact);
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-xl font-semibold transition-colors",
        compact ? "min-h-14 flex-col justify-center gap-1 px-1 text-xs" : "h-11 px-3 text-sm",
        active ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-ink",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

export function AppShell() {
  const hydrated = useHydrated();
  const openCreate = useUiStore((state) => state.openCreate);

  return (
    <div className="min-h-screen bg-bg text-ink lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-sidebar lg:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary font-display text-lg text-on-primary">
            Bp
          </span>
          <span>
            <span className="block font-display text-xl leading-none">Budget Planner</span>
            <span className="mt-1 block text-sm text-muted">Keuangan pribadi</span>
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Utama">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="space-y-3 p-3">
          <Button className="w-full" onClick={() => openCreate()}>
            <Plus className="size-4" />
            Catat transaksi
          </Button>
          <InstallAppButton variant="secondary" className="w-full" compact />
          <p className="px-2 text-xs text-muted">
            Data tersimpan offline di perangkat ini. Bisa dipasang sebagai aplikasi.
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary font-display text-sm text-on-primary">
              Bp
            </span>
            <p className="font-display text-lg leading-none">Budget Planner</p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" aria-label="Catat transaksi" onClick={() => openCreate()}>
              <Plus className="size-5" />
            </Button>
            <Link
              to="/pengaturan"
              aria-label="Pengaturan"
              className="flex size-11 items-center justify-center rounded-xl text-ink hover:bg-surface-2"
            >
              <Settings className="size-5" />
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-10">
          {hydrated ? <Outlet /> : <PageSkeleton />}
        </main>

        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden" aria-label="Utama">
          <ul className="grid grid-cols-5">
            {NAV.filter((item) => item.to !== "/pengaturan").map((item) => (
              <li key={item.to}>
                <NavItem {...item} compact />
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <TransactionDialog />
      <DeleteTransactionDialog />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <p className="text-sm font-medium text-muted">Memuat data keuangan…</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-primary">{eyebrow}</p>
        <h1 className="mt-1 font-display text-3xl text-ink sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-pretty text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
