/*
 * Budget Planner service worker.
 *
 * Strategy: app-shell caching so the interface loads offline after the first
 * successful visit. Financial data never lives here — transactions sit in
 * IndexedDB on the device, and no authenticated API response is cached.
 *
 * - Navigations: network-first, cached shell as offline fallback (SPA — the
 *   cached "/" bundle client-routes to any path).
 * - /assets/* (content-hashed build output): cache-first, immutable.
 * - Other same-origin static files (dev modules, icons, favicon, manifest):
 *   stale-while-revalidate; Vite cache-busts changed modules with ?t=.
 * - Google Fonts: cached so typography survives offline.
 * - Never cached: non-GET, /api/, /auth/, /__grok/ platform pages.
 */

const VERSION = "bp-v1";
const SHELL_CACHE = `bp-shell-${VERSION}`;
const RUNTIME_CACHE = `bp-runtime-${VERSION}`;
const FONT_CACHE = `bp-fonts-${VERSION}`;
const KEEP = new Set([SHELL_CACHE, RUNTIME_CACHE, FONT_CACHE]);

const SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Add individually: one missing file must not fail the whole install.
      await Promise.all(
        SHELL_URLS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }));
          } catch {
            /* offline or 404 during install — the runtime cache covers it later */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !KEEP.has(key)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

function isNeverCache(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/__grok/")
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (isNeverCache(url)) return;

  // Navigations: network-first, cached app shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(networkFirstShell(request));
    return;
  }

  if (sameOrigin(url)) {
    // /assets/* is content-hashed in the production build — immutable.
    if (url.pathname.startsWith("/assets/")) {
      event.respondWith(cacheFirst(request));
      return;
    }
    // Everything else same-origin: stale-while-revalidate.
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  // Google Fonts (CSS + woff2): keep typography offline.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
  }
});

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put("/", response.clone());
    }
    return response;
  } catch {
    const cached = (await cache.match(request)) || (await cache.match("/"));
    if (cached) return cached;
    return new Response(
      "Anda sedang offline dan aplikasi belum pernah dimuat di peramban ini. Sambungkan internet lalu muat ulang halaman.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === "opaque")) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  if (cached) return cached;
  const response = await network;
  if (response) return response;
  return new Response("", { status: 504 });
}
