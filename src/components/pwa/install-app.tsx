/**
 * Install App UI: native prompt when the browser offers one, per-platform
 * manual guidance when it doesn't (Safari never fires beforeinstallprompt),
 * and a plain "sudah terpasang" state once running standalone — the spec
 * forbids showing a misleading install prompt after installation.
 */
import * as Dialog from "@radix-ui/react-dialog";
import { Download, MonitorDown, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";
import { cn } from "@/lib/utils";

interface GuideStep {
  platform: string;
  steps: string[];
}

const GUIDE: GuideStep[] = [
  {
    platform: "Android (Chrome)",
    steps: [
      "Buka menu ⋮ di pojok kanan atas.",
      "Pilih “Pasang aplikasi” atau “Tambahkan ke layar utama”.",
      "Konfirmasi dengan “Pasang”.",
    ],
  },
  {
    platform: "iPhone & iPad (Safari)",
    steps: [
      "Buka halaman ini di Safari.",
      "Ketuk tombol Bagikan (kotak dengan panah).",
      "Pilih “Tambah ke Layar Utama”, lalu “Tambah”.",
    ],
  },
  {
    platform: "Komputer (Chrome / Edge)",
    steps: [
      "Klik ikon pasang  di kolom alamat.",
      "Atau buka menu ⋮ lalu pilih “Install Budget Planner…”.",
      "Konfirmasi pemasangan.",
    ],
  },
];

function GuidanceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 bg-ink/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="dialog-panel fixed left-1/2 top-1/2 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-2xl text-ink">Cara memasang</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Budget Planner dipasang langsung dari peramban — tanpa toko aplikasi.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Tutup">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>
          <ol className="mt-5 space-y-5">
            {GUIDE.map((group) => (
              <li key={group.platform} className="rounded-xl border border-line bg-bg p-4">
                <p className="flex items-center gap-2 font-semibold text-ink">
                  <MonitorDown className="size-4 text-primary" aria-hidden="true" />
                  {group.platform}
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
                  {group.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
          <p className="mt-5 rounded-xl bg-primary-soft p-3 text-sm text-primary-dark">
            Setelah terpasang, buka dari menu aplikasi — tampil di jendelanya sendiri tanpa
            bilah peramban, dan tetap bisa dipakai offline.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function InstallAppButton({
  variant = "primary",
  className,
  compact,
}: {
  variant?: "primary" | "secondary";
  className?: string;
  compact?: boolean;
}) {
  const { canInstall, isInstalled, install } = useInstallPrompt();
  const [guideOpen, setGuideOpen] = useState(false);

  if (isInstalled) {
    return (
      <p
        data-testid="install-installed"
        className={cn(
          "inline-flex items-center gap-2 rounded-xl bg-primary-soft px-4 py-2 text-sm font-semibold text-primary",
          className,
        )}
      >
        Aplikasi sudah terpasang
      </p>
    );
  }

  if (canInstall) {
    return (
      <Button
        data-testid="install-button"
        variant={variant}
        className={className}
        onClick={async () => {
          const outcome = await install();
          if (outcome === "accepted") toast.success("Budget Planner berhasil dipasang");
          else if (outcome === "dismissed") toast("Pemasangan dibatalkan");
          else setGuideOpen(true);
        }}
      >
        <Download className="size-4" />
        {compact ? "Pasang" : "Pasang aplikasi"}
      </Button>
    );
  }

  // No native prompt (Safari, private mode, criteria not met yet): manual
  // guidance instead of a button that would do nothing. Markup must stay
  // identical on server and client — never branch the first paint on
  // browser-only detection (that hydration mismatch re-renders the shell).
  return (
    <>
      <Button
        data-testid="install-guide-button"
        variant="secondary"
        className={className}
        onClick={() => setGuideOpen(true)}
      >
        <Download className="size-4" />
        {compact ? "Cara pasang" : "Cara memasang aplikasi"}
      </Button>
      <GuidanceDialog open={guideOpen} onOpenChange={setGuideOpen} />
    </>
  );
}
