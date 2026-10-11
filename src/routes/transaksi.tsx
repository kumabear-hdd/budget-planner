import { createFileRoute } from "@tanstack/react-router";
import { Download, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TransactionList } from "@/components/finance/transaction-list";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/field";
import { filterTransactions } from "@/lib/finance/calc";
import { categoryName, orderedCategories } from "@/lib/finance/defaults";
import { formatDateID } from "@/lib/finance/period";
import { useFinanceStore } from "@/lib/finance/store";
import type { TxKind } from "@/lib/finance/types";
import { useUiStore } from "@/lib/finance/ui-store";

export const Route = createFileRoute("/transaksi")({
  component: TransactionsPage,
  head: () => ({ meta: [{ title: "Transaksi · Budget Planner" }] }),
});

function TransactionsPage() {
  const transactions = useFinanceStore((state) => state.transactions);
  const categories = useFinanceStore((state) => state.categories);
  const openCreate = useUiStore((state) => state.openCreate);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | TxKind>("all");
  const [categoryId, setCategoryId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const visible = useMemo(
    () => filterTransactions(transactions, { query, kind, categoryId, from, to, sort }),
    [transactions, query, kind, categoryId, from, to, sort],
  );
  const filtered = query || kind !== "all" || categoryId !== "all" || from || to;
  const expenseCategories = orderedCategories(categories, "expense");
  const incomeCategories = orderedCategories(categories, "income");

  const exportPdf = async () => {
    if (visible.length === 0) {
      toast.error("Tidak ada transaksi untuk diunduh.");
      return;
    }
    const kindLabel = { all: "Semua jenis", income: "Pemasukan", expense: "Pengeluaran", transfer: "Tabungan" }[
      kind
    ];
    const rangeText =
      from || to
        ? `${from ? formatDateID(from) : "Awal"} - ${to ? formatDateID(to) : "Sekarang"}`
        : "Semua waktu";
    const subtitleParts = [`Jenis: ${kindLabel}`];
    if (categoryId !== "all") subtitleParts.push(`Kategori: ${categoryName(categories, categoryId)}`);
    if (query) subtitleParts.push(`Pencarian: "${query}"`);
    // Lazy-loaded so jsPDF stays out of the first-paint bundle.
    const { exportTransactionsPdf } = await import("@/lib/finance/pdf");
    exportTransactionsPdf({
      transactions: visible,
      categories,
      currencyStyle: useFinanceStore.getState().currencyStyle,
      periodText: rangeText,
      subtitle: subtitleParts.join(" | "),
      filename: "budget-planner-transaksi.pdf",
    });
    toast.success("PDF transaksi diunduh");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Riwayat"
        title="Transaksi"
        description="Cari, saring, dan urutkan seluruh pemasukan, pengeluaran, serta setoran tabungan."
        actions={
          <>
            <Button
              variant="secondary"
              data-testid="download-pdf"
              onClick={() => {
                void exportPdf();
              }}
            >
              <Download className="size-4" />
              Unduh PDF
            </Button>
            <Button onClick={() => openCreate()}>
              <Plus className="size-4" />
              Catat transaksi
            </Button>
          </>
        }
      />

      <section className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card md:grid-cols-2 xl:grid-cols-6">
        <label className="relative xl:col-span-2">
          <span className="sr-only">Cari transaksi</span>
          <Search className="pointer-events-none absolute top-3 left-3 size-5 text-muted" />
          <input
            className={`${controlClass} pl-10`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama atau catatan"
            data-testid="tx-search"
          />
        </label>
        <label>
          <span className="sr-only">Jenis</span>
          <select className={controlClass} value={kind} aria-label="Saring jenis" data-testid="tx-filter-kind" onChange={(event) => setKind(event.target.value as typeof kind)}>
            <option value="all">Semua jenis</option>
            <option value="income">Pemasukan</option>
            <option value="expense">Pengeluaran</option>
            <option value="transfer">Tabungan</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Kategori</span>
          <select className={controlClass} value={categoryId} aria-label="Saring kategori" data-testid="tx-filter-category" onChange={(event) => setCategoryId(event.target.value)}>
            <option value="all">Semua kategori</option>
            <optgroup label="Pengeluaran">
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Pemasukan">
              {incomeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label>
          <span className="sr-only">Dari tanggal</span>
          <input className={controlClass} type="date" aria-label="Dari tanggal" data-testid="tx-filter-from" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          <span className="sr-only">Sampai tanggal</span>
          <input className={controlClass} type="date" aria-label="Sampai tanggal" data-testid="tx-filter-to" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <label className="xl:col-span-2">
          <span className="sr-only">Urutan</span>
          <select className={controlClass} value={sort} aria-label="Urutan" onChange={(event) => setSort(event.target.value as typeof sort)}>
            <option value="newest">Terbaru</option>
            <option value="oldest">Terlama</option>
          </select>
        </label>
        {filtered ? (
          <div className="flex items-center xl:col-span-2">
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("");
                setKind("all");
                setCategoryId("all");
                setFrom("");
                setTo("");
              }}
            >
              Hapus filter
            </Button>
          </div>
        ) : null}
      </section>

      <p className="text-sm text-muted" data-testid="tx-count">
        {visible.length} transaksi
      </p>

      <TransactionList
        transactions={visible}
        emptyTitle={filtered ? "Tidak ada yang cocok" : "Belum ada transaksi"}
        emptyBody={
          filtered
            ? "Ubah kata kunci, jenis, kategori, atau rentang tanggal."
            : "Catat pemasukan atau pengeluaran pertama Anda. Data tetap ada setelah halaman dimuat ulang."
        }
      />
    </div>
  );
}
