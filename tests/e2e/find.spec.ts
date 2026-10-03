import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('find a medicine by name and read what NAFDAC registered', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Find a medicine by name' }).click();
  await page.getByTestId('find-input').fill('artheget');
  await page.getByRole('link', { name: /Artheget EZ/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Artheget EZ' }).first()).toBeVisible();
  await expect(page.getByText('A4-6238').first()).toBeVisible();
  await expect(page.getByText('This is what NAFDAC registered.', { exact: false })).toBeVisible();
});
