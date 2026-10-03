import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWorker, PSM } from 'tesseract.js';
import { parseScan } from '../../src/core/parse';
import { decide } from '../../src/core/verdict';
import { buildRegisterIndex } from '../../src/core/registerIndex';
import { buildConfusion } from '../../src/core/confusion';
import { DEFAULT_THRESHOLDS, type AlertsPack, type RegisterPack } from '../../src/core/types';

const expected = JSON.parse(readFileSync('tests/fixtures/labels/expected.json', 'utf8')) as { file: string; nrn: string; level: string }[];
const register = JSON.parse(readFileSync('public/packs/register.json', 'utf8')) as RegisterPack;
const alerts = JSON.parse(readFileSync('public/packs/alerts.json', 'utf8')) as AlertsPack;
const ctx = { register: buildRegisterIndex(register), alerts: alerts.alerts, flags: new Map(), confusion: buildConfusion([]), today: new Date('2026-10-03T12:00:00Z'), thresholds: DEFAULT_THRESHOLDS };

test('OCR reads the NAFDAC number and reaches the expected verdict on at least 4 of 5 demo cartons', async () => {
  const worker = await createWorker('eng', 1, { langPath: resolve('public/tesseract/lang'), gzip: true, cacheMethod: 'none' });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  let ok = 0;
  for (const e of expected) {
    const { data } = await worker.recognize(resolve('tests/fixtures/labels', e.file));
    const input = parseScan(data.text);
    const verdict = decide(input, ctx);
    const hit = input.nrnCandidates.includes(e.nrn) && verdict.level === e.level;
    if (hit) ok++;
    else console.log(`miss ${e.file}: candidates=${input.nrnCandidates.join(',')} level=${verdict.level}\n${data.text}`);
  }
  await worker.terminate();
  expect(ok).toBeGreaterThanOrEqual(4);
});
