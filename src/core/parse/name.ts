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
