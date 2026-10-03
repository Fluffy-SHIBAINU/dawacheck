import type { ReportReason, Verdict } from './types';

export const NAFDAC_HOTLINE = '0800-162-3322';

const CODES: Record<ReportReason, string> = {
  not_in_register: 'NOTREG',
  name_mismatch: 'MISMATCH',
  strength_mismatch: 'STRENGTH',
  pack_expired: 'EXPIRED',
  reg_lapsed: 'LAPSED',
  on_alert: 'ALERT',
  batch_on_alert: 'BATCH',
  alert_product: 'ALERTPROD',
  community_flag: 'COMMUNITY',
  looks_different: 'LOOKS',
  other: 'OTHER',
};

export function smsBody(r: { nrn: string | null; reason: ReportReason; state: string | null }): string {
  return ['DC', 'R', r.nrn ?? 'NONRN', CODES[r.reason], r.state ?? 'NA'].join(' ');
}

export function smsHref(body: string, to = ''): string {
  return `sms:${to}?&body=${encodeURIComponent(body)}`;
}

const ORDER: ReportReason[] = [
  'batch_on_alert', 'on_alert', 'not_in_register', 'pack_expired', 'name_mismatch',
  'strength_mismatch', 'alert_product', 'reg_lapsed', 'community_flag',
];

export function reportReasonFor(v: Verdict): ReportReason {
  return ORDER.find((r) => (v.reasons as string[]).includes(r)) ?? 'looks_different';
}
