import { NAFDAC_HOTLINE, reportReasonFor, smsBody, smsHref } from '../../../src/core/sms';
import { NG_STATES, stateName } from '../../../src/core/states';
import type { Verdict } from '../../../src/core/types';

test('sms body is short and coded', () => {
  expect(smsBody({ nrn: 'A4-6238', reason: 'name_mismatch', state: 'KN' })).toBe('DC R A4-6238 MISMATCH KN');
  expect(smsBody({ nrn: null, reason: 'other', state: null })).toBe('DC R NONRN OTHER NA');
  expect(smsHref('DC R A4-6238 MISMATCH KN')).toBe('sms:?&body=DC%20R%20A4-6238%20MISMATCH%20KN');
  expect(NAFDAC_HOTLINE).toBe('0800-162-3322');
});

test('report reason follows the most severe verdict reason', () => {
  const v = (reasons: Verdict['reasons']) => ({ reasons }) as Verdict;
  expect(reportReasonFor(v(['registered', 'name_mismatch', 'strength_mismatch']))).toBe('name_mismatch');
  expect(reportReasonFor(v(['not_in_register', 'on_alert']))).toBe('on_alert');
  expect(reportReasonFor(v(['registered']))).toBe('looks_different');
});

test('37 Nigerian states including FCT', () => {
  expect(NG_STATES).toHaveLength(37);
  expect(stateName('KN')).toBe('Kano');
  expect(stateName(null)).toBeNull();
});
