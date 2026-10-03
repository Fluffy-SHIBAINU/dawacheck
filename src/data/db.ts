import Dexie, { type Table } from 'dexie';
import type { Level, Reason, ReportReason, ScanInput, Verdict } from '../core/types';

export type PackName = 'register' | 'alerts' | 'flags' | 'corrections';

export interface PackRow {
  name: PackName;
  version: string;
  json: string;
  updatedAt: string;
}

export interface CheckRow {
  id: string;
  createdAt: string;
  source: 'ocr' | 'manual';
  nrn: string | null;
  level: Level;
  reasons: Reason[];
  productName: string | null;
  verdict: Verdict;
  input: ScanInput;
  thumb: Blob | null;
}

export interface ReportRow {
  id: string;
  createdAt: string;
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
  appVersion: string;
  packVersion: string;
  syncedAt: string | null;
  attempts: number;
}

export interface EventRow {
  id: string;
  ts: string;
  type: string;
  props: Record<string, unknown>;
  lang: string;
  appVersion: string;
  packVersion: string;
  syncedAt: string | null;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export class DawaDB extends Dexie {
  packs!: Table<PackRow, string>;
  checks!: Table<CheckRow, string>;
  reports!: Table<ReportRow, string>;
  events!: Table<EventRow, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'dawacheck') {
    super(name);
    this.version(1).stores({
      packs: 'name',
      checks: 'id, createdAt, level',
      reports: 'id, createdAt',
      events: 'id, ts',
      meta: 'key',
    });
  }
}

export const db = new DawaDB();
