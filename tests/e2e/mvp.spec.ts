import { expect, test } from '@playwright/test';
import { onboard, typeNumber } from './helpers';

test('first run, then a registered number is green', async ({ page }) => {
  await onboard(page);
  await typeNumber(page, 'A4-6238');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'green');
  await expect(page.getByText('Registered with NAFDAC')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Artheget EZ' })).toBeVisible();
});

test('a number missing from the register is red', async ({ page }) => {
  await onboard(page);
  await typeNumber(page, 'A4-99231');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'red');
  await expect(page.getByText('Do not take this medicine')).toBeVisible();
});

test('Hausa interface', async ({ page }) => {
  await onboard(page, 'Hausa');
  await expect(page.getByText('Duba magani')).toBeVisible();
});
