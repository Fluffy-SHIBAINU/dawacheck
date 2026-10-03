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
