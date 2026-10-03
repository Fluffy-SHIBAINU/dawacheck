import { findExpiry, isExpired, parseDateToken } from '../../../src/core/parse/expiry';
import { findBatch } from '../../../src/core/parse/batch';
import { findStrengths, strengthsConflict, strengthsOverlap } from '../../../src/core/parse/strength';
import { bestTokenSimilarity, nameTokens, productTokens } from '../../../src/core/parse/name';

describe('expiry', () => {
  it.each([
    ['EXP 11/2027', { month: 11, year: 2027 }],
    ['Exp. Date: 03-28', { month: 3, year: 2028 }],
    ['EXPIRY MAR 2028', { month: 3, year: 2028 }],
    ['EXP: SEPT-27', { month: 9, year: 2027 }],
    ['USE BEFORE 2028/01', { month: 1, year: 2028 }],
    ['EXP 15/11/2027', { month: 11, year: 2027 }],
    ['MFG 01/2025 EXP 01/2028', { month: 1, year: 2028 }],
  ])('parses %s', (text, expected) => {
    expect(findExpiry(text)).toEqual(expected);
  });
  it('ignores manufacture dates without an expiry keyword', () => {
    expect(findExpiry('MFG 01/2025')).toBeNull();
    expect(findExpiry('no dates here')).toBeNull();
  });
  it('rejects impossible months', () => {
    expect(parseDateToken('13/2027')).toBeNull();
  });
  it('treats a pack as expired after the last day of its month', () => {
    const today = new Date('2026-10-03T12:00:00Z');
    expect(isExpired({ month: 8, year: 2026 }, today)).toBe(true);
    expect(isExpired({ month: 10, year: 2026 }, today)).toBe(false);
    expect(isExpired({ month: 11, year: 2027 }, today)).toBe(false);
  });
});

describe('batch', () => {
  it.each([
    ['BATCH AE2511 EXP 11/2027', 'AE2511'],
    ['Batch No. AE-2511', 'AE-2511'],
    ['LOT: 12345', '12345'],
    ['B.NO. X77Y', 'X77Y'],
  ])('finds %s', (text, expected) => {
    expect(findBatch(text)).toBe(expected);
  });
  it('returns null when there is no batch or only a keyword follows', () => {
    expect(findBatch('NAFDAC REG. NO. A4-6238')).toBeNull();
    expect(findBatch('BATCH EXP 11/2027')).toBeNull();
  });
});

describe('strength', () => {
  it('reads single and paired strengths', () => {
    expect(findStrengths('Artemether 80 mg + Lumefantrine 480 mg')).toEqual([
      { value: 80, unit: 'MG' },
      { value: 480, unit: 'MG' },
    ]);
    expect(findStrengths('80/480 MG')).toEqual([
      { value: 80, unit: 'MG' },
      { value: 480, unit: 'MG' },
    ]);
    expect(findStrengths('80mg/480mg')).toEqual([
      { value: 80, unit: 'MG' },
      { value: 480, unit: 'MG' },
    ]);
    expect(findStrengths('2 mg/5 ml')).toEqual([
      { value: 2, unit: 'MG' },
      { value: 5, unit: 'ML' },
    ]);
    expect(findStrengths('6 tablets, EXP 09/2027')).toEqual([]);
  });
  it('detects conflicts only when both sides state mg values', () => {
    const reg = findStrengths('80 mg; 480 mg');
    expect(strengthsConflict(findStrengths('20 mg 120 mg'), reg)).toBe(true);
    expect(strengthsConflict(findStrengths('80 mg'), reg)).toBe(false);
    expect(strengthsConflict([], reg)).toBe(false);
    expect(strengthsOverlap(findStrengths('80 mg'), reg)).toBe(true);
    expect(strengthsOverlap(findStrengths('20 mg'), reg)).toBe(false);
  });
});

describe('name tokens', () => {
  it('keeps distinctive words of 4+ letters and drops packaging words', () => {
    expect(nameTokens('ARTHEGET EZ\n6 tablets\nNAFDAC REG. NO. A4-6238\nDEMO PACK')).toEqual(['ARTHEGET']);
    expect(nameTokens('Menofix Composition')).toEqual(['MENOFIX', 'COMPOSITION']);
  });
  it('falls back to 3-letter words for very short product names', () => {
    expect(productTokens('ACT')).toEqual(['ACT']);
    expect(productTokens('Artheget EZ')).toEqual(['ARTHEGET']);
  });
  it('scores the best token match', () => {
    expect(bestTokenSimilarity(['ARTHEGET'], ['MALAQUICK', 'ARTHEGFT'])).toBeCloseTo(0.875, 3);
    expect(bestTokenSimilarity([], ['X'])).toBe(0);
  });
});
