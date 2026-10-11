/**
 * Persistent offline indicator.
 *
 * A slim status bar pinned under the app header: amber "Anda offline" with a
 * plain-language reassurance (data tetap tersimpan di perangkat), gone again
 * on reconnect. Also fires a one-shot toast on each transition so a change
 * noticed mid-scroll isn't missed.
 */
import { useEffect, useRef } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useOnline } from "@/lib/pwa/use-online";

export function OfflineBanner() {
  const online = useOnline();
  const wasOnline = useRef(online);

  useEffect(() => {
    if (wasOnline.current === online) return;
    wasOnline.current = online;
    if (online) {
      toast.success("Tersambung kembali");
    } else {
      toast("Anda offline — data tetap tersimpan di perangkat", {
        description: "Transaksi baru bisa dicatat dan langsung dihitung.",
      });
    }
  }, [online]);

  if (online) return null;

  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="flex items-center justify-center gap-2 bg-expense-soft px-4 py-2 text-center text-sm font-semibold text-expense"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      <span>
        Mode offline — transaksi tetap bisa dicatat dan langsung dihitung di perangkat ini.
      </span>
    </div>
  );
}
