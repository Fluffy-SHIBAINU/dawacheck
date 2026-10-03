import { expect, type Page } from '@playwright/test';

export async function onboard(page: Page, lang = 'English') {
  await page.goto('/');
  await expect(page.getByText('Choose your language')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: lang, exact: false }).first().click();
  await page.getByRole('button', { name: /Continue|Ci gaba|Continue/ }).click();
  await expect(page.getByTestId('check-button')).toBeVisible();
}

export async function typeNumber(page: Page, nrn: string) {
  await page.goto('/#/type');
  await page.getByTestId('nrn-input').fill(nrn);
  await page.getByRole('button', { name: /^Check$/ }).click();
  await expect(page.getByTestId('verdict')).toBeVisible();
}
