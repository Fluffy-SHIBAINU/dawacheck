import { expect, test } from '@playwright/test';
import { onboard, typeNumber } from './helpers';

test('report a red box offline-style and see the queue', async ({ page }) => {
  await onboard(page);
  await typeNumber(page, 'A4-99231');
  await page.getByTestId('report-link').click();
  await page.getByRole('button', { name: 'Save report' }).click();
  await expect(page.getByTestId('report-saved')).toBeVisible();
  await expect(page.getByText(/Reports waiting: 1/)).toBeVisible();
  await page.goto('/#/history');
  await expect(page.locator('.list a')).toHaveCount(1);
  await page.goto('/#/settings');
  await expect(page.getByTestId('data-card')).toContainText('Register:');
});
