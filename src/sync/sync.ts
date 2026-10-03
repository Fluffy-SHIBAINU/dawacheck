import { db as defaultDb, type DawaDB, type EventRow, type ReportRow } from '../data/db';
import { markReportsSynced, pendingReports } from '../data/reports';
import { markEventsSynced, pendingEvents } from '../telemetry/events';
import { savePack } from '../data/packs';
import { setMeta } from '../data/meta';
import { compareVersions, validateManifest } from '../core/manifest';
import { sha256Hex } from '../core/sha';
import type { CommunityFlag, Correction, PackEntry, RegisterPack } from '../core/types';
import { syncConfig, type SyncConfig } from './config';
import { authHeaders, DEFAULT_RETRY, fetchWithRetry, type RetryOpts } from './http';

export interface SyncSummary {
  at: string;
  ok: boolean;
  sentReports: number;
  sentEvents: number;
  registerFrom: number | null;
  registerTo: number | null;
  alertsUpdated: boolean;
  flags: number;
  corrections: number;
  errors: string[];
}

export interface SyncDeps {
  fetchImpl?: typeof fetch;
  d?: DawaDB;
  config?: SyncConfig;
  consent: boolean;
  deviceId: string;
  localVersions: { register: string; alerts: string; registerCount: number };
  retry?: RetryOpts;
  minRegisterCount?: number;
}

const toServerReport = (r: ReportRow, deviceId: string) => ({
  id: r.id, device_id: deviceId, created_at: r.createdAt, nrn: r.nrn, product_name: r.productName, reason: r.reason,
  verdict: r.verdict, state: r.state, note: r.note, photo_thumb: r.photoThumb, ocr_excerpt: r.ocrExcerpt,
  lang: r.lang, app_version: r.appVersion, pack_version: r.packVersion,
});

const toServerEvent = (e: EventRow, deviceId: string) => ({
  id: e.id, device_id: deviceId, ts: e.ts, type: e.type, props: e.props, lang: e.lang, app_version: e.appVersion, pack_version: e.packVersion,
});

const REPORT_BATCH = 10;

function insertError(table: string, status: number): Error {
  // The backend caps rows per device per day. Keep them queued; a later sync sends them.
  return new Error(status === 429 ? `${table} rate_limited` : `${table} HTTP ${status}`);
}

/**
 * Plain INSERTs, not `on_conflict=id`: under the insert-only RLS policies anon cannot see stored rows,
 * so Postgres rejects ON CONFLICT on a retried id (42501) and the queue would stick. A plain insert of a
 * stored id is a unique violation (409), which means "already stored": retry row by row and skip those.
 */
async function postRows(f: typeof fetch, cfg: SyncConfig, table: string, rows: object[], retry: RetryOpts): Promise<void> {
  const post = (body: object) =>
    fetchWithRetry(f, `${cfg.url}/rest/v1/${table}`, { method: 'POST', headers: authHeaders(cfg, { Prefer: 'return=minimal' }), body: JSON.stringify(body) }, retry);
  const res = await post(rows);
  if (res.ok) return;
  if (res.status !== 409) throw insertError(table, res.status);
  for (const row of rows) {
    const one = await post(row);
    if (!one.ok && one.status !== 409) throw insertError(table, one.status);
  }
}

async function getJson<T>(f: typeof fetch, cfg: SyncConfig, path: string, retry: RetryOpts): Promise<T> {
  const res = await fetchWithRetry(f, `${cfg.url}${path}`, { headers: authHeaders(cfg) }, retry);
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function download(f: typeof fetch, cfg: SyncConfig, entry: PackEntry, retry: RetryOpts): Promise<string> {
  const res = await fetchWithRetry(f, `${cfg.url}/storage/v1/object/public/packs/${entry.file}`, {}, retry);
  if (!res.ok) throw new Error(`${entry.file} HTTP ${res.status}`);
  const text = await res.text();
  if ((await sha256Hex(text)) !== entry.sha256) throw new Error(`${entry.file} checksum mismatch`);
  return text;
}

async function run(deps: SyncDeps): Promise<SyncSummary> {
  const cfg = deps.config ?? syncConfig();
  const f = deps.fetchImpl ?? fetch.bind(globalThis);
  const d = deps.d ?? defaultDb;
  const retry = deps.retry ?? DEFAULT_RETRY;
  const minCount = deps.minRegisterCount ?? 5000;
  const s: SyncSummary = { at: new Date().toISOString(), ok: true, sentReports: 0, sentEvents: 0, registerFrom: null, registerTo: null, alertsUpdated: false, flags: 0, corrections: 0, errors: [] };
  if (!cfg.enabled) {
    s.ok = false;
    s.errors.push('sync not configured');
    return s;
  }
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      s.ok = false;
      s.errors.push(`${name}: ${(e as Error).message}`);
    }
  };

  await step('reports', async () => {
    const pending = await pendingReports(d);
    // Batches of 10 divide the server's cap of 20 reports per device per day, so a busy phone
    // sends up to the cap and keeps the rest instead of failing a whole oversized batch.
    for (let i = 0; i < pending.length; i += REPORT_BATCH) {
      const batch = pending.slice(i, i + REPORT_BATCH);
      await postRows(f, cfg, 'reports', batch.map((r) => toServerReport(r, deps.deviceId)), retry);
      await markReportsSynced(batch.map((r) => r.id), s.at, d);
      s.sentReports += batch.length;
    }
  });

  if (deps.consent) {
    await step('events', async () => {
      for (;;) {
        const batch = await pendingEvents(500, d);
        if (!batch.length) break;
        await postRows(f, cfg, 'events', batch.map((e) => toServerEvent(e, deps.deviceId)), retry);
        await markEventsSynced(batch.map((e) => e.id), s.at, d);
        s.sentEvents += batch.length;
        if (batch.length < 500) break;
      }
    });
  }

  await step('flags', async () => {
    const rows = await getJson<CommunityFlag[]>(f, cfg, '/rest/v1/community_flags?select=*', retry);
    await savePack('flags', s.at, JSON.stringify(rows), d);
    s.flags = rows.length;
  });

  await step('corrections', async () => {
    const rows = await getJson<Correction[]>(f, cfg, '/rest/v1/nrn_corrections?select=*', retry);
    await savePack('corrections', s.at, JSON.stringify(rows), d);
    s.corrections = rows.length;
  });

  await step('packs', async () => {
    const res = await fetchWithRetry(f, `${cfg.url}/storage/v1/object/public/packs/manifest.json`, {}, retry);
    if (res.status === 404 || res.status === 400) return;
    if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
    const m = validateManifest(await res.json());
    if (compareVersions(m.packs.register.version, deps.localVersions.register) > 0) {
      const text = await download(f, cfg, m.packs.register, retry);
      const pack = JSON.parse(text) as RegisterPack;
      if (!Array.isArray(pack.products) || pack.products.length < minCount) throw new Error('register pack too small');
      await savePack('register', m.packs.register.version, text, d);
      s.registerFrom = deps.localVersions.registerCount;
      s.registerTo = pack.products.length;
    }
    if (compareVersions(m.packs.alerts.version, deps.localVersions.alerts) > 0) {
      const text = await download(f, cfg, m.packs.alerts, retry);
      JSON.parse(text);
      await savePack('alerts', m.packs.alerts.version, text, d);
      s.alertsUpdated = true;
    }
  });

  await setMeta('lastSync', s, d);
  return s;
}

let inflight: Promise<SyncSummary> | null = null;

export function syncNow(deps: SyncDeps): Promise<SyncSummary> {
  inflight ??= run(deps).finally(() => {
    inflight = null;
  });
  return inflight;
}
