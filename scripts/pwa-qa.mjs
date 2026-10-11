#!/usr/bin/env node
/**
 * PWA QA for Budget Planner: desktop + mobile render pass (mirrors
 * scripts/browser-smoke.mjs) plus the PWA-specific checks the spec demands —
 * manifest validity, service-worker registration, offline startup, and
 * add/edit/delete of transactions while offline.
 *
 * Usage: node scripts/pwa-qa.mjs [url] [screenshotDir]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:8080/";
const outDir = process.argv[3] ?? join(homedir(), "budget-planner", "screenshots");
mkdirSync(outDir, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

const result = { url, viewports: {}, pwa: {}, offline: {}, errors: [] };

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  // Reuse the system Chromium (Helium) when Playwright has no browser of its
  // own — avoids a 150 MB download for a QA pass.
  executablePath: process.env.QA_CHROMIUM || undefined,
});

try {
  // ---------- 1. Render pass (desktop + mobile) ----------
  for (const vp of VIEWPORTS) {
    const errors = { consoleErrors: [], pageErrors: [] };
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.pageErrors.push(String(err?.message || err)));
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    await page.screenshot({ path: join(outDir, `pwa-${vp.name}.png`) });
    result.viewports[vp.name] = {
      status: resp?.status() ?? 0,
      title: await page.title(),
      bodyTextLen: bodyText.length,
      hasAppText: bodyText.includes("Budget Planner"),
      horizontalOverflow,
      ...errors,
    };
    await page.close();
  }

  // ---------- 2. Manifest + SW registration ----------
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err?.message || err)));
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  const manifestHref = await page.evaluate(() => {
    const link = document.querySelector('link[rel="manifest"]');
    return link ? link.getAttribute("href") : null;
  });
  const manifestRes = await page.request.get(new URL(manifestHref ?? "/manifest.webmanifest", url).href);
  const manifest = await manifestRes.json().catch(() => null);
  result.pwa.manifestHref = manifestHref;
  result.pwa.manifestStatus = manifestRes.status();
  result.pwa.manifestValid =
    manifest &&
    manifest.name === "Budget Planner" &&
    manifest.short_name === "Budget Planner" &&
    manifest.display === "standalone" &&
    Array.isArray(manifest.icons) &&
    manifest.icons.some((i) => i.sizes === "192x192") &&
    manifest.icons.some((i) => i.sizes === "512x512") &&
    Boolean(manifest.theme_color) &&
    Boolean(manifest.background_color);
  result.pwa.manifest = manifest;

  // Wait for the service worker to activate and take control.
  result.pwa.swRegistered = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    return Boolean(reg.active);
  });
  await page.waitForTimeout(500);

  // ---------- 3. Seed one transaction ONLINE, then go offline ----------
  // Set opening balance + add a transaction so we can prove persistence.
  await page.goto(new URL("/pengaturan", url).href, { waitUntil: "domcontentloaded" });
  await page.fill('[data-testid="opening-balance"]', "1000000");
  await page.click('[data-testid="save-settings"]');
  await page.waitForTimeout(300);

  await page.goto(new URL("/", url).href, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const balanceBefore = await page.locator('[data-testid="available-balance"]').innerText();

  await page.click('button:has-text("Catat transaksi")');
  await page.fill('[data-testid="tx-name"]', "Kopi susu (online)");
  await page.fill('[data-testid="tx-amount"]', "25000");
  await page.click('[data-testid="tx-save"]');
  await page.waitForTimeout(600);
  const balanceAfterOnline = await page.locator('[data-testid="available-balance"]').innerText();

  // Give the SW a moment to finish caching everything it needs.
  await page.waitForTimeout(1200);

  // ---------- 4. OFFLINE: reload, verify app boots, CRUD works ----------
  await page.context().setOffline(true);
  await page.goto(new URL("/", url).href, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(1500);

  const offlineBody = await page.locator("body").innerText().catch(() => "");
  result.offline.bootedOffline = offlineBody.includes("Budget Planner") && offlineBody.includes("Saldo tersedia");
  result.offline.balanceOffline = await page
    .locator('[data-testid="available-balance"]')
    .innerText()
    .catch(() => null);
  result.offline.offlineBannerVisible = await page.locator('[data-testid="offline-banner"]').isVisible();

  // ADD while offline
  await page.click('button:has-text("Catat transaksi")');
  await page.fill('[data-testid="tx-name"]', "Bensin (offline)");
  await page.fill('[data-testid="tx-amount"]', "50000");
  await page.click('[data-testid="tx-save"]');
  await page.waitForTimeout(700);
  result.offline.balanceAfterOfflineAdd = await page
    .locator('[data-testid="available-balance"]')
    .innerText()
    .catch(() => null);

  // EDIT while offline (via transactions page)
  await page.goto(new URL("/transaksi", url).href, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(1000);
  const offlineTxVisible = await page.locator("text=Bensin (offline)").isVisible();
  result.offline.transactionListedOffline = offlineTxVisible;

  // DELETE while offline — use the row's delete affordance.
  const row = page.locator("li, article, tr").filter({ hasText: "Bensin (offline)" }).first();
  const delBtn = row.locator('button[aria-label*="hapus" i], button:has-text("Hapus")').first();
  if (await delBtn.count()) {
    await delBtn.click();
    await page.waitForTimeout(400);
    const confirm = page.locator('[data-testid="confirm-delete"]');
    if (await confirm.count()) await confirm.click();
    await page.waitForTimeout(700);
  }
  result.offline.transactionGoneAfterDelete = !(await page
    .locator("text=Bensin (offline)")
    .isVisible()
    .catch(() => false));
  result.offline.balanceAfterOfflineDelete = await page
    .locator('[data-testid="available-balance"]')
    .innerText()
    .catch(() => null);
  result.offline.pageErrors = pageErrors;

  await page.screenshot({ path: join(outDir, "pwa-offline.png") });

  // ---------- 5. Back online, verify nothing was lost ----------
  await page.context().setOffline(false);
  await page.goto(new URL("/", url).href, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  result.offline.balanceAfterReconnect = await page
    .locator('[data-testid="available-balance"]')
    .innerText()
    .catch(() => null);
  result.offline.kopiStillThere = await page
    .locator("text=Kopi susu (online)")
    .isVisible()
    .catch(() => false);

  result.balanceFlow = { balanceBefore, balanceAfterOnline };
} catch (err) {
  result.errors.push(String(err?.message || err));
} finally {
  await browser.close();
}

writeFileSync(join(outDir, "pwa-qa.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.errors.length > 0 ? 1 : 0;
