import { expect, type Page } from '@playwright/test';

export async function onboard(page: Page, lang = 'English', consent = false) {
  await page.goto('/');
  await expect(page.getByText('Choose your language')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: lang, exact: false }).first().click();
  if (consent) await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Continue|Ci gaba/ }).click();
  await expect(page.getByTestId('check-button')).toBeVisible();
}

export const MOCK = 'http://localhost:54321';

export async function typeNumber(page: Page, nrn: string) {
  await page.goto('/#/type');
  await page.getByTestId('nrn-input').fill(nrn);
  await page.getByRole('button', { name: /^Check$/ }).click();
  await expect(page.getByTestId('verdict')).toBeVisible();
}
