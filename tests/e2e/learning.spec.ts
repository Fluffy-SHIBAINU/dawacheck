import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { MOCK, onboard, typeNumber } from './helpers';

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__reset`);
});

test('reports from other phones turn a registered number amber after sync', async ({ page, request }) => {
  const now = new Date().toISOString();
  await request.post(`${MOCK}/__seed`, {
    data: {
      reports: ['p1', 'p2', 'p1'].map((d, i) => ({ id: `seed-${i}`, device_id: d, created_at: now, nrn: 'A4-6238', reason: 'name_mismatch', verdict: 'amber', state: 'KN' })),
    },
  });
  await onboard(page);
  await page.goto('/#/settings');
  await page.getByTestId('sync-now').click();
  await expect(page.getByTestId('data-card')).toContainText('Community flags: 1');
  await typeNumber(page, 'A4-6238');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'amber');
  await expect(page.getByText('Other users reported this number recently (3 reports).')).toBeVisible();
});

test('a newer register published to storage is downloaded on sync', async ({ page, request }) => {
  const reg = JSON.parse(readFileSync('public/packs/register.json', 'utf8'));
  const alerts = readFileSync('public/packs/alerts.json', 'utf8');
  const newer = JSON.stringify({ ...reg, version: '2099-01-01' });
  const sha = (s: string) => createHash('sha256').update(s).digest('hex');
  const alertsVersion = JSON.parse(alerts).version;
  const manifest = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    packs: {
      register: { version: '2099-01-01', file: 'register.json', sha256: sha(newer), count: reg.products.length, bytes: newer.length },
      alerts: { version: alertsVersion, file: 'alerts.json', sha256: sha(alerts), count: 0, bytes: alerts.length },
    },
  };
  await request.post(`${MOCK}/__seed`, { data: { storage: { 'register.json': newer, 'alerts.json': alerts, 'manifest.json': JSON.stringify(manifest) } } });
  await onboard(page);
  await page.goto('/#/settings');
  await page.getByTestId('sync-now').click();
  await expect(page.getByTestId('register-version')).toHaveText('2099-01-01', { timeout: 30_000 });
});
