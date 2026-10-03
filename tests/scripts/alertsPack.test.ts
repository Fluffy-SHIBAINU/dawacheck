import { readFileSync } from 'node:fs';
import type { AlertsPack } from '../../src/core/types';

test('real alerts pack is well formed and includes the Menofix unregistered alert', () => {
  const pack = JSON.parse(readFileSync('public/packs/alerts.json', 'utf8')) as AlertsPack;
  expect(pack.alerts.length).toBeGreaterThanOrEqual(20);
  for (const a of pack.alerts) {
    expect(a.id).toMatch(/^(\d{3}\/\d{4}|wp-\d+)$/);
    expect(a.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(a.products.length).toBeGreaterThan(0);
  }
  const menofix = pack.alerts.find((a) => a.products.some((p) => /menofix/i.test(p.brand ?? '')));
  expect(menofix?.kind).toBe('unregistered');
});
