import { normalizeText } from '../text';
import type { Expiry } from '../types';

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12,
};
const KEY = /(EXP(?:IRY)?(?:\.|\s)*(?:DATE)?|USE\s+BEFORE|BEST\s+BEFORE)[\s.:]*/;

function mk(month: number, year: number): Expiry | null {
  const y = year < 100 ? year + 2000 : year;
  if (month < 1 || month > 12 || y < 2000 || y > 2100) return null;
  return { month, year: y };
}

export function parseDateToken(s: string): Expiry | null {
  const t = s.trim();
  let m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2})\b/.exec(t);
  if (m) {
    const r = mk(Number(m[2]), Number(m[3]));
    if (r) return r;
  }
  m = /^(\d{1,2})[/.\-](\d{4}|\d{2})\b/.exec(t);
  if (m) {
    const r = mk(Number(m[1]), Number(m[2]));
    if (r) return r;
  }
  m = /^([A-Z]{3,4})[\s.\-/]*(\d{4}|\d{2})\b/.exec(t);
  if (m && MONTHS[m[1]]) {
    const r = mk(MONTHS[m[1]], Number(m[2]));
    if (r) return r;
  }
  m = /^(\d{4})[/.\-](\d{1,2})\b/.exec(t);
  if (m) {
    const r = mk(Number(m[2]), Number(m[1]));
    if (r) return r;
  }
  return null;
}

export function findExpiry(text: string): Expiry | null {
  for (const line of normalizeText(text).split('\n')) {
    const idx = line.search(KEY);
    if (idx < 0) continue;
    const rest = line.slice(idx).replace(KEY, '');
    const e = parseDateToken(rest);
    if (e) return e;
  }
  return null;
}

export function isExpired(e: Expiry, today: Date): boolean {
  const endOfMonth = Date.UTC(e.year, e.month, 0, 23, 59, 59);
  return endOfMonth < today.getTime();
}
