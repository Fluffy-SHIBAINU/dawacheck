# Phase 2: Verdict engine

Read the plan index Global Constraints first. All code in this phase is pure TypeScript with no DOM or network. Spec reference: §7 (parsing) and §8 (verdict rules).

---

### Task 6: NRN candidates from OCR text

**Files:**
- Modify: `src/core/parse/nrn.ts` (keep `NRN_RE` and `normalizeNrn`, add the rest)
- Create: `tests/helpers/fixtures.ts`
- Test: `tests/unit/core/nrn.test.ts`

**Interfaces:**
- Consumes: `normalizeText` (Task 2), `NRN_RE`, `normalizeNrn` (Task 3), `Product`, `RegisterPack`, `Alert` (Task 2).
- Produces: `interface NrnCandidate { nrn: string; score: number; raw: string }`; `findNrnCandidates(text: string): NrnCandidate[]` (sorted best first); `manualCandidates(raw: string): string[]`; test fixtures `product()`, `ARTHEGET`, `LAPSED`, `EXPIRED_REG`, `DUP_A`, `DUP_B`, `FORX`, `NEIGHBOR`, `REGISTER`, `ALERTS`, `TODAY`, `DEMO_TEXT` from `tests/helpers/fixtures.ts`.

- [ ] **Step 1: Write the shared test fixtures** `tests/helpers/fixtures.ts`

```ts
import type { Alert, Product, RegisterPack } from '../../src/core/types';

export function product(p: Partial<Product> & Pick<Product, 'nrn' | 'name'>): Product {
  return {
    nrnRaw: p.nrn,
    ingredient: '',
    strength: '',
    form: 'Tablet',
    route: 'Oral',
    applicant: 'Test Pharma Ltd',
    category: 'Drugs',
    regExpiry: '2027-12-31',
    status: 'Active',
    description: '',
    packSize: '',
    atc: null,
    ...p,
  };
}

export const ARTHEGET = product({
  nrn: 'A4-6238',
  name: 'Artheget EZ',
  ingredient: 'Artemether + Lumefantrine',
  strength: '80 mg; 480 mg',
  regExpiry: '2026-12-01',
  applicant: 'Example Pharma Ltd',
  description: 'Tablet Yellow colored, oblong shaped tablet plain on both sides',
  packSize: "2 x 3's (in Alu-Alu blisters)",
});
export const LAPSED = product({ nrn: 'B4-1111', name: 'Oldcillin', ingredient: 'Amoxicillin', strength: '500 mg', status: 'Inactive', regExpiry: '2025-01-01' });
export const EXPIRED_REG = product({ nrn: 'B4-2222', name: 'Paraclear', ingredient: 'Paracetamol', strength: '500 mg', regExpiry: '2026-01-31' });
export const DUP_A = product({ nrn: 'A11-0275', name: 'Coflu Syrup', ingredient: 'Chlorphenamine', strength: '2 mg/5 ml' });
export const DUP_B = product({ nrn: 'A11-0275', name: 'Coflu Tablets', ingredient: 'Chlorphenamine', strength: '4 mg' });
export const FORX = product({ nrn: 'B4-3030', name: 'Forxiga', ingredient: 'Dapagliflozin', strength: '10 mg' });
export const NEIGHBOR = product({ nrn: 'A4-6298', name: 'Zentel Plus', ingredient: 'Albendazole', strength: '400 mg' });

export const REGISTER: RegisterPack = {
  version: '2026-10-03',
  source: 'test',
  fetchedAt: '2026-10-03T00:00:00Z',
  products: [ARTHEGET, LAPSED, EXPIRED_REG, DUP_A, DUP_B, FORX, NEIGHBOR],
};

export const ALERTS: Alert[] = [
  {
    id: '036/2026', wpId: 36, url: 'https://nafdac.gov.ng/a36', date: '2026-08-10', title: 'Suspected counterfeit Forxiga',
    kind: 'counterfeit', appliesToNigeria: true, summary: 'Suspected counterfeit Forxiga in circulation.',
    products: [{ brand: 'Forxiga', ingredient: 'Dapagliflozin', strength: '10 mg', manufacturer: 'AstraZeneca', nrn: null, batches: ['FX123'] }],
  },
  {
    id: '035/2026', wpId: 35, url: 'https://nafdac.gov.ng/a35', date: '2026-08-01', title: 'Unregistered Menofix Composition',
    kind: 'unregistered', appliesToNigeria: true, summary: 'Menofix Composition is not registered.',
    products: [{ brand: 'Menofix Composition', ingredient: null, strength: null, manufacturer: null, nrn: null, batches: [] }],
  },
  {
    id: '042/2026', wpId: 42, url: 'https://nafdac.gov.ng/a42', date: '2026-08-19', title: 'Falsified BPPL Artemether/Lumefantrine',
    kind: 'counterfeit', appliesToNigeria: true, summary: 'Seizure of falsified BPPL artemether/lumefantrine.',
    products: [{ brand: 'BPPL Artemether/Lumefantrine', ingredient: 'Artemether/Lumefantrine', strength: '80mg/480mg', manufacturer: 'BPPL', nrn: null, batches: ['BP2201'] }],
  },
  {
    id: '025/2026', wpId: 25, url: 'https://nafdac.gov.ng/a25', date: '2026-07-01', title: 'Recall of antacid in South Africa',
    kind: 'recall', appliesToNigeria: false, summary: 'Foreign recall.',
    products: [{ brand: 'Citro-Soda', ingredient: null, strength: null, manufacturer: null, nrn: null, batches: ['CS1'] }],
  },
];

export const TODAY = new Date('2026-10-03T12:00:00Z');

export const DEMO_TEXT = {
  green: 'ARTHEGET EZ\nArtemether 80 mg + Lumefantrine 480 mg\n6 tablets\nNAFDAC REG. NO. A4-6238\nBATCH AE2511 EXP 11/2027\nDEMO PACK',
  mismatch: 'MALAQUICK\nArtemether 20 mg + Lumefantrine 120 mg\nNAFDAC REG. NO. A4-6238\nBATCH MQ0925 EXP 09/2027\nDEMO PACK',
  notfound: 'PARAMAX FORTE\nParacetamol 500 mg\nNAFDAC REG. NO. A4-99231\nBATCH PX7731 EXP 03/2028\nDEMO PACK',
  expired: 'ARTHEGET EZ\nArtemether 80 mg + Lumefantrine 480 mg\nNAFDAC REG. NO. A4-6238\nBATCH AE2402 EXP 08/2026\nDEMO PACK',
  alert: 'MENOFIX COMPOSITION\nHerbal mixture\nNAFDAC REG. NO. A4-0999\nBATCH MF0101 EXP 12/2027\nDEMO PACK',
};
```

- [ ] **Step 2: Write the failing test** `tests/unit/core/nrn.test.ts`

```ts
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
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/unit/core/nrn.test.ts`
Expected: FAIL, `findNrnCandidates` is not exported.

- [ ] **Step 4: Implement** (replace `src/core/parse/nrn.ts` completely)

```ts
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
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/unit/core && npm run typecheck`
Expected: PASS (nrn, nrn-normalize, text, sha, manifest).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: find NAFDAC number candidates in OCR text with confusion fixes"
```

---

### Task 7: Expiry, batch, strength and name parsers

**Files:**
- Create: `src/core/parse/expiry.ts`, `src/core/parse/batch.ts`, `src/core/parse/strength.ts`, `src/core/parse/name.ts`
- Test: `tests/unit/core/parsers.test.ts`

**Interfaces:**
- Consumes: `normalizeText`, `similarity` (Task 2), `Expiry`, `Strength` (Task 2).
- Produces: `findExpiry(text: string): Expiry | null`; `parseDateToken(s: string): Expiry | null`; `isExpired(e: Expiry, today: Date): boolean`; `findBatch(text: string): string | null`; `findStrengths(text: string): Strength[]`; `strengthsConflict(box: Strength[], registered: Strength[]): boolean`; `strengthsOverlap(box: Strength[], registered: Strength[]): boolean`; `nameTokens(text: string): string[]`; `productTokens(name: string): string[]`; `bestTokenSimilarity(needles: string[], hay: string[]): number`.

- [ ] **Step 1: Write the failing test** `tests/unit/core/parsers.test.ts`

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/core/parsers.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/core/parse/expiry.ts`:
```ts
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
```

`src/core/parse/batch.ts`:
```ts
import { normalizeText } from '../text';

const BATCH = /(?:BATCH\s*(?:NO\.?|NUMBER)?|LOT\s*(?:NO\.?)?|B\.\s?NO\.?|\bBN\b)[\s.:#]*([A-Z0-9][A-Z0-9-]{2,14})/;
const NOT_BATCH = new Set(['EXP', 'EXPIRY', 'MFG', 'MFD', 'NO', 'NUMBER', 'DATE']);

export function findBatch(text: string): string | null {
  const m = BATCH.exec(normalizeText(text));
  if (!m) return null;
  return NOT_BATCH.has(m[1]) ? null : m[1];
}
```

`src/core/parse/strength.ts`:
```ts
import { normalizeText } from '../text';
import type { Strength } from '../types';

const PAIR = /(\d+(?:\.\d+)?)\s?(?:MG)?\s?\/\s?(\d+(?:\.\d+)?)\s?(MG|MCG|G)(?![A-Z])/g;
const SINGLE = /(\d+(?:\.\d+)?)\s?(MG|MCG|UG|µG|G|ML|IU|%)(?![A-Z])/g;

const unitOf = (u: string): string => (u === 'UG' || u === 'µG' ? 'MCG' : u);

export function findStrengths(text: string): Strength[] {
  const s = normalizeText(text);
  const out: Strength[] = [];
  for (const m of s.matchAll(PAIR)) out.push({ value: Number(m[1]), unit: m[3] }, { value: Number(m[2]), unit: m[3] });
  for (const m of s.matchAll(SINGLE)) out.push({ value: Number(m[1]), unit: unitOf(m[2]) });
  const seen = new Set<string>();
  return out.filter((x) => {
    const k = `${x.value}${x.unit}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const mg = (xs: Strength[]) => xs.filter((x) => x.unit === 'MG').map((x) => x.value);

export function strengthsOverlap(box: Strength[], registered: Strength[]): boolean {
  const r = mg(registered);
  return mg(box).some((b) => r.includes(b));
}

export function strengthsConflict(box: Strength[], registered: Strength[]): boolean {
  if (mg(box).length === 0 || mg(registered).length === 0) return false;
  return !strengthsOverlap(box, registered);
}
```

`src/core/parse/name.ts`:
```ts
import { normalizeText, similarity } from '../text';

const STOP = new Set([
  'TABLET', 'TABLETS', 'CAPSULE', 'CAPSULES', 'CAPLET', 'CAPLETS', 'SYRUP', 'SUSPENSION', 'INJECTION', 'CREAM', 'OINTMENT',
  'NAFDAC', 'BATCH', 'EXPIRY', 'MANUFACTURED', 'MANUFACTURER', 'KEEP', 'STORE', 'BELOW', 'REACH', 'CHILDREN', 'EACH',
  'CONTAINS', 'ORAL', 'BEFORE', 'DATE', 'LIMITED', 'PHARMA', 'PHARMACEUTICAL', 'PHARMACEUTICALS', 'INDUSTRIES', 'NIGERIA',
  'FILM', 'COATED', 'DOSAGE', 'DIRECTED', 'PHYSICIAN', 'PRESCRIPTION', 'ONLY', 'PACK', 'BLISTER', 'BLISTERS', 'STRIP',
  'STRIPS', 'TEMPERATURE', 'PROTECT', 'LIGHT', 'MOISTURE', 'DEMO', 'MADE', 'INDIA', 'CHINA', 'ADULTS', 'DOSE', 'WARNING',
  'READ', 'LEAFLET', 'INSERT', 'NUMBER', 'PRODUCT', 'ACTIVE', 'INGREDIENT', 'INGREDIENTS', 'FROM', 'WITH', 'THIS', 'THAT',
  'USED', 'REGISTRATION',
]);

export function nameTokens(text: string): string[] {
  return normalizeText(text)
    .split(/[^A-Z]+/)
    .filter((t) => t.length >= 4 && !STOP.has(t));
}

export function productTokens(name: string): string[] {
  const t = nameTokens(name);
  if (t.length) return t;
  return normalizeText(name)
    .split(/[^A-Z]+/)
    .filter((x) => x.length >= 3);
}

export function bestTokenSimilarity(needles: string[], hay: string[]): number {
  let best = 0;
  for (const n of needles) {
    for (const h of hay) {
      const s = similarity(n, h);
      if (s > best) best = s;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/core/parsers.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: parse expiry, batch, strength and name tokens from label text"
```

---

### Task 8: `parseScan`, register index and confusion variants

**Files:**
- Create: `src/core/parse/index.ts`, `src/core/registerIndex.ts`, `src/core/confusion.ts`
- Test: `tests/unit/core/scan.test.ts`

**Interfaces:**
- Consumes: Task 6 and 7 parsers; `RegisterPack`, `Product`, `ScanInput`, `Correction` (Task 2).
- Produces:
  - `parseScan(text: string): ScanInput` (source `'ocr'`); `manualInput(raw: string): ScanInput | null` (source `'manual'`).
  - `interface RegisterIndex { byNrn: Map<string, Product[]>; size: number; version: string }`; `buildRegisterIndex(pack: RegisterPack): RegisterIndex`; `lookup(idx: RegisterIndex, nrn: string): Product[]`.
  - `type ConfusionTable = Map<string, number>` (key `"from>to"`); `buildConfusion(corrections: Correction[]): ConfusionTable`; `nrnVariants(nrn: string, idx: RegisterIndex, table: ConfusionTable): { nrn: string; weight: number }[]` (sorted by weight, highest first).

- [ ] **Step 1: Write the failing test** `tests/unit/core/scan.test.ts`

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/core/scan.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/core/parse/index.ts`:
```ts
import type { ScanInput } from '../types';
import { findNrnCandidates, manualCandidates } from './nrn';
import { findStrengths } from './strength';
import { findBatch } from './batch';
import { findExpiry } from './expiry';

export function parseScan(text: string): ScanInput {
  return {
    source: 'ocr',
    nrnCandidates: findNrnCandidates(text).map((c) => c.nrn),
    text,
    strengths: findStrengths(text),
    batch: findBatch(text),
    expiry: findExpiry(text),
  };
}

export function manualInput(raw: string): ScanInput | null {
  const nrnCandidates = manualCandidates(raw);
  if (!nrnCandidates.length) return null;
  return { source: 'manual', nrnCandidates, text: '', strengths: [], batch: null, expiry: null };
}
```

`src/core/registerIndex.ts`:
```ts
import type { Product, RegisterPack } from './types';

export interface RegisterIndex {
  byNrn: Map<string, Product[]>;
  size: number;
  version: string;
}

export function buildRegisterIndex(pack: RegisterPack): RegisterIndex {
  const byNrn = new Map<string, Product[]>();
  for (const p of pack.products) {
    const arr = byNrn.get(p.nrn);
    if (arr) arr.push(p);
    else byNrn.set(p.nrn, [p]);
  }
  return { byNrn, size: pack.products.length, version: pack.version };
}

export function lookup(idx: RegisterIndex, nrn: string): Product[] {
  return idx.byNrn.get(nrn) ?? [];
}
```

`src/core/confusion.ts`:
```ts
import type { Correction } from './types';
import type { RegisterIndex } from './registerIndex';

export type ConfusionTable = Map<string, number>;

const BASE: [string, string][] = [
  ['0', '8'], ['8', '0'], ['1', '7'], ['7', '1'], ['5', '6'], ['6', '5'], ['3', '8'], ['8', '3'],
  ['2', '7'], ['4', '9'], ['9', '4'], ['6', '8'], ['8', '6'], ['3', '9'], ['9', '3'], ['1', '4'],
];

export function buildConfusion(corrections: Correction[]): ConfusionTable {
  const t: ConfusionTable = new Map();
  for (const [a, b] of BASE) t.set(`${a}>${b}`, 1);
  for (const c of corrections) {
    if (c.read.length !== c.corrected.length) continue;
    for (let i = 0; i < c.read.length; i++) {
      const a = c.read[i];
      const b = c.corrected[i];
      if (a !== b) t.set(`${a}>${b}`, (t.get(`${a}>${b}`) ?? 0) + c.n * 5);
    }
  }
  return t;
}

export function nrnVariants(nrn: string, idx: RegisterIndex, table: ConfusionTable): { nrn: string; weight: number }[] {
  const out = new Map<string, number>();
  const put = (s: string, w: number) => {
    if (s !== nrn && idx.byNrn.has(s)) out.set(s, Math.max(out.get(s) ?? 0, w));
  };
  const chars = nrn.split('');
  chars.forEach((c, i) => {
    if (c === '-') return;
    const pool = c >= '0' && c <= '9' ? '0123456789' : 'ABC';
    for (const r of pool) {
      if (r === c) continue;
      const v = [...chars];
      v[i] = r;
      put(v.join(''), table.get(`${c}>${r}`) ?? 0.5);
    }
  });
  const dash = nrn.indexOf('-');
  if (dash > 0) {
    const p = nrn.slice(0, dash);
    const num = nrn.slice(dash + 1);
    for (let i = 0; i < num.length; i++) put(`${p}-${num.slice(0, i)}${num.slice(i + 1)}`, 0.3);
    for (let i = 0; i <= num.length; i++) for (const d of '0123456789') put(`${p}-${num.slice(0, i)}${d}${num.slice(i)}`, 0.3);
  }
  return [...out.entries()].map(([n, weight]) => ({ nrn: n, weight })).sort((a, b) => b.weight - a.weight);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/core && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add scan parsing, register index and learned confusion variants"
```

---

### Task 9: Alert matching

**Files:**
- Create: `src/core/alerts.ts`
- Test: `tests/unit/core/alerts.test.ts`

**Interfaces:**
- Consumes: `nameTokens`, `productTokens`, `bestTokenSimilarity` (Task 7); `Alert`, `AlertProduct`, `Product` (Task 2).
- Produces: `interface AlertMatch { alert: Alert; product: AlertProduct; batchMatch: boolean }`; `matchAlerts(args: { alerts: Alert[]; boxTokens: string[]; product: Product | null; nrn: string | null; batch: string | null; threshold: number }): { match: AlertMatch | null; ingredientNote: string | null }`.

Rules (spec §8.4): brand match = at least half of the brand's distinctive tokens (brand tokens minus ingredient words) match box or product-name tokens at ≥ threshold, and at least one does; or the alert product's `nrn` equals the resolved NRN. Ingredient-only matches only set `ingredientNote`. Alerts with `appliesToNigeria === false` are ignored. Ranking: batch match > `unregistered` > other kinds; ties go to the newer date.

- [ ] **Step 1: Write the failing test** `tests/unit/core/alerts.test.ts`

```ts
import { matchAlerts } from '../../../src/core/alerts';
import { nameTokens } from '../../../src/core/parse/name';
import { ALERTS, ARTHEGET, FORX } from '../../helpers/fixtures';

const base = { alerts: ALERTS, threshold: 0.8, nrn: null, batch: null, product: null };

test('brand match on box text without batch', () => {
  const r = matchAlerts({ ...base, boxTokens: nameTokens('FORXIGA 10 mg'), product: FORX, nrn: FORX.nrn });
  expect(r.match?.alert.id).toBe('036/2026');
  expect(r.match?.batchMatch).toBe(false);
});

test('brand match with a named batch', () => {
  const r = matchAlerts({ ...base, boxTokens: nameTokens('FORXIGA'), batch: 'fx123' });
  expect(r.match?.batchMatch).toBe(true);
});

test('unregistered product matched by name alone', () => {
  const r = matchAlerts({ ...base, boxTokens: nameTokens('MENOFIX COMPOSITION herbal mixture') });
  expect(r.match?.alert.kind).toBe('unregistered');
});

test('half of a multi-word brand is enough', () => {
  const r = matchAlerts({ ...base, boxTokens: nameTokens('MENOFIX') });
  expect(r.match?.alert.id).toBe('035/2026');
});

test('ingredient-only overlap gives a note, not a match', () => {
  const r = matchAlerts({ ...base, boxTokens: nameTokens('ARTHEGET EZ Artemether Lumefantrine'), product: ARTHEGET, nrn: ARTHEGET.nrn });
  expect(r.match).toBeNull();
  expect(r.ingredientNote).toBe('Artemether/Lumefantrine');
});

test('foreign-only alerts are ignored', () => {
  const r = matchAlerts({ ...base, boxTokens: nameTokens('CITRO SODA'), batch: 'CS1' });
  expect(r.match).toBeNull();
});

test('nrn stated in an alert matches directly', () => {
  const alerts = [{ ...ALERTS[0], products: [{ ...ALERTS[0].products[0], brand: null, nrn: 'B4-3030' }] }];
  const r = matchAlerts({ ...base, alerts, boxTokens: [], nrn: 'B4-3030' });
  expect(r.match?.alert.id).toBe('036/2026');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/core/alerts.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement** `src/core/alerts.ts`

```ts
import type { Alert, AlertProduct, Product } from './types';
import { bestTokenSimilarity, nameTokens, productTokens } from './parse/name';

export interface AlertMatch {
  alert: Alert;
  product: AlertProduct;
  batchMatch: boolean;
}

function rank(m: AlertMatch): number {
  return (m.batchMatch ? 3 : m.alert.kind === 'unregistered' ? 2 : 1) * 1e9 + Number(m.alert.date.replace(/-/g, ''));
}

function brandHit(ap: AlertProduct, hay: string[], threshold: number): boolean {
  if (!ap.brand) return false;
  const generic = ap.ingredient ? nameTokens(ap.ingredient) : [];
  const distinctive = nameTokens(ap.brand).filter((t) => bestTokenSimilarity([t], generic) < threshold);
  if (!distinctive.length) return false;
  const hits = distinctive.filter((t) => bestTokenSimilarity([t], hay) >= threshold).length;
  return hits >= 1 && hits / distinctive.length >= 0.5;
}

export function matchAlerts(args: {
  alerts: Alert[];
  boxTokens: string[];
  product: Product | null;
  nrn: string | null;
  batch: string | null;
  threshold: number;
}): { match: AlertMatch | null; ingredientNote: string | null } {
  const hay = [...args.boxTokens, ...(args.product ? productTokens(args.product.name) : [])];
  const productIngredient = args.product ? nameTokens(args.product.ingredient) : [];
  const batch = args.batch ? args.batch.toUpperCase() : null;
  let best: AlertMatch | null = null;
  let ingredientNote: string | null = null;
  for (const alert of args.alerts) {
    if (!alert.appliesToNigeria) continue;
    for (const ap of alert.products) {
      const nrnHit = Boolean(ap.nrn && args.nrn && ap.nrn === args.nrn);
      if (nrnHit || brandHit(ap, hay, args.threshold)) {
        const m: AlertMatch = { alert, product: ap, batchMatch: Boolean(batch && ap.batches.includes(batch)) };
        if (!best || rank(m) > rank(best)) best = m;
      } else if (!ingredientNote && ap.ingredient && productIngredient.length) {
        const alertIngredient = nameTokens(ap.ingredient);
        const shared = alertIngredient.length > 0 && alertIngredient.every((t) => bestTokenSimilarity([t], productIngredient) >= args.threshold);
        if (shared) ingredientNote = ap.ingredient;
      }
    }
  }
  return { match: best, ingredientNote };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/core/alerts.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: match boxes to NAFDAC alerts by brand, number and batch"
```

---

### Task 10: `decide()` verdict engine (decision table) + phase gate

**Files:**
- Create: `src/core/verdict.ts`
- Test: `tests/unit/core/verdict.test.ts`

**Interfaces:**
- Consumes: everything in `src/core` so far.
- Produces: `interface DecideContext { register: RegisterIndex; alerts: Alert[]; flags: Map<string, CommunityFlag>; confusion: ConfusionTable; today: Date; thresholds: Thresholds }`; `decide(input: ScanInput, ctx: DecideContext): Verdict`; `levelFor(reasons: Reason[]): Level`; `pickRecord(products: Product[], input: ScanInput, boxTokens: string[]): Product`.

Rules (spec §8, with this refinement of rule 7). Name mismatch requires all of:
- the product-name score is below `nameMatch`;
- the box has at least 3 name tokens;
- the first *distinctive* box token scores below `nameMismatch` against the product name.

A distinctive token is one that is not similar (≥ `nameMatch`) to an ingredient or applicant word. Otherwise the verdict carries `name_unconfirmed` (info only). OCR fuzzy correction (rule 2) is accepted **only** when the corrected product's *brand* words (its name tokens minus ingredient words) match the box (≥ `nameMatch`). Otherwise the verdict stays red `not_in_register` and shows suggestions. This blocks fake numbers being "corrected" into real neighbours, including neighbours whose name is just a generic like "Paracetamol".

- [ ] **Step 1: Write the failing test** `tests/unit/core/verdict.test.ts`

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/core/verdict.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement** `src/core/verdict.ts`

```ts
import {
  AMBER_REASONS,
  RED_REASONS,
  type Alert,
  type CommunityFlag,
  type Level,
  type Product,
  type Reason,
  type ScanInput,
  type Thresholds,
  type Verdict,
} from './types';
import type { RegisterIndex } from './registerIndex';
import { nrnVariants, type ConfusionTable } from './confusion';
import { matchAlerts } from './alerts';
import { bestTokenSimilarity, nameTokens, productTokens } from './parse/name';
import { findStrengths, strengthsConflict, strengthsOverlap } from './parse/strength';
import { isExpired } from './parse/expiry';

export interface DecideContext {
  register: RegisterIndex;
  alerts: Alert[];
  flags: Map<string, CommunityFlag>;
  confusion: ConfusionTable;
  today: Date;
  thresholds: Thresholds;
}

export function levelFor(reasons: Reason[]): Level {
  if (reasons.some((r) => RED_REASONS.includes(r))) return 'red';
  if (reasons.some((r) => AMBER_REASONS.includes(r))) return 'amber';
  if (reasons.includes('registered')) return 'green';
  return 'unknown';
}

function nameScore(p: Product, boxTokens: string[]): number {
  return bestTokenSimilarity(productTokens(p.name), boxTokens);
}

// Brand words only (ingredient words removed). A generic name like "Paracetamol" can never confirm a correction.
function brandScore(p: Product, boxTokens: string[]): number {
  const generic = nameTokens(p.ingredient);
  const own = productTokens(p.name).filter((tk) => bestTokenSimilarity([tk], generic) < 0.8);
  return own.length ? bestTokenSimilarity(own, boxTokens) : 0;
}

export function pickRecord(products: Product[], input: ScanInput, boxTokens: string[]): Product {
  const score = (p: Product) =>
    (input.source === 'ocr' ? nameScore(p, boxTokens) : 0) +
    (strengthsOverlap(input.strengths, findStrengths(p.strength)) ? 0.5 : 0) +
    (p.status === 'Active' ? 0.25 : 0);
  return [...products].sort((a, b) => score(b) - score(a))[0];
}

function distinctiveTokens(boxTokens: string[], p: Product, threshold: number): string[] {
  const generic = [...nameTokens(p.ingredient), ...nameTokens(p.applicant)];
  return boxTokens.filter((t) => bestTokenSimilarity([t], generic) < threshold);
}

export function decide(input: ScanInput, ctx: DecideContext): Verdict {
  const t = ctx.thresholds;
  const boxTokens = input.source === 'ocr' ? nameTokens(input.text) : [];
  const reasons: Reason[] = [];
  const v: Verdict = {
    level: 'unknown',
    reasons,
    nrn: null,
    product: null,
    products: [],
    alert: null,
    flag: null,
    suggestions: [],
    correctedFrom: null,
    ingredientAlertNote: null,
    boxName: boxTokens.length ? boxTokens.slice(0, 2).join(' ') : null,
    boxStrengths: input.strengths,
    expiry: input.expiry,
    batch: input.batch,
  };

  // 1. Resolve the number: exact hit first, then guarded fuzzy correction for OCR input.
  let resolved: string | null = input.nrnCandidates.find((c) => ctx.register.byNrn.has(c)) ?? null;
  if (!resolved && input.nrnCandidates.length) {
    const first = input.nrnCandidates[0];
    const variants = nrnVariants(first, ctx.register, ctx.confusion);
    const asProducts = (xs: { nrn: string }[]) => xs.slice(0, 3).map((x) => pickRecord(ctx.register.byNrn.get(x.nrn)!, input, boxTokens));
    v.suggestions = asProducts(variants);
    if (input.source === 'ocr') {
      const named = variants.filter((x) => ctx.register.byNrn.get(x.nrn)!.some((p) => brandScore(p, boxTokens) >= t.nameMatch));
      if (named.length === 1 || (named.length > 1 && named[0].weight >= 2 * named[1].weight)) {
        resolved = named[0].nrn;
        v.correctedFrom = first;
        reasons.push('corrected_number');
        v.suggestions = [];
      } else if (named.length > 1) {
        reasons.push('ambiguous_number');
        v.suggestions = asProducts(named);
      }
    }
  }
  v.nrn = resolved ?? input.nrnCandidates[0] ?? null;
  if (resolved) {
    v.products = ctx.register.byNrn.get(resolved)!;
    v.product = pickRecord(v.products, input, boxTokens);
  }

  // 2. Alerts (run even without a number).
  const am = matchAlerts({ alerts: ctx.alerts, boxTokens, product: v.product, nrn: resolved, batch: input.batch, threshold: t.nameMatch });
  v.ingredientAlertNote = am.ingredientNote;
  if (am.match) {
    v.alert = am.match.alert;
    if (am.match.batchMatch) reasons.push('batch_on_alert');
    else if (am.match.alert.kind === 'unregistered') reasons.push('on_alert');
    else reasons.push('alert_product');
  }

  // 3. No number at all.
  if (!input.nrnCandidates.length) {
    if (!reasons.some((r) => RED_REASONS.includes(r))) reasons.push('no_number_found');
    v.level = levelFor(reasons);
    return v;
  }
  if (reasons.includes('ambiguous_number')) {
    v.level = levelFor(reasons);
    return v;
  }

  // 4. Not in register.
  if (!resolved) reasons.push('not_in_register');

  // 5. Pack expiry.
  if (input.expiry && isExpired(input.expiry, ctx.today)) reasons.push('pack_expired');

  if (v.product) {
    const p = v.product;
    // 6. Registration status.
    const todayIso = ctx.today.toISOString().slice(0, 10);
    if (p.status !== 'Active' || (p.regExpiry !== null && p.regExpiry < todayIso)) reasons.push('reg_lapsed');

    // 7. Box vs register (OCR only).
    if (input.source === 'ocr') {
      const distinct = distinctiveTokens(boxTokens, p, t.nameMatch);
      if (distinct.length) v.boxName = distinct.slice(0, 2).join(' ');
      if (nameScore(p, boxTokens) < t.nameMatch) {
        const firstDistinct = distinct[0];
        const mismatch =
          boxTokens.length >= 3 && firstDistinct !== undefined && bestTokenSimilarity([firstDistinct], productTokens(p.name)) < t.nameMismatch;
        reasons.push(mismatch ? 'name_mismatch' : 'name_unconfirmed');
      }
      if (strengthsConflict(input.strengths, findStrengths(p.strength))) reasons.push('strength_mismatch');
    } else {
      reasons.push('name_unconfirmed');
    }

    // 8. Community flag.
    const flag = ctx.flags.get(p.nrn);
    if (flag) {
      v.flag = flag;
      reasons.push('community_flag');
    }

    // 9. Registered.
    reasons.push('registered');
  }

  v.level = levelFor(reasons);
  return v;
}
```

Note: `registered` is always added when the number resolves. `levelFor` lets red and amber reasons win, so a lapsed or mismatched product still shows its warning while the screen can say the number exists.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/core/verdict.test.ts`
Expected: PASS. If a demo case fails, debug with `console.log(parseScan(DEMO_TEXT.x))` and fix the parser or rule, **not** the expected outcome. The five demo expectations are the product's acceptance criteria.

- [ ] **Step 5: Real-register smoke test** `tests/unit/core/verdict-real.test.ts`

```ts
import { readFileSync } from 'node:fs';
import { decide } from '../../../src/core/verdict';
import { parseScan } from '../../../src/core/parse';
import { buildRegisterIndex } from '../../../src/core/registerIndex';
import { buildConfusion } from '../../../src/core/confusion';
import { DEFAULT_THRESHOLDS, type AlertsPack, type RegisterPack } from '../../../src/core/types';
import { DEMO_TEXT, TODAY } from '../../helpers/fixtures';

const register = JSON.parse(readFileSync('public/packs/register.json', 'utf8')) as RegisterPack;
const alerts = JSON.parse(readFileSync('public/packs/alerts.json', 'utf8')) as AlertsPack;
const c = {
  register: buildRegisterIndex(register),
  alerts: alerts.alerts,
  flags: new Map(),
  confusion: buildConfusion([]),
  today: TODAY,
  thresholds: DEFAULT_THRESHOLDS,
};

test.each([
  ['green', 'green'],
  ['mismatch', 'amber'],
  ['notfound', 'red'],
  ['expired', 'red'],
  ['alert', 'red'],
] as const)('demo %s gives %s with the real packs', (key, level) => {
  expect(decide(parseScan(DEMO_TEXT[key]), c).level).toBe(level);
});
```

Run: `npx vitest run tests/unit/core/verdict-real.test.ts`
Expected: PASS. If `green` comes out amber because a real alert brand-matches "Artheget", inspect `alerts.json`. If an alert genuinely names Artheget EZ, pick another registered antimalarial for demo carton 1 and record the change in `docs/progress.md`. If it is a false brand match, tighten `brandHit`.

- [ ] **Step 6: Phase gate**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add verdict engine with green, amber and red decision table"
```
