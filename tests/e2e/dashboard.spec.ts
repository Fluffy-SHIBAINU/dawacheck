import { expect, test } from '@playwright/test';
import { MOCK } from './helpers';

test('dashboard shows reports by state from the backend', async ({ page, request }) => {
  await request.post(`${MOCK}/__reset`);
  const now = new Date().toISOString();
  await request.post(`${MOCK}/__seed`, {
    data: { reports: [1, 2, 3].map((i) => ({ id: `d${i}`, device_id: `p${i}`, created_at: now, nrn: 'A4-99231', reason: 'not_in_register', verdict: 'red', state: 'KN' })) },
  });
  await page.goto('/#/dashboard');
  await expect(page.getByTestId('dashboard')).toContainText('Kano');
  await expect(page.getByTestId('dashboard')).toContainText('A4-99231');
  await expect(page.getByText(/Example data/)).toBeVisible();
});
