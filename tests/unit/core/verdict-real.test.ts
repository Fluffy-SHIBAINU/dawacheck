import { readFileSync } from 'node:fs';
import { decide } from '../../../src/core/verdict';
import { parseScan } from '../../../src/core/parse';
import { buildRegisterIndex } from '../../../src/core/registerIndex';
import { buildConfusion } from '../../../src/core/confusion';
import { DEFAULT_THRESHOLDS, type AlertsPack, type RegisterPack } from '../../../src/core/types';
import { DEMO_TEXT, TODAY } from '../../helpers/fixtures';

const register = JSON.parse(readFileSync('public/packs/register.json', 'utf8')) as RegisterPack;
const alerts = JSON.parse(readFileSync('public/packs/alerts.json', 'utf8')) as AlertsPack;
const c = {
  register: buildRegisterIndex(register),
  alerts: alerts.alerts,
  flags: new Map(),
  confusion: buildConfusion([]),
  today: TODAY,
  thresholds: DEFAULT_THRESHOLDS,
};

test.each([
  ['green', 'green'],
  ['mismatch', 'amber'],
  ['notfound', 'red'],
  ['expired', 'red'],
  ['alert', 'red'],
] as const)('demo %s gives %s with the real packs', (key, level) => {
  const v = decide(parseScan(DEMO_TEXT[key]), c);
  if (v.level !== level) console.log(key, v.level, v.reasons, v.alert?.id, v.alert?.products[0]?.brand);
  expect(v.level).toBe(level);
});
