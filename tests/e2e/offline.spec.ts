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
