import { readFileSync } from 'node:fs';
import type { RegisterPack } from '../../src/core/types';

test('real register pack has NAFDAC products including A4-6238', () => {
  const pack = JSON.parse(readFileSync('public/packs/register.json', 'utf8')) as RegisterPack;
  expect(pack.source).toBe('NAFDAC Greenbook');
  expect(pack.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(pack.products.length).toBeGreaterThan(8000);
  const p = pack.products.find((x) => x.nrn === 'A4-6238');
  expect(p?.name).toBe('Artheget EZ');
  expect(p?.strength).toBe('80 mg; 480 mg');
  expect(pack.products.some((x) => x.nrn === 'A4-99231')).toBe(false);
  expect(pack.products.some((x) => x.nrn === 'A4-0999')).toBe(false);
});
