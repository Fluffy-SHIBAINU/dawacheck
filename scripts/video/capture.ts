// Captures real screens of the live app for the demo video (iPhone 14 viewport, then a laptop dashboard).
// The flow is the real demo: onboard in Hausa with State = Kano, go offline, scan cartons, report one,
// come back online (the report syncs to Supabase), then open the regulator dashboard.
import { mkdirSync } from 'node:fs';
import { chromium, devices, type Page } from '@playwright/test';

const BASE = process.env.DEMO_URL ?? 'https://dawacheck-smoky.vercel.app';
const OUT = 'media/shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 14'] });
const page = await ctx.newPage();
const shot = async (name: string) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
};
const setLang = async (p: Page, code: string) => {
  await p.goto(`${BASE}/#/settings`);
  await p.locator('select').first().selectOption(code);
  await p.waitForTimeout(400);
  await p.goto(`${BASE}/#/`);
};
const scan = async (file: string) => {
  await page.goto(`${BASE}/#/`);
  await page.getByTestId('photo-input').setInputFiles(`tests/fixtures/labels/${file}`);
};

await page.goto(BASE);
await page.getByText('Choose your language').waitFor({ timeout: 60_000 });
await shot('01-welcome');
await page.getByRole('button', { name: 'Hausa' }).click();
await page.locator('select').first().selectOption('KN');
await page.getByRole('button', { name: /Ci gaba|Continue/ }).click();
await page.getByTestId('sync-summary').waitFor({ timeout: 60_000 });
const hint = page.getByTestId('install-hint');
if (await hint.count()) await hint.getByRole('button').click();
await shot('02-home-ha-first-sync');

// Like the iPhone checklist's "wait 30 seconds": the service worker caches every offline file and,
// on this first visit, the OCR engine warms up while still online.
await page.waitForFunction(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!navigator.serviceWorker.controller || reg?.active?.state !== 'activated' || reg.installing) return false;
  let tess = 0, voice = 0;
  for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) {
    if (r.url.includes('/tesseract/')) tess++;
    if (r.url.includes('/voice/')) voice++;
  }
  return tess >= 4 && voice >= 42;
}, undefined, { timeout: 180_000, polling: 1000 });
await page.waitForTimeout(8000);

await ctx.setOffline(true);
await page.waitForTimeout(800);
await page.evaluate(() => window.scrollTo(0, 0));
await shot('03-home-ha-offline');

await scan('1.png');
await page.getByTestId('ocr-progress').waitFor({ timeout: 10_000 });
await page.waitForTimeout(300);
await shot('04-scan-reading');
await page.getByTestId('verdict').waitFor({ timeout: 90_000 });
await page.evaluate(() => window.scrollTo(0, 0));
await shot('05-green-ha');

await setLang(page, 'en');
await scan('2.png');
await page.getByTestId('verdict').waitFor({ timeout: 90_000 });
await page.evaluate(() => window.scrollTo(0, 0));
await shot('06-amber-en');
await page.getByTestId('report-link').click();
await page.getByRole('button', { name: 'Save report' }).waitFor();
await shot('07-report');
await page.getByRole('button', { name: 'Save report' }).click();
await page.getByTestId('report-saved').waitFor();
await shot('08-report-saved');

await setLang(page, 'pcm');
await scan('5.png');
await page.getByTestId('verdict').waitFor({ timeout: 90_000 });
await page.evaluate(() => window.scrollTo(0, 0));
await shot('09-red-pcm');
await page.getByTestId('alert-link').click();
await page.getByRole('heading').first().waitFor();
await shot('10-alert-detail-pcm');

await setLang(page, 'en');
await page.goto(`${BASE}/#/find`);
await page.getByTestId('find-input').fill('artheget');
await shot('11-find-en');
await page.goto(`${BASE}/#/alerts`);
await page.getByTestId('alerts-input').fill('menofix');
await shot('12-alerts-en');

await page.goto(`${BASE}/#/`);
await ctx.setOffline(false);
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await page.getByTestId('sync-summary').filter({ hasText: /Sent 1 report/ }).waitFor({ timeout: 60_000 });
await shot('13-home-en-synced');

const desk = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2 });
const d = await desk.newPage();
await d.goto(`${BASE}/#/dashboard`);
await d.getByTestId('dashboard').filter({ hasText: 'Kano' }).waitFor({ timeout: 60_000 });
await d.waitForTimeout(800);
await d.screenshot({ path: `${OUT}/14-dashboard.png` });
console.log('shot 14-dashboard');
await browser.close();
