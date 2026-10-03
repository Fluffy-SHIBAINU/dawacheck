import { expect, test } from '@playwright/test';
import { onboard, typeNumber } from './helpers';

test('smoke: onboard and a typed check', async ({ page }) => {
  await onboard(page);
  await typeNumber(page, 'A4-6238');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'green');
});

test('iPhone install hint shows until closed; Android never sees it', async ({ page, browserName }) => {
  await onboard(page);
  const hint = page.getByTestId('install-hint');
  if (browserName !== 'webkit') {
    await expect(hint).toHaveCount(0);
    return;
  }
  await expect(hint).toBeVisible();
  await hint.getByRole('button', { name: 'Close' }).click();
  await expect(hint).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('check-button')).toBeVisible();
  await expect(hint).toHaveCount(0);
});
