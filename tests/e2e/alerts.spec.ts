import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('browse and search NAFDAC alerts offline', async ({ page, context }) => {
  await onboard(page);
  await page.getByRole('link', { name: /NAFDAC alerts \(\d+\)/ }).click();
  await context.setOffline(true);
  await page.getByTestId('alerts-input').fill('menofix');
  await page.getByRole('link', { name: /Menofix/i }).first().click();
  await expect(page.getByRole('heading', { name: /035\/2026/ })).toBeVisible();
  await expect(page.getByTestId('alert-product')).toContainText('Menofix Composition');
  await expect(page.getByRole('link', { name: /nafdac\.gov\.ng/ })).toBeVisible();
  await context.setOffline(false);
});
