import { normalizeText } from '../text';

const BATCH = /(?:BATCH\s*(?:NO\.?|NUMBER)?|LOT\s*(?:NO\.?)?|B\.\s?NO\.?|\bBN\b)[\s.:#]*([A-Z0-9][A-Z0-9-]{2,14})/;
const NOT_BATCH = new Set(['EXP', 'EXPIRY', 'MFG', 'MFD', 'NO', 'NUMBER', 'DATE']);

export function findBatch(text: string): string | null {
  const m = BATCH.exec(normalizeText(text));
  if (!m) return null;
  return NOT_BATCH.has(m[1]) ? null : m[1];
}
