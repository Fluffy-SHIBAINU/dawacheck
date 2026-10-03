import { CARTONS, cartonHtml, cartonText } from '../../src/demo/cartons';
import { decide } from '../../src/core/verdict';
import { parseScan } from '../../src/core/parse';
import { buildRegisterIndex } from '../../src/core/registerIndex';
import { buildConfusion } from '../../src/core/confusion';
import { DEFAULT_THRESHOLDS } from '../../src/core/types';
import { ALERTS, DEMO_TEXT, REGISTER, TODAY } from '../helpers/fixtures';

const ctx = { register: buildRegisterIndex(REGISTER), alerts: ALERTS, flags: new Map(), confusion: buildConfusion([]), today: TODAY, thresholds: DEFAULT_THRESHOLDS };

test('five cartons whose text equals the engine fixtures', () => {
  expect(CARTONS.map((c) => c.n)).toEqual([1, 2, 3, 4, 5]);
  for (const c of CARTONS) expect(cartonText(c)).toBe(DEMO_TEXT[c.key]);
});

test.each(CARTONS.map((c) => [c.n, c] as const))('carton %i gives its expected verdict', (_n, c) => {
  expect(decide(parseScan(cartonText(c)), ctx).level).toBe(c.expected);
});

test('carton html carries the number and a demo marker', () => {
  const html = cartonHtml(CARTONS[0]);
  expect(html).toContain('A4-6238');
  expect(html).toContain('DEMO PACK');
});
