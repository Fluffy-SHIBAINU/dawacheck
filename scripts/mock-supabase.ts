import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import {
  communityFlags, dashActivity, dashByReason, dashByState, dashUnknown, nrnCorrections,
  type ServerEvent, type ServerReport,
} from './lib/aggregate';

export interface MockState {
  reports: ServerReport[];
  events: ServerEvent[];
  storage: Record<string, string>;
}

/** Same per-device daily caps as the triggers in supabase/schema.sql. */
export const DAILY_LIMITS = { reports: 20, events: 2000 } as const;
const DAY = 86_400_000;

type Row = Record<string, unknown>;

/**
 * What Postgres does with one INSERT statement on reports or events, row by row:
 * - an id that is already stored is a unique violation (409). With `on_conflict` it would be skipped,
 *   but under the insert-only RLS policies anon cannot see the stored row, so Postgres raises 42501 instead;
 * - a new row that takes its device past `limit` rows received in 24 h fails the cap trigger (429).
 * Any failure aborts the whole statement, so nothing is inserted.
 */
export function planInsert(existing: Row[], rows: Row[], limit: number, onConflict: boolean, now = Date.now()): { status: 201 | 403 | 409 | 429; insert: Row[] } {
  const recent = new Map<string, number>();
  for (const x of existing) {
    const t = Date.parse(String(x.received_at ?? x.created_at ?? x.ts ?? ''));
    if (now - t < DAY) recent.set(String(x.device_id), (recent.get(String(x.device_id)) ?? 0) + 1);
  }
  const ids = new Set(existing.map((x) => x.id));
  const insert: Row[] = [];
  for (const r of rows) {
    if (ids.has(r.id)) return { status: onConflict ? 403 : 409, insert: [] };
    const n = (recent.get(String(r.device_id)) ?? 0) + 1;
    if (n > limit) return { status: 429, insert: [] };
    recent.set(String(r.device_id), n);
    ids.add(r.id);
    insert.push(r);
  }
  return { status: 201, insert };
}

function cors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'apikey, authorization, content-type, prefer, x-upsert, accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
}

function send(res: ServerResponse, status: number, body?: unknown) {
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
}

function raw(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let s = '';
    req.setEncoding('utf8');
    req.on('data', (c: string) => (s += c));
    req.on('end', () => resolve(s));
    req.on('error', reject);
  });
}

export function startMock(port = 54321): Promise<{ url: string; state: MockState; close: () => Promise<void> }> {
  const state: MockState = { reports: [], events: [], storage: {} };
  const server = createServer(async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') return send(res, 204);
    const path = new URL(req.url ?? '/', 'http://mock').pathname;
    try {
      if (path === '/__health') return send(res, 200, { ok: true });
      if (path === '/__reset' && req.method === 'POST') {
        state.reports = [];
        state.events = [];
        state.storage = {};
        return send(res, 200, { ok: true });
      }
      if (path === '/__seed' && req.method === 'POST') {
        const b = JSON.parse((await raw(req)) || '{}') as Partial<MockState>;
        state.reports.push(...(b.reports ?? []));
        state.events.push(...(b.events ?? []));
        Object.assign(state.storage, b.storage ?? {});
        return send(res, 200, { ok: true });
      }
      if (path === '/__state') {
        return send(res, 200, { reports: state.reports.length, events: state.events.length, storage: Object.keys(state.storage), lastReport: state.reports.at(-1) ?? null });
      }
      if (path.startsWith('/rest/v1/')) {
        if (!req.headers.apikey) return send(res, 401, { message: 'No API key found in request' });
        const table = path.slice('/rest/v1/'.length);
        if (req.method === 'POST' && (table === 'reports' || table === 'events')) {
          const body = JSON.parse(await raw(req)) as unknown;
          const rows = (Array.isArray(body) ? body : [body]) as (ServerReport & ServerEvent)[];
          const list = (table === 'reports' ? state.reports : state.events) as unknown as Row[];
          const onConflict = new URL(req.url ?? '/', 'http://mock').searchParams.has('on_conflict');
          const plan = planInsert(list, rows as unknown as Row[], DAILY_LIMITS[table], onConflict);
          if (plan.status === 409) return send(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint' });
          if (plan.status === 403) return send(res, 403, { code: '42501', message: `new row violates row-level security policy for table "${table}"` });
          if (plan.status === 429) return send(res, 429, { code: 'PT429', message: 'rate limited' });
          const receivedAt = new Date().toISOString();
          for (const r of plan.insert) list.push({ ...r, received_at: receivedAt });
          return send(res, 201);
        }
        if (req.method === 'GET') {
          const now = new Date();
          const views: Record<string, () => unknown> = {
            community_flags: () => communityFlags(state.reports, now),
            nrn_corrections: () => nrnCorrections(state.events, now),
            dash_activity: () => dashActivity(state.events, state.reports, now),
            dash_by_state: () => dashByState(state.reports, now),
            dash_by_reason: () => dashByReason(state.reports, now),
            dash_unknown_nrns: () => dashUnknown(state.reports),
          };
          const view = views[table];
          return view ? send(res, 200, view()) : send(res, 404, { message: `relation ${table} does not exist` });
        }
      }
      const pub = '/storage/v1/object/public/packs/';
      const priv = '/storage/v1/object/packs/';
      if (req.method === 'GET' && path.startsWith(pub)) {
        const f = decodeURIComponent(path.slice(pub.length));
        if (!(f in state.storage)) return send(res, 404, { message: 'Object not found' });
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(state.storage[f]);
        return;
      }
      if ((req.method === 'POST' || req.method === 'PUT') && path.startsWith(priv)) {
        if (!req.headers.authorization) return send(res, 401, { message: 'unauthorized' });
        const f = decodeURIComponent(path.slice(priv.length));
        state.storage[f] = await raw(req);
        return send(res, 200, { Key: `packs/${f}` });
      }
      return send(res, 404, { message: 'no route' });
    } catch (e) {
      return send(res, 500, { message: (e as Error).message });
    }
  });
  return new Promise((resolve) => {
    server.listen(port, () => {
      const p = (server.address() as AddressInfo).port;
      resolve({ url: `http://localhost:${p}`, state, close: () => new Promise<void>((r) => server.close(() => r())) });
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void startMock(Number(process.env.MOCK_PORT ?? 54321)).then((m) => console.log(`mock supabase listening on ${m.url}`));
}
