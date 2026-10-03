import { expect, test } from '@playwright/test';
import { onboard, typeNumber } from './helpers';

test('smoke: onboard and a typed check', async ({ page }) => {
  await onboard(page);
  await typeNumber(page, 'A4-6238');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'green');
});
