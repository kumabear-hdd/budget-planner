import { createFileRoute } from "@tanstack/react-router";
import { Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/layout/app-shell";
import { InstallAppButton } from "@/components/pwa/install-app";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { formatIdr, parseAmount } from "@/lib/finance/format";
import { useFinanceStore } from "@/lib/finance/store";
import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";
import { useOnline } from "@/lib/pwa/use-online";
import type { CurrencyStyle } from "@/lib/finance/types";

const backupSchema = z.object({
  openingBalance: z.number().finite(),
  currencyStyle: z.enum(["tight", "spaced"]),
  transactions: z.array(
    z.object({
      id: z.string().min(1),
      kind: z.enum(["income", "expense", "transfer"]),
      name: z.string().min(1),
      amount: z.number().positive(),
      categoryId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      notes: z.string(),
      goalId: z.string().nullable(),
      createdAt: z.string().min(1),
    }),
  ),
  categories: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      kind: z.enum(["income", "expense"]),
      builtin: z.boolean(),
      systemRole: z.enum(["savings"]).optional(),
    }),
  ),
  goals: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      targetAmount: z.number().positive(),
      targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      createdAt: z.string().min(1),
    }),
  ),
});

export const Route = createFileRoute("/pengaturan")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Pengaturan · Budget Planner" }] }),
});

function SettingsPage() {
  const openingBalance = useFinanceStore((state) => state.openingBalance);
  const currencyStyle = useFinanceStore((state) => state.currencyStyle);
  const [balanceInput, setBalanceInput] = useState(String(openingBalance));
  const [style, setStyle] = useState<CurrencyStyle>(currencyStyle);
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const online = useOnline();
  const { isInstalled } = useInstallPrompt();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pengaturan"
        title="Saldo dan format"
        description="Saldo awal adalah uang yang sudah Anda pegang sebelum mulai mencatat. Ia tidak masuk total pemasukan."
      />

      <form
        className="max-w-xl space-y-5 rounded-2xl border border-line bg-surface p-5 shadow-card"
        onSubmit={(event) => {
          event.preventDefault();
          const amount = parseAmount(balanceInput);
          if (amount === null) {
            setError("Masukkan saldo awal yang valid.");
            return;
          }
          if (amount < 0) {
            setError("Saldo awal tidak boleh negatif.");
            return;
          }
          if (amount > 1_000_000_000_000) {
            setError("Saldo awal terlalu besar.");
            return;
          }
          useFinanceStore.getState().setOpeningBalance(amount);
          useFinanceStore.getState().setCurrencyStyle(style);
          setBalanceInput(String(amount));
          setError("");
          toast.success("Pengaturan disimpan");
        }}
      >
        <Field
          label="Saldo awal"
          htmlFor="opening-balance"
          error={error}
          hint="Contoh: 500000 menjadi Rp500.000. Dipakai di saldo tersedia, bukan sebagai transaksi."
        >
          <TextInput
            id="opening-balance"
            data-testid="opening-balance"
            inputMode="numeric"
            value={balanceInput}
            onChange={(event) => setBalanceInput(event.target.value)}
          />
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-ink">Format mata uang</legend>
          <p className="text-sm text-muted">Mata uang tetap Rupiah. Pilih cara penulisan.</p>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="radio" name="currency-style" checked={style === "tight"} onChange={() => setStyle("tight")} />
            {formatIdr(15000, "tight")} dan {formatIdr(1250000, "tight")}
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="radio" name="currency-style" checked={style === "spaced"} onChange={() => setStyle("spaced")} />
            {formatIdr(15000, "spaced")} dan {formatIdr(1250000, "spaced")}
          </label>
        </fieldset>

        <Button type="submit" data-testid="save-settings">
          Simpan pengaturan
        </Button>
      </form>

      <section className="max-w-xl space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl text-ink">Aplikasi &amp; offline</h2>
        <p className="text-sm text-pretty text-muted">
          Budget Planner adalah aplikasi web yang bisa dipasang langsung di perangkat — tampil di
          jendelanya sendiri tanpa bilah peramban, dan tetap bisa dibuka serta dipakai mencatat
          transaksi saat internet mati.
        </p>
        <div
          data-testid="connection-status"
          className={
            online
              ? "inline-flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary"
              : "inline-flex items-center gap-2 rounded-xl bg-expense-soft px-3 py-1.5 text-sm font-semibold text-expense"
          }
        >
          {online ? <Wifi className="size-4" aria-hidden="true" /> : <WifiOff className="size-4" aria-hidden="true" />}
          {online ? "Online" : "Offline — data tetap bisa diubah"}
        </div>
        {isInstalled ? (
          <p className="rounded-xl bg-primary-soft p-3 text-sm font-semibold text-primary">
            Aplikasi sudah terpasang di perangkat ini.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <InstallAppButton />
          </div>
        )}
        <p className="text-xs text-muted">
          Data transaksi disimpan di IndexedDB perangkat — bukan di server — sehingga penambahan,
          perubahan, dan penghapusan tetap berjalan penuh saat offline. Tidak ada sinkronisasi ke
          akun, jadi tidak ada status “tersinkron” yang perlu ditunggu.
        </p>
      </section>

      <section className="max-w-xl space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl text-ink">Penyimpanan</h2>
        <p className="text-sm text-pretty text-muted">
          Catatan keuangan disimpan di basis data lokal (IndexedDB) peramban ini saja. Data tidak
          tersinkron ke ponsel atau komputer lain, dan dapat hilang jika data situs dihapus. Unduh
          cadangan jika Anda ingin menyimpannya di tempat lain.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              const state = useFinanceStore.getState();
              const payload = {
                openingBalance: state.openingBalance,
                currencyStyle: state.currencyStyle,
                transactions: state.transactions,
                categories: state.categories,
                goals: state.goals,
              };
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "budget-planner-cadangan.json";
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            Unduh cadangan
          </Button>
          <label className="inline-flex h-11 cursor-pointer items-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-2">
            Pulihkan cadangan
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                try {
                  const parsed = backupSchema.safeParse(JSON.parse(await file.text()));
                  if (!parsed.success) {
                    toast.error("Format cadangan tidak dikenali.");
                    return;
                  }
                  useFinanceStore.getState().replaceAll(parsed.data);
                  setBalanceInput(String(parsed.data.openingBalance));
                  setStyle(parsed.data.currencyStyle);
                  toast.success("Data dipulihkan");
                } catch {
                  toast.error("Berkas bukan JSON yang valid.");
                }
              }}
            />
          </label>
        </div>
      </section>

      <section className="max-w-xl rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-2xl text-ink">Hapus data</h2>
        <p className="mt-2 text-sm text-muted">Mengosongkan saldo awal, transaksi, kategori tambahan, dan target tabungan di peramban ini.</p>
        {confirmReset ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="danger"
              onClick={() => {
                useFinanceStore.getState().resetAll();
                setBalanceInput("0");
                setStyle("tight");
                setConfirmReset(false);
                toast.success("Data dihapus");
              }}
            >
              Ya, hapus semua
            </Button>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              Batal
            </Button>
          </div>
        ) : (
          <Button className="mt-4" variant="secondary" onClick={() => setConfirmReset(true)}>
            Hapus semua data
          </Button>
        )}
      </section>
    </div>
  );
}
