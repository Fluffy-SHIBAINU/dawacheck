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
