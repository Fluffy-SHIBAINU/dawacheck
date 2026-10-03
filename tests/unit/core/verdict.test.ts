import { decide, levelFor, type DecideContext } from '../../../src/core/verdict';
import { manualInput, parseScan } from '../../../src/core/parse';
import { buildRegisterIndex } from '../../../src/core/registerIndex';
import { buildConfusion } from '../../../src/core/confusion';
import { DEFAULT_THRESHOLDS, type CommunityFlag } from '../../../src/core/types';
import { ALERTS, DEMO_TEXT, REGISTER, TODAY } from '../../helpers/fixtures';

function ctx(flags: CommunityFlag[] = []): DecideContext {
  return {
    register: buildRegisterIndex(REGISTER),
    alerts: ALERTS,
    flags: new Map(flags.map((f) => [f.nrn, f])),
    confusion: buildConfusion([]),
    today: TODAY,
    thresholds: DEFAULT_THRESHOLDS,
  };
}
const ocr = (t: string, c = ctx()) => decide(parseScan(t), c);
const manual = (t: string, c = ctx()) => decide(manualInput(t)!, c);

describe('decision table', () => {
  test('demo 1: registered and matching box is green', () => {
    const v = ocr(DEMO_TEXT.green);
    expect(v.level).toBe('green');
    expect(v.reasons).toContain('registered');
    expect(v.product?.name).toBe('Artheget EZ');
    expect(v.ingredientAlertNote).toBe('Artemether/Lumefantrine');
    expect(v.alert).toBeNull();
  });

  test('demo 2: copied number with another name and strength is amber', () => {
    const v = ocr(DEMO_TEXT.mismatch);
    expect(v.level).toBe('amber');
    expect(v.reasons).toEqual(expect.arrayContaining(['name_mismatch', 'strength_mismatch']));
    expect(v.boxName).toBe('MALAQUICK');
  });

  test('demo 3: number not in the register is red', () => {
    const v = ocr(DEMO_TEXT.notfound);
    expect(v.level).toBe('red');
    expect(v.reasons).toContain('not_in_register');
    expect(v.nrn).toBe('A4-99231');
  });

  test('demo 4: expired pack is red', () => {
    const v = ocr(DEMO_TEXT.expired);
    expect(v.level).toBe('red');
    expect(v.reasons).toContain('pack_expired');
  });

  test('demo 5: product named in an unregistered alert is red', () => {
    const v = ocr(DEMO_TEXT.alert);
    expect(v.level).toBe('red');
    expect(v.reasons).toEqual(expect.arrayContaining(['on_alert', 'not_in_register']));
    expect(v.alert?.id).toBe('035/2026');
  });

  test('manual entry of a registered number is green but asks to confirm the name', () => {
    const v = manual('A4-6238');
    expect(v.level).toBe('green');
    expect(v.reasons).toEqual(expect.arrayContaining(['registered', 'name_unconfirmed']));
  });

  test('manual entry of an unknown number is red with suggestions', () => {
    const v = manual('A4-6239');
    expect(v.level).toBe('red');
    expect(v.reasons).toContain('not_in_register');
    expect(v.suggestions.map((p) => p.nrn)).toContain('A4-6238');
  });

  test('inactive registration is amber', () => {
    expect(manual('B4-1111').reasons).toContain('reg_lapsed');
    expect(manual('B4-1111').level).toBe('amber');
  });

  test('registration past its expiry date is amber', () => {
    expect(manual('B4-2222').reasons).toContain('reg_lapsed');
  });

  test('OCR misread is corrected when the box name confirms it', () => {
    const v = ocr('ARTHEGET EZ\nNAFDAC REG. NO. A4-6239\nArtemether 80 mg');
    expect(v.reasons).toContain('corrected_number');
    expect(v.correctedFrom).toBe('A4-6239');
    expect(v.nrn).toBe('A4-6238');
    expect(v.level).toBe('green');
  });

  test('fake number is NOT corrected into a real neighbour with another name', () => {
    const v = ocr('PARAMAX FORTE\nNAFDAC REG. NO. A4-6299\nParacetamol 500 mg');
    expect(v.level).toBe('red');
    expect(v.reasons).toContain('not_in_register');
    expect(v.reasons).not.toContain('corrected_number');
    expect(v.suggestions.map((p) => p.nrn)).toContain('A4-6298');
  });

  test('duplicate numbers pick the record matching name and strength', () => {
    const v = ocr('COFLU TABLETS 4 mg\nNAFDAC REG. NO. A11-0275');
    expect(v.product?.name).toBe('Coflu Tablets');
  });

  test('counterfeit alert by brand without batch match is amber', () => {
    const v = ocr('FORXIGA 10 mg\nNAFDAC REG. NO. B4-3030\nBATCH FX999 EXP 01/2028');
    expect(v.level).toBe('amber');
    expect(v.reasons).toContain('alert_product');
  });

  test('batch named in an alert is red', () => {
    const v = ocr('FORXIGA 10 mg\nNAFDAC REG. NO. B4-3030\nBATCH FX123 EXP 01/2028');
    expect(v.level).toBe('red');
    expect(v.reasons).toContain('batch_on_alert');
  });

  test('community flag makes a registered number amber', () => {
    const flag: CommunityFlag = { nrn: 'A4-6238', reports: 4, devices: 3, states: ['KN'], level: 'watch', last_report_at: '2026-10-02T00:00:00Z' };
    const v = manual('A4-6238', ctx([flag]));
    expect(v.level).toBe('amber');
    expect(v.reasons).toContain('community_flag');
    expect(v.flag?.reports).toBe(4);
  });

  test('no number at all is unknown', () => {
    const v = ocr('SOME BOX WITHOUT A NUMBER');
    expect(v.level).toBe('unknown');
    expect(v.reasons).toEqual(['no_number_found']);
  });

  test('no number but an unregistered alert name is red', () => {
    const v = ocr('MENOFIX COMPOSITION herbal');
    expect(v.level).toBe('red');
    expect(v.reasons).toContain('on_alert');
  });
});

test('levelFor orders severity', () => {
  expect(levelFor(['registered', 'reg_lapsed', 'pack_expired'])).toBe('red');
  expect(levelFor(['registered', 'community_flag'])).toBe('amber');
  expect(levelFor(['registered', 'name_unconfirmed'])).toBe('green');
  expect(levelFor(['no_number_found'])).toBe('unknown');
});
