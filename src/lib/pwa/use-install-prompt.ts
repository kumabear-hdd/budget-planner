/**
 * BeforeInstallPrompt plumbing for the Install App flow.
 *
 * Chromium fires `beforeinstallprompt` when the app meets installability
 * criteria (valid manifest + active service worker + HTTPS/localhost). We
 * stash the event so a later button press can call prompt(). Safari (iOS /
 * macOS) never fires it — `supported` stays false there and the UI falls back
 * to per-platform manual guidance instead of showing a dead button.
 *
 * `isInstalled` covers standalone display mode: once launched from the
 * home screen / app list the install button must not reappear (a misleading
 * second prompt is an explicit spec violation).
 */
import { useCallback, useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Chromium requires preventDefault() before the mini-infobar appears; we
    // own the install UX via our own button.
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mediaStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return mediaStandalone || iosStandalone === true;
}

export interface InstallPromptState {
  /** A native install prompt is captured and ready to show. */
  canInstall: boolean;
  /** The app already runs installed — never show an install action. */
  isInstalled: boolean;
  /** The browser supports the install-prompt API at all (false on Safari). */
  supportsPrompt: boolean;
  /** Runs the native prompt; resolves with the user's choice. */
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

export function useInstallPrompt(): InstallPromptState {
  const [promptAvailable, setPromptAvailable] = useState(deferredPrompt !== null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const update = () => {
      setPromptAvailable(deferredPrompt !== null);
      setInstalled(isStandalone());
    };
    listeners.add(update);
    update();
    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener("change", update);
    return () => {
      listeners.delete(update);
      media.removeEventListener("change", update);
    };
  }, []);

  const install = useCallback(async () => {
    const event = deferredPrompt;
    if (!event) return "unavailable" as const;
    // Clear before prompting: the event can only be used once.
    deferredPrompt = null;
    setPromptAvailable(false);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      return choice.outcome;
    } catch {
      return "dismissed" as const;
    }
  }, []);

  return {
    canInstall: promptAvailable && !installed,
    isInstalled: installed,
    supportsPrompt: typeof window !== "undefined" && "onbeforeinstallprompt" in window,
    install,
  };
}
