import { expect, test } from '@playwright/test';
import { onboard, typeNumber } from './helpers';

test('works with no network after the first load, and queues a report', async ({ page, context }) => {
  test.setTimeout(120_000);
  await onboard(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 30_000 }).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('status-pill')).toContainText('No internet');
  await typeNumber(page, 'A4-6238');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'green');

  await typeNumber(page, 'A4-99231');
  await page.getByTestId('report-link').click();
  await page.getByRole('button', { name: 'Save report' }).click();
  await expect(page.getByText(/Reports waiting: 1/)).toBeVisible();
  await context.setOffline(false);
});

test('a photo is read with no network on a cold start (OCR files come from the offline cache)', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'one cold-start OCR run is enough');
  test.setTimeout(150_000);
  await onboard(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 30_000 }).toBe(true);

  await context.setOffline(true);
  await page.reload(); // no OCR worker is alive yet, so its scripts and model must come from the cache
  await page.getByTestId('photo-input').setInputFiles('tests/fixtures/labels/2.png');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'amber', { timeout: 90_000 });
  await context.setOffline(false);
});

test('a photo is read with no network on the first visit, without any reload', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'one first-visit OCR run is enough');
  test.setTimeout(150_000);
  await onboard(page);
  // The service worker takes control of this first page mid-visit (clientsClaim); no reload happens.
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 60_000 }).toBe(true);
  await context.setOffline(true);
  await page.getByTestId('photo-input').setInputFiles('tests/fixtures/labels/2.png');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'amber', { timeout: 90_000 });
  await context.setOffline(false);
});
