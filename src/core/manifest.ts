import { DEFAULT_THRESHOLDS, type Manifest } from './types';

function split(v: string): { date: string; n: number } {
  const m = /^(\d{4}-\d{2}-\d{2})(?:-(\d+))?$/.exec(v);
  return m ? { date: m[1], n: Number(m[2] ?? 0) } : { date: v, n: 0 };
}

export function compareVersions(a: string, b: string): number {
  const pa = split(a);
  const pb = split(b);
  if (pa.date !== pb.date) return pa.date < pb.date ? -1 : 1;
  return pa.n - pb.n;
}

export function validateManifest(x: unknown): Manifest {
  const m = x as Partial<Manifest> | null;
  if (!m || m.schema !== 1 || !m.packs?.register?.sha256 || !m.packs?.alerts?.sha256) throw new Error('invalid manifest');
  return { ...(m as Manifest), thresholds: { ...DEFAULT_THRESHOLDS, ...(m.thresholds ?? {}) } };
}
