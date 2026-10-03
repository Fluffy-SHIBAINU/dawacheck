import { manualInput, parseScan } from '../../../src/core/parse';
import { buildRegisterIndex, lookup } from '../../../src/core/registerIndex';
import { buildConfusion, nrnVariants } from '../../../src/core/confusion';
import { DEMO_TEXT, REGISTER } from '../../helpers/fixtures';

test('parseScan extracts everything from a demo label', () => {
  expect(parseScan(DEMO_TEXT.green)).toEqual({
    source: 'ocr',
    nrnCandidates: ['A4-6238'],
    text: DEMO_TEXT.green,
    strengths: [
      { value: 80, unit: 'MG' },
      { value: 480, unit: 'MG' },
    ],
    batch: 'AE2511',
    expiry: { month: 11, year: 2027 },
  });
});

test('manualInput normalizes typed numbers and rejects junk', () => {
  expect(manualInput('a4 6238')).toMatchObject({ source: 'manual', nrnCandidates: ['A4-6238'], text: '' });
  expect(manualInput('nonsense')).toBeNull();
});

test('register index groups duplicate numbers', () => {
  const idx = buildRegisterIndex(REGISTER);
  expect(idx.size).toBe(7);
  expect(idx.version).toBe('2026-10-03');
  expect(lookup(idx, 'A11-0275').map((p) => p.name)).toEqual(['Coflu Syrup', 'Coflu Tablets']);
  expect(lookup(idx, 'NOPE-1')).toEqual([]);
});

test('register index collects generic ingredient words', () => {
  const idx = buildRegisterIndex(REGISTER);
  for (const w of ['ARTEMETHER', 'LUMEFANTRINE', 'AMOXICILLIN', 'PARACETAMOL', 'DAPAGLIFLOZIN']) expect(idx.generic.has(w)).toBe(true);
  expect(idx.generic.has('ARTHEGET')).toBe(false);
});

test('buildConfusion boosts learned character swaps', () => {
  const t = buildConfusion([{ read: 'A4-6239', corrected: 'A4-6238', n: 3 }]);
  expect(t.get('9>8')).toBeGreaterThan(t.get('3>8') ?? 0);
});

test('nrnVariants finds registered neighbours one edit away, best first', () => {
  const idx = buildRegisterIndex(REGISTER);
  const learned = buildConfusion([{ read: 'A4-6239', corrected: 'A4-6238', n: 3 }]);
  const v = nrnVariants('A4-6299', idx, learned);
  expect(v.map((x) => x.nrn)).toEqual(expect.arrayContaining(['A4-6298']));
  const v2 = nrnVariants('A4-6239', idx, learned);
  expect(v2[0].nrn).toBe('A4-6238');
  expect(nrnVariants('A4-99231', idx, learned)).toEqual([]);
});
