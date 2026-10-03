import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { onboard, typeNumber } from './helpers';

test.skip(({ browserName }) => browserName !== 'chromium', 'axe runs once, on Chromium');

async function noSeriousViolations(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${where}: ${v.id} (${v.nodes.length})`)).toEqual([]);
}

test('main screens have no serious accessibility violations', async ({ page }) => {
  await page.goto('/');
  await noSeriousViolations(page, 'welcome');
  await onboard(page);
  for (const path of ['/', '/type', '/history', '/settings', '/find', '/alerts']) {
    await page.goto('/#' + path);
    await page.waitForLoadState('networkidle');
    await noSeriousViolations(page, path);
  }
  await typeNumber(page, 'A4-6238');
  await noSeriousViolations(page, 'result green');
  await typeNumber(page, 'A4-99231');
  await noSeriousViolations(page, 'result red');
});
