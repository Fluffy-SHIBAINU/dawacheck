import { normalizeNrn } from '../../../src/core/parse/nrn';

test.each([
  ['A4-6238', 'A4-6238'],
  ['a4-100160', 'A4-100160'],
  ['A11-0275', 'A11-0275'],
  ['04 – 1486', '04-1486'],
  ['04- 9502', '04-9502'],
  ['B4-1234', 'B4-1234'],
  ['A1-4924L', 'A1-4924L'],
  [' C4-12345 ', 'C4-12345'],
])('normalizes %s to %s', (raw, expected) => {
  expect(normalizeNrn(raw)).toBe(expected);
});

test.each([['4/1/9086'], ['NA'], ['Not available yet'], [''], ['A11AA'], ['B-7187'], ['04-5112ugo'], [null], [undefined]])(
  'rejects %s',
  (raw) => {
    expect(normalizeNrn(raw as string | null | undefined)).toBeNull();
  },
);
