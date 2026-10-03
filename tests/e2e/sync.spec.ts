import { expect, test } from '@playwright/test';
import { MOCK, onboard, typeNumber } from './helpers';

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__reset`);
});

test('a queued report uploads when the connection returns', async ({ page, context, request }) => {
  await onboard(page, 'English', true);
  await context.setOffline(true);
  await typeNumber(page, 'A4-99231');
  await page.getByTestId('report-link').click();
  await page.getByRole('button', { name: 'Save report' }).click();
  await expect(page.getByText(/Reports waiting: 1/)).toBeVisible();
  await context.setOffline(false);
  await expect.poll(async () => (await (await request.get(`${MOCK}/__state`)).json()).reports, { timeout: 30_000 }).toBe(1);
  await expect.poll(async () => (await (await request.get(`${MOCK}/__state`)).json()).events, { timeout: 30_000 }).toBeGreaterThan(0);
});

test('Sync now in settings uploads immediately', async ({ page, request }) => {
  await onboard(page, 'English', false);
  await typeNumber(page, 'A4-99231');
  await page.getByTestId('report-link').click();
  await page.getByRole('button', { name: 'Save report' }).click();
  await page.goto('/#/settings');
  await page.getByTestId('sync-now').click();
  await expect.poll(async () => (await (await request.get(`${MOCK}/__state`)).json()).reports, { timeout: 30_000 }).toBe(1);
  expect((await (await request.get(`${MOCK}/__state`)).json()).events).toBe(0);
});
