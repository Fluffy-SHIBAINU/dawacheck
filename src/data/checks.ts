import { db as defaultDb, type CheckRow, type DawaDB } from './db';
import { uuid } from './meta';
import type { ScanInput, Verdict } from '../core/types';

export async function saveCheck(input: ScanInput, verdict: Verdict, thumb: Blob | null, d: DawaDB = defaultDb): Promise<CheckRow> {
  const row: CheckRow = {
    id: uuid(),
    createdAt: new Date().toISOString(),
    source: input.source,
    nrn: verdict.nrn,
    level: verdict.level,
    reasons: verdict.reasons,
    productName: verdict.product?.name ?? null,
    verdict,
    input: { ...input, text: input.text.slice(0, 2000) },
    thumb,
  };
  await d.checks.put(row);
  await pruneChecks(500, d);
  return row;
}

export function getCheck(id: string, d: DawaDB = defaultDb): Promise<CheckRow | undefined> {
  return d.checks.get(id);
}

export function listChecks(limit = 50, d: DawaDB = defaultDb): Promise<CheckRow[]> {
  return d.checks.orderBy('createdAt').reverse().limit(limit).toArray();
}

export async function pruneChecks(max: number, d: DawaDB = defaultDb): Promise<void> {
  const n = await d.checks.count();
  if (n <= max) return;
  const old = await d.checks.orderBy('createdAt').limit(n - max).primaryKeys();
  await d.checks.bulkDelete(old);
}
