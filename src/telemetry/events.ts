import { db as defaultDb, type DawaDB, type EventRow } from '../data/db';
import { uuid } from '../data/meta';
import { APP_VERSION } from '../lib/version';

export type EventType =
  | 'app_open'
  | 'lang_selected'
  | 'consent_changed'
  | 'scan_started'
  | 'ocr_done'
  | 'ocr_failed'
  | 'crop_used'
  | 'manual_entry'
  | 'nrn_corrected'
  | 'suggestion_chosen'
  | 'verdict_shown'
  | 'voice_played'
  | 'report_saved'
  | 'report_sms_opened'
  | 'sync_ok'
  | 'sync_failed';

export type EventProp = string | number | boolean | null | string[];

let context = { lang: 'en', packVersion: '' };

export function setEventContext(c: { lang?: string; packVersion?: string }): void {
  context = { ...context, ...c };
}

export function sanitizeProps(props: Record<string, EventProp>): Record<string, EventProp> {
  const out: Record<string, EventProp> = {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === 'string') out[k] = v.slice(0, 64);
    else if (Array.isArray(v)) out[k] = v.slice(0, 20).map((s) => String(s).slice(0, 32));
    else out[k] = v;
  }
  return out;
}

export async function logEvent(type: EventType, props: Record<string, EventProp> = {}, d: DawaDB = defaultDb): Promise<EventRow> {
  const row: EventRow = {
    id: uuid(),
    ts: new Date().toISOString(),
    type,
    props: sanitizeProps(props),
    lang: context.lang,
    appVersion: APP_VERSION,
    packVersion: context.packVersion,
    syncedAt: null,
  };
  await d.events.put(row);
  await pruneEvents(5000, d);
  return row;
}

export function pendingEvents(limit = 500, d: DawaDB = defaultDb): Promise<EventRow[]> {
  return d.events.filter((e) => !e.syncedAt).limit(limit).toArray();
}

export function countPendingEvents(d: DawaDB = defaultDb): Promise<number> {
  return d.events.filter((e) => !e.syncedAt).count();
}

export async function markEventsSynced(ids: string[], at: string, d: DawaDB = defaultDb): Promise<void> {
  await d.events.where('id').anyOf(ids).modify({ syncedAt: at });
}

export async function pruneEvents(max: number, d: DawaDB = defaultDb): Promise<void> {
  const n = await d.events.count();
  if (n <= max) return;
  const synced = await d.events.orderBy('ts').filter((e) => Boolean(e.syncedAt)).limit(n - max).primaryKeys();
  await d.events.bulkDelete(synced);
  const n2 = await d.events.count();
  if (n2 > max) await d.events.bulkDelete(await d.events.orderBy('ts').limit(n2 - max).primaryKeys());
}
