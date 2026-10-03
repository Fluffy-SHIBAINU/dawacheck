import { normalizeText } from '../text';

export const NRN_RE = /^([ABC]?\d{1,2})-(\d{4,6}[A-Z]?)$/;

export function normalizeNrn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw
    .toUpperCase()
    .trim()
    .replace(/[‐-―−]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, '');
  return NRN_RE.test(s) ? s : null;
}

export interface NrnCandidate {
  nrn: string;
  score: number;
  raw: string;
}

const DIGIT_FIX: Record<string, string> = { O: '0', D: '0', Q: '0', I: '1', L: '1', S: '5', B: '8', Z: '2', G: '6' };
const LETTER_BACK: Record<string, string> = { '1': 'L', '5': 'S', '8': 'B', '0': 'O' };
const KEYWORD = /(NAFDAC|\bREG\b|REGISTRATION|\bNRN\b)/;
const DATE_LINE = /(EXP|MFG|MFD|MANUF|BEST BEFORE|USE BEFORE)/;
const CAND = /(^|[^A-Z0-9])([ABC]?[0-9OIL]{1,2})-([0-9OISBLDQZG]{4,6}[A-Z]?)(?=$|[^A-Z0-9])/g;
const SPACE_CAND = /(^|[^A-Z0-9])([ABC][0-9OIL]{1,2}) ([0-9OISBLDQZG]{4,6}[A-Z]?)(?=$|[^A-Z0-9])/g;

function fixDigits(s: string): { out: string; changed: boolean } {
  let changed = false;
  const out = s
    .split('')
    .map((c) => {
      if (c >= '0' && c <= '9') return c;
      changed = true;
      return DIGIT_FIX[c] ?? c;
    })
    .join('');
  return { out, changed };
}

function readings(prefix: string, num: string): { nrn: string; changed: boolean }[] {
  const letter = /^[ABC]/.test(prefix) && prefix.length >= 2 ? prefix[0] : '';
  const p = fixDigits(letter ? prefix.slice(1) : prefix);
  const out: { nrn: string; changed: boolean }[] = [];
  const last = num[num.length - 1];
  const lastIsLetter = /[A-Z]/.test(last);
  if (!lastIsLetter || last in DIGIT_FIX) {
    const n = fixDigits(num);
    out.push({ nrn: `${letter}${p.out}-${n.out}`, changed: p.changed || n.changed });
  }
  if (lastIsLetter && num.length >= 5) {
    const n = fixDigits(num.slice(0, -1));
    out.push({ nrn: `${letter}${p.out}-${n.out}${last}`, changed: p.changed || n.changed });
  } else if (!lastIsLetter && num.length >= 5 && LETTER_BACK[last]) {
    const n = fixDigits(num.slice(0, -1));
    out.push({ nrn: `${letter}${p.out}-${n.out}${LETTER_BACK[last]}`, changed: true });
  }
  return out.filter((x) => NRN_RE.test(x.nrn));
}

export function findNrnCandidates(text: string): NrnCandidate[] {
  const lines = normalizeText(text).split('\n');
  const best = new Map<string, NrnCandidate>();
  const add = (prefix: string, num: string, near: boolean) => {
    readings(prefix, num).forEach((c, k) => {
      const score = (near ? 2 : 1) - (c.changed ? 0.25 : 0) - k * 0.1;
      const prev = best.get(c.nrn);
      if (!prev || prev.score < score) best.set(c.nrn, { nrn: c.nrn, score, raw: `${prefix}-${num}` });
    });
  };
  lines.forEach((line, i) => {
    const near = KEYWORD.test(line) || (i > 0 && KEYWORD.test(lines[i - 1]));
    if (DATE_LINE.test(line) && !KEYWORD.test(line)) return;
    let found = false;
    for (const m of line.matchAll(CAND)) {
      const prefix = m[2];
      const num = m[3];
      if (!near && /^(0[1-9]|1[0-2])$/.test(prefix) && /^(19|20)\d\d$/.test(num)) continue;
      found = true;
      add(prefix, num, near);
    }
    if (!found && near) {
      for (const m of line.matchAll(SPACE_CAND)) add(m[2], m[3], near);
    }
  });
  return [...best.values()].sort((a, b) => b.score - a.score);
}

export function manualCandidates(raw: string): string[] {
  const direct = normalizeNrn(raw);
  if (direct) return [direct];
  const compact = raw.toUpperCase().replace(/[\s\-‐-―−]/g, '');
  const m = /^([ABC]?)(\d+)([A-Z]?)$/.exec(compact);
  if (!m) return [];
  const [, letter, digits, suffix] = m;
  const out: string[] = [];
  for (const plen of [1, 2]) {
    const rest = digits.length - plen;
    if (rest < 4 || rest > 6) continue;
    const nrn = `${letter}${digits.slice(0, plen)}-${digits.slice(plen)}${suffix}`;
    if (NRN_RE.test(nrn)) out.push(nrn);
  }
  return out;
}
