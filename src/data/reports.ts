import { db as defaultDb, type DawaDB, type ReportRow } from './db';
import { uuid } from './meta';
import { APP_VERSION } from '../lib/version';
import type { Level, ReportReason } from '../core/types';

export interface NewReport {
  checkId: string | null;
  nrn: string | null;
  productName: string | null;
  reason: ReportReason;
  verdict: Level;
  state: string | null;
  note: string | null;
  photoThumb: string | null;
  ocrExcerpt: string | null;
  lang: string;
  packVersion: string;
}

export async function saveReport(r: NewReport, d: DawaDB = defaultDb): Promise<ReportRow> {
  const row: ReportRow = {
    ...r,
    id: uuid(),
    createdAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    note: r.note ? r.note.slice(0, 200) : null,
    ocrExcerpt: r.ocrExcerpt ? r.ocrExcerpt.slice(0, 500) : null,
    syncedAt: null,
    attempts: 0,
  };
  await d.reports.put(row);
  return row;
}

export function pendingReports(d: DawaDB = defaultDb): Promise<ReportRow[]> {
  return d.reports.filter((r) => !r.syncedAt).toArray();
}

export function countPendingReports(d: DawaDB = defaultDb): Promise<number> {
  return d.reports.filter((r) => !r.syncedAt).count();
}

export async function markReportsSynced(ids: string[], at: string, d: DawaDB = defaultDb): Promise<void> {
  await d.reports.where('id').anyOf(ids).modify({ syncedAt: at });
}

export async function bumpReportAttempts(ids: string[], d: DawaDB = defaultDb): Promise<void> {
  await d.reports
    .where('id')
    .anyOf(ids)
    .modify((r) => {
      r.attempts += 1;
    });
}
