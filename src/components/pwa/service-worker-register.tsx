/**
 * Service-worker registration + update flow.
 *
 * Registers /sw.js after mount (never during SSR), and when a new worker is
 * waiting offers a toast to apply it: SKIP_WAITING → controllerchange → one
 * reload so the user always sees the fresh shell instead of a half-old page.
 * Financial data is untouched by updates — it lives in IndexedDB, not caches.
 */
import { useEffect } from "react";
import { toast } from "sonner";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Reload only when an UPDATED worker takes over. The very first
    // install also fires controllerchange (via clients.claim) — reloading
    // there would bounce the page right after first paint for no reason.
    let hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    const onControllerChange = () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let registration: ServiceWorkerRegistration | null = null;

    const offerUpdate = (worker: ServiceWorker) => {
      toast("Pembaruan aplikasi tersedia", {
        description: "Muat ulang untuk memakai versi terbaru.",
        action: {
          label: "Muat ulang",
          onClick: () => worker.postMessage({ type: "SKIP_WAITING" }),
        },
        duration: 12000,
      });
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        registration = reg;
        if (reg.waiting && navigator.serviceWorker.controller) {
          offerUpdate(reg.waiting);
        }
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // "installed" with an existing controller means a new version is
            // waiting; without one it's the very first install.
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              offerUpdate(installing);
            }
          });
        });
      })
      .catch(() => {
        /* registration failure must never break the app (e.g. unsupported) */
      });

    // Re-check for updates when the tab comes back to the foreground.
    const onVisible = () => {
      if (document.visibilityState === "visible") registration?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
