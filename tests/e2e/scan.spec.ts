import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('photo of carton 1 reads on the device and shows green', async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  await page.getByTestId('photo-input').setInputFiles('tests/fixtures/labels/1.png');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'green', { timeout: 90_000 });
  await expect(page.getByRole('heading', { name: 'Artheget EZ' })).toBeVisible();
});

test('photo of carton 2 is amber', async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  await page.getByTestId('photo-input').setInputFiles('tests/fixtures/labels/2.png');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'amber', { timeout: 90_000 });
});

test('a sideways photo of carton 1 is turned and still reads green', async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  await page.getByTestId('photo-input').setInputFiles('tests/fixtures/labels/1-rot90.png');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'green', { timeout: 90_000 });
  await expect(page.getByRole('heading', { name: 'Artheget EZ' })).toBeVisible();
});
