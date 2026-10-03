# Phase 5: Sync, learning, dashboard

Read the plan index Global Constraints first. Spec reference: §11 (events, sync, backend, learning), §13 (dashboard).

---

### Task 20: Supabase schema, aggregation mirror and mock server

**Files:**
- Create: `supabase/schema.sql`, `scripts/lib/aggregate.ts`, `scripts/mock-supabase.ts`
- Modify: `playwright.config.ts` (second webServer for the mock)
- Test: `tests/scripts/aggregate.test.ts`, `tests/scripts/mock.test.ts`

**Interfaces:**
- Consumes: `CommunityFlag`, `Correction` (Task 2).
- Produces:
  - SQL: tables `reports` and `events`, insert-only RLS for `anon`, views `community_flags`, `nrn_corrections`, `dash_activity`, `dash_by_state`, `dash_by_reason`, `dash_unknown_nrns`, and public bucket `packs`.
  - `interface ServerReport { id: string; device_id: string; created_at: string; nrn: string | null; reason: string; verdict: string; state: string | null; [k: string]: unknown }`, `interface ServerEvent { id: string; device_id: string; ts: string; type: string; props: Record<string, unknown>; [k: string]: unknown }`.
  - `communityFlags(reports, now): CommunityFlag[]`, `nrnCorrections(events, now): Correction[]`, `dashActivity(events, reports, now): { checks: number; red: number; devices: number; reports: number }[]`, `dashByState(reports, now): { state: string; reports: number }[]`, `dashByReason(reports, now): { reason: string; reports: number }[]`, `dashUnknown(reports): { nrn: string; reports: number; devices: number; last_report_at: string }[]`.
  - `startMock(port?: number): Promise<{ url: string; state: MockState; close: () => Promise<void> }>` with routes `POST/GET /rest/v1/*`, `GET /storage/v1/object/public/packs/:file`, `POST|PUT /storage/v1/object/packs/:file`, and test routes `GET /__health`, `POST /__reset`, `POST /__seed`, `GET /__state`.

- [ ] **Step 1: Write `supabase/schema.sql`**

```sql
-- DawaCheck backend. Paste into the Supabase SQL editor once (safe to re-run).
create table if not exists public.reports (
  id uuid primary key,
  device_id uuid not null,
  created_at timestamptz not null,
  received_at timestamptz not null default now(),
  nrn text check (char_length(nrn) <= 20),
  product_name text check (char_length(product_name) <= 200),
  reason text not null check (reason in ('not_in_register','name_mismatch','strength_mismatch','pack_expired','reg_lapsed','on_alert','batch_on_alert','alert_product','community_flag','looks_different','other')),
  verdict text not null check (verdict in ('green','amber','red','unknown')),
  state text check (char_length(state) <= 3),
  note text check (char_length(note) <= 500),
  photo_thumb text check (char_length(photo_thumb) <= 90000),
  ocr_excerpt text check (char_length(ocr_excerpt) <= 500),
  lang text,
  app_version text,
  pack_version text
);

create table if not exists public.events (
  id uuid primary key,
  device_id uuid not null,
  ts timestamptz not null,
  received_at timestamptz not null default now(),
  type text not null check (char_length(type) <= 40),
  props jsonb not null default '{}'::jsonb,
  lang text,
  app_version text,
  pack_version text
);

create index if not exists reports_nrn_idx on public.reports (nrn, created_at);
create index if not exists events_type_idx on public.events (type, ts);

alter table public.reports enable row level security;
alter table public.events enable row level security;
drop policy if exists "anon inserts reports" on public.reports;
create policy "anon inserts reports" on public.reports for insert to anon with check (true);
drop policy if exists "anon inserts events" on public.events;
create policy "anon inserts events" on public.events for insert to anon with check (true);

-- Learning: numbers reported by several phones become community flags.
create or replace view public.community_flags as
select nrn,
       count(*)::int as reports,
       count(distinct device_id)::int as devices,
       coalesce(array_agg(distinct state) filter (where state is not null), '{}') as states,
       case when count(*) >= 5 and count(distinct device_id) >= 3 then 'warning' else 'watch' end as level,
       max(created_at) as last_report_at
from public.reports
where nrn is not null and created_at > now() - interval '14 days'
group by nrn
having count(*) >= 3 and count(distinct device_id) >= 2;

-- Learning: user corrections of misread numbers.
create or replace view public.nrn_corrections as
select props->>'read' as read, props->>'corrected' as corrected, count(*)::int as n
from public.events
where type = 'nrn_corrected' and ts > now() - interval '90 days' and props ? 'read' and props ? 'corrected'
group by 1, 2;

create or replace view public.dash_activity as
select count(*) filter (where type = 'verdict_shown')::int as checks,
       count(*) filter (where type = 'verdict_shown' and props->>'level' = 'red')::int as red,
       count(distinct device_id)::int as devices,
       (select count(*)::int from public.reports where created_at > now() - interval '7 days') as reports
from public.events
where ts > now() - interval '7 days';

create or replace view public.dash_by_state as
select coalesce(state, '??') as state, count(*)::int as reports
from public.reports where created_at > now() - interval '7 days'
group by 1 order by 2 desc;

create or replace view public.dash_by_reason as
select reason, count(*)::int as reports
from public.reports where created_at > now() - interval '7 days'
group by 1 order by 2 desc;

create or replace view public.dash_unknown_nrns as
select nrn, count(*)::int as reports, count(distinct device_id)::int as devices, max(created_at) as last_report_at
from public.reports
where reason = 'not_in_register' and nrn is not null
group by nrn having count(*) >= 2
order by 2 desc;

grant select on public.community_flags, public.nrn_corrections, public.dash_activity,
  public.dash_by_state, public.dash_by_reason, public.dash_unknown_nrns to anon;

insert into storage.buckets (id, name, public) values ('packs', 'packs', true) on conflict (id) do nothing;
```

- [ ] **Step 2: Write the failing tests**

`tests/scripts/aggregate.test.ts`:
```ts
import { communityFlags, dashActivity, dashByReason, dashByState, dashUnknown, nrnCorrections, type ServerEvent, type ServerReport } from '../../scripts/lib/aggregate';

const now = new Date('2026-10-03T12:00:00Z');
const r = (nrn: string | null, device: string, state: string | null, reason = 'name_mismatch', daysAgo = 1): ServerReport => ({
  id: `${nrn}-${device}-${Math.random()}`,
  device_id: device,
  created_at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  nrn,
  reason,
  verdict: 'amber',
  state,
});

test('community flags need 3 reports from 2 phones within 14 days', () => {
  const reports = [r('A4-6238', 'd1', 'KN'), r('A4-6238', 'd1', 'KN'), r('A4-6238', 'd2', 'KD'), r('B4-1', 'd1', null), r('B4-1', 'd1', null), r('B4-1', 'd1', null), r('C4-9', 'd1', 'KN', 'other', 20), r('C4-9', 'd2', 'KN', 'other', 20), r('C4-9', 'd3', 'KN', 'other', 20)];
  const flags = communityFlags(reports, now);
  expect(flags).toHaveLength(1);
  expect(flags[0]).toMatchObject({ nrn: 'A4-6238', reports: 3, devices: 2, states: ['KD', 'KN'], level: 'watch' });
});

test('5 reports from 3 phones escalate to warning', () => {
  const reports = ['d1', 'd2', 'd3', 'd1', 'd2'].map((d) => r('A4-6238', d, 'KN'));
  expect(communityFlags(reports, now)[0].level).toBe('warning');
});

test('corrections are grouped from nrn_corrected events', () => {
  const ev = (read: string, corrected: string): ServerEvent => ({ id: Math.random().toString(), device_id: 'd', ts: now.toISOString(), type: 'nrn_corrected', props: { read, corrected } });
  expect(nrnCorrections([ev('A4-6239', 'A4-6238'), ev('A4-6239', 'A4-6238'), { ...ev('x', 'y'), type: 'app_open' }], now)).toEqual([{ read: 'A4-6239', corrected: 'A4-6238', n: 2 }]);
});

test('dashboard aggregates', () => {
  const reports = [r('A', 'd1', 'KN', 'not_in_register'), r('A', 'd2', 'KN', 'not_in_register'), r('B', 'd1', 'LA', 'pack_expired')];
  const events: ServerEvent[] = [
    { id: '1', device_id: 'd1', ts: now.toISOString(), type: 'verdict_shown', props: { level: 'red' } },
    { id: '2', device_id: 'd2', ts: now.toISOString(), type: 'verdict_shown', props: { level: 'green' } },
  ];
  expect(dashActivity(events, reports, now)).toEqual([{ checks: 2, red: 1, devices: 2, reports: 3 }]);
  expect(dashByState(reports, now)).toEqual([{ state: 'KN', reports: 2 }, { state: 'LA', reports: 1 }]);
  expect(dashByReason(reports, now)[0]).toEqual({ reason: 'not_in_register', reports: 2 });
  expect(dashUnknown(reports)).toEqual([expect.objectContaining({ nrn: 'A', reports: 2, devices: 2 })]);
});
```

`tests/scripts/mock.test.ts`:
```ts
// @vitest-environment node
import { startMock } from '../../scripts/mock-supabase';

test('mock accepts inserts, dedupes ids, computes views and serves storage', async () => {
  const m = await startMock(0);
  try {
    const h = { apikey: 'k', Authorization: 'Bearer k', 'Content-Type': 'application/json' };
    const rows = ['d1', 'd2', 'd1'].map((d, i) => ({ id: `r${i}`, device_id: d, created_at: new Date().toISOString(), nrn: 'A4-6238', reason: 'name_mismatch', verdict: 'amber', state: 'KN' }));
    expect((await fetch(`${m.url}/rest/v1/reports?on_conflict=id`, { method: 'POST', headers: h, body: JSON.stringify(rows) })).status).toBe(201);
    await fetch(`${m.url}/rest/v1/reports`, { method: 'POST', headers: h, body: JSON.stringify(rows[0]) });
    expect(m.state.reports).toHaveLength(3);
    const flags = await (await fetch(`${m.url}/rest/v1/community_flags?select=*`, { headers: h })).json();
    expect(flags[0]).toMatchObject({ nrn: 'A4-6238', reports: 3 });
    expect((await fetch(`${m.url}/rest/v1/community_flags`)).status).toBe(401);
    await fetch(`${m.url}/storage/v1/object/packs/manifest.json`, { method: 'POST', headers: { ...h, 'x-upsert': 'true' }, body: '{"a":1}' });
    expect(await (await fetch(`${m.url}/storage/v1/object/public/packs/manifest.json`)).json()).toEqual({ a: 1 });
    expect((await fetch(`${m.url}/storage/v1/object/public/packs/missing.json`)).status).toBe(404);
    await fetch(`${m.url}/__reset`, { method: 'POST' });
    expect(m.state.reports).toHaveLength(0);
  } finally {
    await m.close();
  }
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/scripts/aggregate.test.ts tests/scripts/mock.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 4: Implement**

`scripts/lib/aggregate.ts`:
```ts
import type { CommunityFlag, Correction } from '../../src/core/types';

export interface ServerReport {
  id: string;
  device_id: string;
  created_at: string;
  nrn: string | null;
  reason: string;
  verdict: string;
  state: string | null;
  [k: string]: unknown;
}

export interface ServerEvent {
  id: string;
  device_id: string;
  ts: string;
  type: string;
  props: Record<string, unknown>;
  [k: string]: unknown;
}

const DAY = 86_400_000;
const within = (iso: string, now: Date, days: number) => new Date(iso).getTime() > now.getTime() - days * DAY;

function group<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const arr = m.get(k);
    if (arr) arr.push(x);
    else m.set(k, [x]);
  }
  return m;
}

export function communityFlags(reports: ServerReport[], now: Date): CommunityFlag[] {
  const recent = reports.filter((r) => r.nrn && within(r.created_at, now, 14));
  const out: CommunityFlag[] = [];
  for (const [nrn, rs] of group(recent, (r) => r.nrn!)) {
    const devices = new Set(rs.map((r) => r.device_id)).size;
    if (rs.length < 3 || devices < 2) continue;
    out.push({
      nrn,
      reports: rs.length,
      devices,
      states: [...new Set(rs.map((r) => r.state).filter((s): s is string => Boolean(s)))].sort(),
      level: rs.length >= 5 && devices >= 3 ? 'warning' : 'watch',
      last_report_at: rs.map((r) => r.created_at).sort().at(-1)!,
    });
  }
  return out;
}

export function nrnCorrections(events: ServerEvent[], now: Date): Correction[] {
  const ok = events.filter((e) => e.type === 'nrn_corrected' && within(e.ts, now, 90) && e.props.read && e.props.corrected);
  return [...group(ok, (e) => `${e.props.read}|${e.props.corrected}`).values()].map((es) => ({
    read: String(es[0].props.read),
    corrected: String(es[0].props.corrected),
    n: es.length,
  }));
}

export function dashActivity(events: ServerEvent[], reports: ServerReport[], now: Date) {
  const recent = events.filter((e) => within(e.ts, now, 7));
  const shown = recent.filter((e) => e.type === 'verdict_shown');
  return [
    {
      checks: shown.length,
      red: shown.filter((e) => e.props.level === 'red').length,
      devices: new Set(recent.map((e) => e.device_id)).size,
      reports: reports.filter((r) => within(r.created_at, now, 7)).length,
    },
  ];
}

const counted = <K extends string>(m: Map<string, unknown[]>, key: K) =>
  [...m.entries()].map(([k, v]) => ({ [key]: k, reports: v.length }) as Record<K, string> & { reports: number }).sort((a, b) => b.reports - a.reports);

export function dashByState(reports: ServerReport[], now: Date) {
  return counted(group(reports.filter((r) => within(r.created_at, now, 7)), (r) => r.state ?? '??'), 'state');
}

export function dashByReason(reports: ServerReport[], now: Date) {
  return counted(group(reports.filter((r) => within(r.created_at, now, 7)), (r) => r.reason), 'reason');
}

export function dashUnknown(reports: ServerReport[]) {
  const unknown = reports.filter((r) => r.reason === 'not_in_register' && r.nrn);
  return [...group(unknown, (r) => r.nrn!).entries()]
    .filter(([, rs]) => rs.length >= 2)
    .map(([nrn, rs]) => ({ nrn, reports: rs.length, devices: new Set(rs.map((r) => r.device_id)).size, last_report_at: rs.map((r) => r.created_at).sort().at(-1)! }))
    .sort((a, b) => b.reports - a.reports);
}
```

`scripts/mock-supabase.ts`:
```ts
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
          const list = (table === 'reports' ? state.reports : state.events) as { id: string }[];
          for (const r of rows) if (!list.some((x) => x.id === r.id)) list.push(r);
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
```

```bash
npm pkg set scripts.mock="tsx scripts/mock-supabase.ts"
```

In `playwright.config.ts`, add a second `webServer` entry:
```ts
{ command: 'npm run mock', url: 'http://localhost:54321/__health', reuseExistingServer: !process.env.CI, timeout: 30_000 },
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/scripts/aggregate.test.ts tests/scripts/mock.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Supabase schema with learning views, plus a local mock for tests"
```

---

### Task 21: Sync client, triggers and sync UI

**Files:**
- Create: `src/sync/config.ts`, `src/sync/http.ts`, `src/sync/sync.ts`
- Modify: `src/state/AppContext.tsx`, `src/screens/Settings.tsx`, `src/screens/Home.tsx`, `tests/e2e/helpers.ts`
- Test: `tests/unit/sync/sync.test.ts`, `tests/e2e/sync.spec.ts`

**Interfaces:**
- Consumes: Tasks 11, 12, 20; `validateManifest`, `compareVersions`, `sha256Hex` (Task 5).
- Produces:
  - `interface SyncConfig { mode: 'supabase' | 'mock' | 'off'; url: string; anonKey: string; enabled: boolean }`, `syncConfig(env?: Record<string, string | undefined>): SyncConfig`.
  - `fetchWithRetry(f: typeof fetch, url: string, init?: RequestInit, retry?: RetryOpts): Promise<Response>`, `interface RetryOpts { tries: number; delays: number[]; timeoutMs: number }`, `authHeaders(cfg: SyncConfig, extra?: Record<string, string>): Record<string, string>`.
  - `interface SyncSummary { at: string; ok: boolean; sentReports: number; sentEvents: number; registerFrom: number | null; registerTo: number | null; alertsUpdated: boolean; flags: number; corrections: number; errors: string[] }`; `interface SyncDeps { fetchImpl?: typeof fetch; d?: DawaDB; config?: SyncConfig; consent: boolean; deviceId: string; localVersions: { register: string; alerts: string; registerCount: number }; retry?: RetryOpts; minRegisterCount?: number }`; `syncNow(deps: SyncDeps): Promise<SyncSummary>` (single-flight).
  - `AppApi` gains `syncing: boolean`, `lastSync: SyncSummary | null`, `syncEnabled: boolean`, `runSync(): Promise<void>`.
  - e2e helper `onboard(page, lang?, consent?)`.

- [ ] **Step 1: Write the failing unit test** `tests/unit/sync/sync.test.ts`

```ts
// @vitest-environment node
import 'fake-indexeddb/auto';
import { createHash } from 'node:crypto';
import { startMock } from '../../../scripts/mock-supabase';
import { DawaDB } from '../../../src/data/db';
import { saveReport, pendingReports } from '../../../src/data/reports';
import { logEvent, pendingEvents } from '../../../src/telemetry/events';
import { syncNow, type SyncDeps } from '../../../src/sync/sync';
import { syncConfig } from '../../../src/sync/config';
import { product } from '../../helpers/fixtures';

const fresh = () => new DawaDB(`t-${Math.random()}`);
const retry = { tries: 1, delays: [0], timeoutMs: 5000 };
const report = (nrn: string) => ({ checkId: null, nrn, productName: null, reason: 'name_mismatch' as const, verdict: 'amber' as const, state: 'KN', note: null, photoThumb: null, ocrExcerpt: null, lang: 'en', packVersion: 'v' });

async function setup(consent = true) {
  const m = await startMock(0);
  const d = fresh();
  const deps: SyncDeps = {
    d,
    consent,
    deviceId: '11111111-1111-4111-8111-111111111111',
    config: { mode: 'mock', url: m.url, anonKey: 'k', enabled: true },
    localVersions: { register: '2026-10-03', alerts: '2026-10-03', registerCount: 7 },
    retry,
    minRegisterCount: 3,
  };
  return { m, d, deps };
}

test('pushes reports and, with consent, events; marks them synced', async () => {
  const { m, d, deps } = await setup(true);
  try {
    await saveReport(report('A4-6238'), d);
    await logEvent('app_open', {}, d);
    const s = await syncNow(deps);
    expect(s).toMatchObject({ ok: true, sentReports: 1, sentEvents: 1 });
    expect(m.state.reports[0]).toMatchObject({ nrn: 'A4-6238', device_id: deps.deviceId, reason: 'name_mismatch' });
    expect(await pendingReports(d)).toEqual([]);
    expect(await pendingEvents(500, d)).toEqual([]);
  } finally {
    await m.close();
  }
});

test('without consent, events stay on the phone', async () => {
  const { m, d, deps } = await setup(false);
  try {
    await logEvent('app_open', {}, d);
    const s = await syncNow(deps);
    expect(s.sentEvents).toBe(0);
    expect(m.state.events).toHaveLength(0);
    expect(await pendingEvents(500, d)).toHaveLength(1);
  } finally {
    await m.close();
  }
});

test('pulls community flags and corrections into packs', async () => {
  const { m, d, deps } = await setup();
  try {
    const now = new Date().toISOString();
    m.state.reports.push(...['a', 'b', 'a'].map((dev, i) => ({ id: `x${i}`, device_id: dev, created_at: now, nrn: 'A4-6238', reason: 'name_mismatch', verdict: 'amber', state: 'KN' })));
    m.state.events.push({ id: 'e1', device_id: 'a', ts: now, type: 'nrn_corrected', props: { read: 'A4-6239', corrected: 'A4-6238' } });
    const s = await syncNow(deps);
    expect(s).toMatchObject({ flags: 1, corrections: 1 });
    expect(JSON.parse((await d.packs.get('flags'))!.json)[0].nrn).toBe('A4-6238');
    expect(JSON.parse((await d.packs.get('corrections'))!.json)[0].n).toBe(1);
  } finally {
    await m.close();
  }
});

test('downloads a newer register pack after checking its sha256', async () => {
  const { m, d, deps } = await setup();
  try {
    const pack = JSON.stringify({ version: '2026-10-04', source: 't', fetchedAt: 'x', products: [1, 2, 3, 4].map((i) => product({ nrn: `A4-${1000 + i}`, name: `P${i}` })) });
    const sha = createHash('sha256').update(pack).digest('hex');
    const alerts = JSON.stringify({ version: '2026-10-03', fetchedAt: 'x', alerts: [] });
    m.state.storage['register.json'] = pack;
    m.state.storage['alerts.json'] = alerts;
    m.state.storage['manifest.json'] = JSON.stringify({
      schema: 1,
      generatedAt: 'x',
      packs: {
        register: { version: '2026-10-04', file: 'register.json', sha256: sha, count: 4, bytes: pack.length },
        alerts: { version: '2026-10-03', file: 'alerts.json', sha256: createHash('sha256').update(alerts).digest('hex'), count: 0, bytes: alerts.length },
      },
    });
    const s = await syncNow(deps);
    expect(s).toMatchObject({ ok: true, registerFrom: 7, registerTo: 4, alertsUpdated: false });
    expect((await d.packs.get('register'))?.version).toBe('2026-10-04');
  } finally {
    await m.close();
  }
});

test('a checksum mismatch is rejected', async () => {
  const { m, d, deps } = await setup();
  try {
    m.state.storage['register.json'] = '{"version":"2026-10-04","products":[1,2,3,4]}';
    m.state.storage['manifest.json'] = JSON.stringify({
      schema: 1, generatedAt: 'x',
      packs: { register: { version: '2026-10-04', file: 'register.json', sha256: 'b'.repeat(64), count: 4, bytes: 1 }, alerts: { version: '2026-10-03', file: 'alerts.json', sha256: 'c'.repeat(64), count: 0, bytes: 1 } },
    });
    const s = await syncNow(deps);
    expect(s.ok).toBe(false);
    expect(s.errors.join(' ')).toMatch(/checksum/);
    expect(await d.packs.get('register')).toBeUndefined();
  } finally {
    await m.close();
  }
});

test('server unreachable: no throw, reports stay queued', async () => {
  const d = fresh();
  await saveReport(report('A4-1'), d);
  const s = await syncNow({ d, consent: true, deviceId: 'x', config: { mode: 'mock', url: 'http://localhost:1', anonKey: 'k', enabled: true }, localVersions: { register: 'v', alerts: 'v', registerCount: 0 }, retry });
  expect(s.ok).toBe(false);
  expect(await pendingReports(d)).toHaveLength(1);
});

test('syncConfig is disabled without url or key', () => {
  expect(syncConfig({ VITE_SYNC_MODE: 'supabase' }).enabled).toBe(false);
  expect(syncConfig({ VITE_SYNC_MODE: 'off', VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' }).enabled).toBe(false);
  expect(syncConfig({ VITE_SYNC_MODE: 'mock', VITE_SUPABASE_URL: 'http://x/', VITE_SUPABASE_ANON_KEY: 'k' })).toEqual({ mode: 'mock', url: 'http://x', anonKey: 'k', enabled: true });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/sync/sync.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/sync/config.ts`:
```ts
export interface SyncConfig {
  mode: 'supabase' | 'mock' | 'off';
  url: string;
  anonKey: string;
  enabled: boolean;
}

export function syncConfig(env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>): SyncConfig {
  // Unit tests render the whole app; never let them reach a real backend even if .env enables sync.
  if (env.MODE === 'test' || env.VITEST) return { mode: 'off', url: '', anonKey: '', enabled: false };
  const mode = (env.VITE_SYNC_MODE ?? 'off') as SyncConfig['mode'];
  const url = (env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
  const anonKey = env.VITE_SUPABASE_ANON_KEY ?? '';
  return { mode, url, anonKey, enabled: mode !== 'off' && Boolean(url) && Boolean(anonKey) };
}
```

`src/sync/http.ts`:
```ts
import type { SyncConfig } from './config';

export interface RetryOpts {
  tries: number;
  delays: number[];
  timeoutMs: number;
}

export const DEFAULT_RETRY: RetryOpts = { tries: 3, delays: [1000, 2000, 4000], timeoutMs: 15_000 };

export async function fetchWithRetry(f: typeof fetch, url: string, init: RequestInit = {}, retry: RetryOpts = DEFAULT_RETRY): Promise<Response> {
  let last: unknown = null;
  for (let i = 0; i < retry.tries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), retry.timeoutMs);
    try {
      const res = await f(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      clearTimeout(timer);
      last = e;
      if (i < retry.tries - 1) await new Promise((r) => setTimeout(r, retry.delays[i] ?? 4000));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

export function authHeaders(cfg: SyncConfig, extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}`, 'Content-Type': 'application/json', ...extra };
}
```

`src/sync/sync.ts`:
```ts
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

async function postRows(f: typeof fetch, cfg: SyncConfig, table: string, rows: object[], retry: RetryOpts): Promise<void> {
  const res = await fetchWithRetry(f, `${cfg.url}/rest/v1/${table}?on_conflict=id`, {
    method: 'POST',
    headers: authHeaders(cfg, { Prefer: 'resolution=ignore-duplicates,return=minimal' }),
    body: JSON.stringify(rows),
  }, retry);
  if (res.ok) return;
  if (res.status === 409) {
    for (const row of rows) {
      const one = await fetchWithRetry(f, `${cfg.url}/rest/v1/${table}`, { method: 'POST', headers: authHeaders(cfg, { Prefer: 'return=minimal' }), body: JSON.stringify(row) }, retry);
      if (!one.ok && one.status !== 409) throw new Error(`${table} HTTP ${one.status}`);
    }
    return;
  }
  throw new Error(`${table} HTTP ${res.status}`);
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
    for (let i = 0; i < pending.length; i += 50) {
      const batch = pending.slice(i, i + 50);
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
```

- [ ] **Step 4: Run unit tests**

Run: `npx vitest run tests/unit/sync/sync.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Wire sync into the app**

Modify `src/state/AppContext.tsx`:
1. Imports: `import { syncNow, type SyncSummary } from '../sync/sync'; import { syncConfig } from '../sync/config'; import { getDeviceId, getMeta } from '../data/meta';`
2. Extend `AppApi` with `syncing: boolean; lastSync: SyncSummary | null; syncEnabled: boolean; runSync: () => Promise<void>;`.
3. Inside `AppProvider`, after the existing state:
```tsx
const cfg = useMemo(() => syncConfig(), []);
const [syncing, setSyncing] = useState(false);
const [lastSync, setLastSync] = useState<SyncSummary | null>(null);
const latest = useRef({ packs, settings });
latest.current = { packs, settings };

const runSync = useCallback(async () => {
  const { packs: p, settings: s } = latest.current;
  if (!cfg.enabled || !p || !navigator.onLine) return;
  setSyncing(true);
  try {
    const summary = await syncNow({
      consent: s.consent,
      deviceId: await getDeviceId(),
      localVersions: { register: p.register.version, alerts: p.alerts.version, registerCount: p.register.products.length },
    });
    setLastSync(summary);
    void logEvent(summary.ok ? 'sync_ok' : 'sync_failed', summary.ok
      ? { reports: summary.sentReports, events: summary.sentEvents, packs: summary.registerTo !== null || summary.alertsUpdated }
      : { stage: summary.errors[0]?.split(':')[0] ?? 'unknown', error: (summary.errors[0] ?? '').slice(0, 60) });
    await reloadPacks();
    await refreshCounts();
  } finally {
    setSyncing(false);
  }
}, [cfg.enabled, reloadPacks, refreshCounts]);

useEffect(() => {
  void getMeta<SyncSummary>('lastSync').then((s) => s && setLastSync(s));
}, []);

useEffect(() => {
  if (status !== 'ready') return;
  void runSync();
  const onOnline = () => void runSync();
  const onVisible = () => {
    if (document.visibilityState === 'visible') void runSync();
  };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const timer = window.setInterval(() => void runSync(), 5 * 60_000);
  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(timer);
  };
}, [status, runSync]);
```
4. Add `syncing, lastSync, syncEnabled: cfg.enabled, runSync` to the `api` object.

Modify `src/screens/Settings.tsx`. Under the data card, add:
```tsx
{syncEnabled ? (
  <>
    <button type="button" className="btn btn-primary" disabled={syncing || !online} onClick={() => void runSync()} data-testid="sync-now">
      {syncing ? t('sync_running') : t('settings_sync')}
    </button>
    <span className="small muted" data-testid="last-sync">{t('settings_last_sync', { when: lastSync ? timeAgo(lastSync.at) : t('settings_never') })}</span>
    {lastSync && !lastSync.ok && <span className="small error">{t('sync_failed')}</span>}
  </>
) : (
  <p className="small muted">{t('settings_sync_off')}</p>
)}
```
(destructure `online, syncing, lastSync, syncEnabled, runSync` from `useApp()`; import `timeAgo`). Also render the register version line with `data-testid="register-version"`: `<span data-testid="register-version">{packs?.register.version}</span>` inside the data card.

Modify `src/screens/Home.tsx`. Below `<StatusPill />` show a recent sync summary:
```tsx
{lastSync && lastSync.ok && Date.now() - new Date(lastSync.at).getTime() < 120_000 && (
  <div className="card small" data-testid="sync-summary">
    <strong>{t('sync_sent', { reports: lastSync.sentReports, events: lastSync.sentEvents })}</strong>
    {lastSync.registerTo !== null && <span>{t('sync_register', { from: (lastSync.registerFrom ?? 0).toLocaleString('en'), to: lastSync.registerTo.toLocaleString('en') })}</span>}
    {lastSync.alertsUpdated && <span>{t('sync_alerts', { n: packs?.alerts.alerts.length ?? 0 })}</span>}
    <span>{t('sync_flags', { n: lastSync.flags })}</span>
  </div>
)}
```
(destructure `lastSync, packs` from `useApp()`).

Modify `tests/e2e/helpers.ts`. Change `onboard` to accept consent:
```ts
export async function onboard(page: Page, lang = 'English', consent = false) {
  await page.goto('/');
  await expect(page.getByText('Choose your language')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: lang, exact: false }).first().click();
  if (consent) await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Continue|Ci gaba/ }).click();
  await expect(page.getByTestId('check-button')).toBeVisible();
}

export const MOCK = 'http://localhost:54321';
```

- [ ] **Step 6: E2E** `tests/e2e/sync.spec.ts`

```ts
import { expect, test } from '@playwright/test';
import { MOCK, onboard, typeNumber } from './helpers';

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__reset`);
});

test('a queued report uploads when the connection returns', async ({ page, context, request }) => {
  await onboard(page, 'English', true);
  await context.setOffline(true);
  await typeNumber(page, 'A4-99231');
  await page.getByTestId('report-link').click();
  await page.getByRole('button', { name: 'Save report' }).click();
  await expect(page.getByText(/Reports waiting: 1/)).toBeVisible();
  await context.setOffline(false);
  await expect.poll(async () => (await (await request.get(`${MOCK}/__state`)).json()).reports, { timeout: 30_000 }).toBe(1);
  await expect.poll(async () => (await (await request.get(`${MOCK}/__state`)).json()).events, { timeout: 30_000 }).toBeGreaterThan(0);
});

test('Sync now in settings uploads immediately', async ({ page, request }) => {
  await onboard(page, 'English', false);
  await typeNumber(page, 'A4-99231');
  await page.getByTestId('report-link').click();
  await page.getByRole('button', { name: 'Save report' }).click();
  await page.goto('/#/settings');
  await page.getByTestId('sync-now').click();
  await expect.poll(async () => (await (await request.get(`${MOCK}/__state`)).json()).reports, { timeout: 30_000 }).toBe(1);
  expect((await (await request.get(`${MOCK}/__state`)).json()).events).toBe(0);
});
```

Run: `npm run e2e`
Expected: all specs PASS. The second test proves events stay local without consent.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: opportunistic sync of reports, opt-in usage events and learned data"
```

---

### Task 22: Learning loop E2E, `publish-packs` and `gaps`

**Files:**
- Modify: `scripts/build-manifest.ts` (accept `--dir=`)
- Create: `scripts/make-holdback.ts`, `scripts/publish-packs.ts`, `scripts/gaps.ts`
- Test: `tests/e2e/learning.spec.ts`, `tests/scripts/publish.test.ts`

**Interfaces:**
- Consumes: Tasks 5, 20, 21.
- Produces:
  - `npm run holdback -- --n=12`: copies the full register to `data/packs/` (today's version), then rewrites the bundled `public/packs/register.json` without its last N products at yesterday's version. This makes the demo show a real "Register updated" sync.
  - `npm run publish-packs -- --dir=<dir>`: uploads `register.json`, `alerts.json` and `manifest.json` (last) to Storage bucket `packs`.
  - `npm run gaps`: writes `data/coverage-gaps.csv`.
  - `publishPacks(opts: { dir: string; url: string; serviceKey: string; fetchImpl?: typeof fetch }): Promise<string[]>` exported from `scripts/publish-packs.ts`.

- [ ] **Step 1: Generalize the manifest builder**

In `scripts/build-manifest.ts`, read the directory from the arguments:
```ts
const dir = process.argv.find((a) => a.startsWith('--dir='))?.split('=')[1] ?? 'public/packs';
```
Replace every `public/packs/` path in that file with `${dir}/`.

- [ ] **Step 2: Write `scripts/make-holdback.ts`**

```ts
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { RegisterPack } from '../src/core/types';

const n = Number(process.argv.find((a) => a.startsWith('--n='))?.split('=')[1] ?? 12);
const full = JSON.parse(readFileSync('public/packs/register.json', 'utf8')) as RegisterPack;
const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

mkdirSync('data/packs', { recursive: true });
writeFileSync('data/packs/register.json', JSON.stringify({ ...full, version: today }));
copyFileSync('public/packs/alerts.json', 'data/packs/alerts.json');

const held: RegisterPack = { ...full, version: yesterday, products: full.products.slice(0, full.products.length - n) };
writeFileSync('public/packs/register.json', JSON.stringify(held));

execSync('npx tsx scripts/build-manifest.ts --dir=data/packs', { stdio: 'inherit' });
execSync('npx tsx scripts/build-manifest.ts --dir=public/packs', { stdio: 'inherit' });
console.log(`bundled register: ${held.products.length} products (${yesterday}); update pack: ${full.products.length} (${today})`);
```

Only run it once, right before the final production build (Task 24). Running it twice would shrink the pack again. The script refuses nothing, so check `docs/progress.md` before running it.

- [ ] **Step 3: Write `scripts/publish-packs.ts` and its test**

`scripts/publish-packs.ts`:
```ts
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { env } from './lib/env';

export async function publishPacks(opts: { dir: string; url: string; serviceKey: string; fetchImpl?: typeof fetch }): Promise<string[]> {
  const f = opts.fetchImpl ?? fetch;
  const done: string[] = [];
  for (const file of ['register.json', 'alerts.json', 'manifest.json']) {
    const body = readFileSync(`${opts.dir}/${file}`, 'utf8');
    const res = await f(`${opts.url.replace(/\/$/, '')}/storage/v1/object/packs/${file}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.serviceKey}`, apikey: opts.serviceKey, 'Content-Type': 'application/json', 'x-upsert': 'true', 'Cache-Control': 'no-cache' },
      body,
    });
    if (!res.ok) throw new Error(`upload ${file}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    done.push(file);
  }
  return done;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = env('VITE_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.');
    process.exit(2);
  }
  const dir = process.argv.find((a) => a.startsWith('--dir='))?.split('=')[1] ?? 'public/packs';
  publishPacks({ dir, url, serviceKey }).then((d) => console.log(`published ${d.join(', ')} from ${dir}`));
}
```

`tests/scripts/publish.test.ts`:
```ts
// @vitest-environment node
import { startMock } from '../../scripts/mock-supabase';
import { publishPacks } from '../../scripts/publish-packs';

test('publishes the three pack files to storage', async () => {
  const m = await startMock(0);
  try {
    const done = await publishPacks({ dir: 'public/packs', url: m.url, serviceKey: 'service' });
    expect(done).toEqual(['register.json', 'alerts.json', 'manifest.json']);
    expect(Object.keys(m.state.storage).sort()).toEqual(['alerts.json', 'manifest.json', 'register.json']);
  } finally {
    await m.close();
  }
});
```

`scripts/gaps.ts`:
```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { env } from './lib/env';

const url = env('VITE_SUPABASE_URL');
const key = env('VITE_SUPABASE_ANON_KEY');
if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env first.');
  process.exit(2);
}
const res = await fetch(`${url}/rest/v1/dash_unknown_nrns?select=*`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
const rows = (await res.json()) as { nrn: string; reports: number; devices: number; last_report_at: string }[];
mkdirSync('data', { recursive: true });
writeFileSync('data/coverage-gaps.csv', ['nrn,reports,devices,last_report_at', ...rows.map((r) => `${r.nrn},${r.reports},${r.devices},${r.last_report_at}`)].join('\n'));
console.log(`coverage gaps: ${rows.length} numbers written to data/coverage-gaps.csv`);
```

```bash
npm pkg set scripts.holdback="tsx scripts/make-holdback.ts" scripts.publish-packs="tsx scripts/publish-packs.ts" scripts.gaps="tsx scripts/gaps.ts"
npx vitest run tests/scripts/publish.test.ts
```
Expected: PASS.

- [ ] **Step 4: Learning E2E** `tests/e2e/learning.spec.ts`

```ts
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { MOCK, onboard, typeNumber } from './helpers';

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__reset`);
});

test('reports from other phones turn a registered number amber after sync', async ({ page, request }) => {
  const now = new Date().toISOString();
  await request.post(`${MOCK}/__seed`, {
    data: {
      reports: ['p1', 'p2', 'p1'].map((d, i) => ({ id: `seed-${i}`, device_id: d, created_at: now, nrn: 'A4-6238', reason: 'name_mismatch', verdict: 'amber', state: 'KN' })),
    },
  });
  await onboard(page);
  await page.goto('/#/settings');
  await page.getByTestId('sync-now').click();
  await expect(page.getByTestId('data-card')).toContainText('Community flags: 1');
  await typeNumber(page, 'A4-6238');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'amber');
  await expect(page.getByText('Other users reported this number recently (3 reports).')).toBeVisible();
});

test('a newer register published to storage is downloaded on sync', async ({ page, request }) => {
  const reg = JSON.parse(readFileSync('public/packs/register.json', 'utf8'));
  const alerts = readFileSync('public/packs/alerts.json', 'utf8');
  const newer = JSON.stringify({ ...reg, version: '2099-01-01' });
  const sha = (s: string) => createHash('sha256').update(s).digest('hex');
  const alertsVersion = JSON.parse(alerts).version;
  const manifest = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    packs: {
      register: { version: '2099-01-01', file: 'register.json', sha256: sha(newer), count: reg.products.length, bytes: newer.length },
      alerts: { version: alertsVersion, file: 'alerts.json', sha256: sha(alerts), count: 0, bytes: alerts.length },
    },
  };
  await request.post(`${MOCK}/__seed`, { data: { storage: { 'register.json': newer, 'alerts.json': alerts, 'manifest.json': JSON.stringify(manifest) } } });
  await onboard(page);
  await page.goto('/#/settings');
  await page.getByTestId('sync-now').click();
  await expect(page.getByTestId('register-version')).toHaveText('2099-01-01', { timeout: 30_000 });
});
```

Run: `npm run e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: community-flag learning loop, pack publishing and coverage-gap export"
```

---

### Task 23: Regulator dashboard + phase gate

**Files:**
- Create: `src/sync/api.ts`, `src/screens/Dashboard.tsx`
- Modify: `src/App.tsx` (route `/dashboard`)
- Test: `tests/unit/dashboard.test.ts`, `tests/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: `syncConfig`, `authHeaders`, `fetchWithRetry` (Task 21), the mock views (Task 20).
- Produces: `getView<T>(name: string, f?: typeof fetch): Promise<T[]>`; `barWidths(rows: { reports: number }[]): number[]` (percent of max, 0–100); route `/dashboard` (open without onboarding).

The dashboard is for NAFDAC staff, so its copy is English-only constants (not i18n).

- [ ] **Step 1: Write the failing unit test** `tests/unit/dashboard.test.ts`

```ts
import { barWidths } from '../../src/screens/Dashboard';

test('bar widths scale to the largest value', () => {
  expect(barWidths([{ reports: 96 }, { reports: 48 }, { reports: 0 }])).toEqual([100, 50, 0]);
  expect(barWidths([])).toEqual([]);
});
```

- [ ] **Step 2: Implement**

`src/sync/api.ts`:
```ts
import { syncConfig } from './config';
import { authHeaders, fetchWithRetry } from './http';

export async function getView<T>(name: string, f: typeof fetch = fetch.bind(globalThis)): Promise<T[]> {
  const cfg = syncConfig();
  if (!cfg.enabled) throw new Error('sync not configured');
  const res = await fetchWithRetry(f, `${cfg.url}/rest/v1/${name}?select=*`, { headers: authHeaders(cfg) }, { tries: 2, delays: [500], timeoutMs: 10_000 });
  if (!res.ok) throw new Error(`${name} HTTP ${res.status}`);
  return (await res.json()) as T[];
}
```

`src/screens/Dashboard.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getView } from '../sync/api';
import { syncConfig } from '../sync/config';
import { stateName } from '../core/states';

interface Activity { checks: number; red: number; devices: number; reports: number }
interface ByState { state: string; reports: number }
interface ByReason { reason: string; reports: number }
interface Unknown { nrn: string; reports: number; devices: number }
interface Flag { nrn: string; reports: number; devices: number; level: string; states: string[] }

const REASONS: Record<string, string> = {
  not_in_register: 'Not in register', name_mismatch: 'Box does not match number', strength_mismatch: 'Strength does not match',
  pack_expired: 'Pack expired', reg_lapsed: 'Registration not active', on_alert: 'On NAFDAC alert', batch_on_alert: 'Batch on NAFDAC alert',
  alert_product: 'Product has NAFDAC warnings', community_flag: 'Community flag', looks_different: 'Looks different', other: 'Other',
};

export function barWidths(rows: { reports: number }[]): number[] {
  const max = Math.max(0, ...rows.map((r) => r.reports));
  return rows.map((r) => (max ? Math.round((r.reports / max) * 100) : 0));
}

export function Dashboard() {
  const cfg = syncConfig();
  const [data, setData] = useState<{ a: Activity | null; s: ByState[]; r: ByReason[]; u: Unknown[]; f: Flag[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [a, s, r, u, f] = await Promise.all([
          getView<Activity>('dash_activity'), getView<ByState>('dash_by_state'), getView<ByReason>('dash_by_reason'),
          getView<Unknown>('dash_unknown_nrns'), getView<Flag>('community_flags'),
        ]);
        if (alive) {
          setData({ a: a[0] ?? null, s, r, u, f });
          setError(null);
        }
      } catch (e) {
        if (alive) setError(navigator.onLine ? (e as Error).message : 'Needs internet');
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const widths = barWidths(data?.s ?? []);
  return (
    <div className="app wide">
      <header className="topbar">
        <Link to="/" className="brand">DawaCheck · NAFDAC view</Link>
        <span className="pill">Last 7 days{cfg.mode === 'mock' ? ' · Example data' : ''}</span>
      </header>
      <main className="main">
        {error && <p className="error" role="alert">{error}</p>}
        <div className="dash-grid" data-testid="dashboard">
          <section className="card">
            <span className="label">Activity</span>
            <div className="kpis">
              <div><b>{data?.a?.checks ?? 0}</b><span className="small muted">checks</span></div>
              <div><b>{data?.a?.reports ?? 0}</b><span className="small muted">reports</span></div>
              <div><b>{data?.a && data.a.checks ? `${((data.a.red / data.a.checks) * 100).toFixed(1)}%` : '0%'}</b><span className="small muted">red verdicts</span></div>
              <div><b>{data?.a?.devices ?? 0}</b><span className="small muted">phones</span></div>
            </div>
          </section>
          <section className="card">
            <span className="label">Reports by state</span>
            {(data?.s ?? []).map((row, i) => (
              <div key={row.state} className="bar"><span>{stateName(row.state) ?? row.state}</span><i style={{ width: `${widths[i]}%` }} /><span>{row.reports}</span></div>
            ))}
            {!data?.s.length && <span className="muted small">Nothing yet</span>}
          </section>
          <section className="card">
            <span className="label">Reasons</span>
            {(data?.r ?? []).map((row) => (
              <div key={row.reason} className="row" style={{ justifyContent: 'space-between' }}><span>{REASONS[row.reason] ?? row.reason}</span><b>{row.reports}</b></div>
            ))}
          </section>
          <section className="card">
            <span className="label">Numbers not in the register (2+ reports)</span>
            {(data?.u ?? []).map((row) => (
              <div key={row.nrn} className="row" style={{ justifyContent: 'space-between' }}><span className="code">{row.nrn}</span><span>{row.reports} reports · {row.devices} phones</span></div>
            ))}
          </section>
          <section className="card">
            <span className="label">Community flags</span>
            {(data?.f ?? []).map((row) => (
              <div key={row.nrn} className="row" style={{ justifyContent: 'space-between' }}><span className="code">{row.nrn}</span><span>{row.level} · {row.reports} reports · {row.states.join(', ')}</span></div>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
```

Modify `src/App.tsx`: import `Dashboard` and add `<Route path="/dashboard" element={<Dashboard />} />` before `*`. The Gate already lets `/dashboard` through (Task 16).

- [ ] **Step 3: E2E** `tests/e2e/dashboard.spec.ts`

```ts
import { expect, test } from '@playwright/test';
import { MOCK } from './helpers';

test('dashboard shows reports by state from the backend', async ({ page, request }) => {
  await request.post(`${MOCK}/__reset`);
  const now = new Date().toISOString();
  await request.post(`${MOCK}/__seed`, {
    data: { reports: [1, 2, 3].map((i) => ({ id: `d${i}`, device_id: `p${i}`, created_at: now, nrn: 'A4-99231', reason: 'not_in_register', verdict: 'red', state: 'KN' })) },
  });
  await page.goto('/#/dashboard');
  await expect(page.getByTestId('dashboard')).toContainText('Kano');
  await expect(page.getByTestId('dashboard')).toContainText('A4-99231');
  await expect(page.getByText(/Example data/)).toBeVisible();
});
```

- [ ] **Step 4: Phase gate**

Run: `npm run verify && npm run test:ocr`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: NAFDAC dashboard over aggregate views"
```
