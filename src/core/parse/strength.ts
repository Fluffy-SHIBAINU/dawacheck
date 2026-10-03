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
