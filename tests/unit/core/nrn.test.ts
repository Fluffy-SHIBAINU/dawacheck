import { findNrnCandidates, manualCandidates } from '../../../src/core/parse/nrn';

const nrns = (t: string) => findNrnCandidates(t).map((c) => c.nrn);

describe('findNrnCandidates', () => {
  it('finds a clean number next to the NAFDAC keyword with top score', () => {
    const c = findNrnCandidates('NAFDAC REG. NO. A4-6238');
    expect(c[0]).toMatchObject({ nrn: 'A4-6238', score: 2 });
  });
  it('handles spaces around the hyphen and missing hyphen near the keyword', () => {
    expect(nrns('NAFDAC REG NO: A4 - 6238')[0]).toBe('A4-6238');
    expect(nrns('NAFDAC REG NO A4 6238')[0]).toBe('A4-6238');
  });
  it('fixes letters misread as digits', () => {
    expect(nrns('NAFDAC REG. NO. A4-623B')[0]).toBe('A4-6238');
    expect(nrns('NAFDAC NO. O4-1486')[0]).toBe('04-1486');
  });
  it('offers both readings when the last character may be a letter suffix', () => {
    expect(nrns('NAFDAC NO A1-4924L')).toEqual(expect.arrayContaining(['A1-4924L', 'A1-49241']));
  });
  it('ignores dates on expiry and manufacture lines', () => {
    expect(nrns('EXP 03-2028')).toEqual([]);
    expect(nrns('MFG 01-2025\nNAFDAC REG NO A4-6238')).toEqual(['A4-6238']);
  });
  it('ranks the keyword line first when several numbers appear', () => {
    expect(nrns('ARTHEGET\nNAFDAC REG. NO. A4-6238\nDISTRIBUTOR CODE B4-1234')[0]).toBe('A4-6238');
  });
  it('still finds a number with no keyword, at lower score', () => {
    expect(findNrnCandidates('A4-6238')[0]).toMatchObject({ nrn: 'A4-6238', score: 1 });
  });
  it('returns nothing for text without numbers', () => {
    expect(nrns('PARACETAMOL TABLETS')).toEqual([]);
  });
});

describe('manualCandidates', () => {
  it('accepts well formed input', () => {
    expect(manualCandidates('a4-6238')).toEqual(['A4-6238']);
    expect(manualCandidates(' A4 – 6238 ')).toEqual(['A4-6238']);
  });
  it('splits input typed without a hyphen into every valid reading', () => {
    expect(manualCandidates('A46238')).toEqual(['A4-6238']);
    expect(manualCandidates('A116238')).toEqual(['A1-16238', 'A11-6238']);
    expect(manualCandidates('046238')).toEqual(['0-46238', '04-6238']);
  });
  it('rejects junk', () => {
    expect(manualCandidates('hello')).toEqual([]);
    expect(manualCandidates('')).toEqual([]);
  });
});
