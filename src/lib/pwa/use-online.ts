/**
 * Online/offline detection for the offline indicator.
 *
 * navigator.onLine alone lies in some webviews (it only means "an interface is
 * up"), so we combine it with the browser's online/offline events, which fire
 * on real connectivity changes. SSR renders as online; the first client paint
 * corrects it.
 */
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
