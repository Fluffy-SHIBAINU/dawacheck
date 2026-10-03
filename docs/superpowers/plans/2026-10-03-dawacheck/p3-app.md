# Phase 3: Storage and screens

Read the plan index Global Constraints first. Spec reference: §9 (screens), §10 (storage), §11.1 (events), §2 (languages). Visual reference: the design artifact (screens 1–7).

---

### Task 11: Dexie database, settings and pack loading

**Files:**
- Modify: `src/core/types.ts` (append `Lang` and `LANG_CODES`)
- Create: `src/lib/version.ts`, `src/data/db.ts`, `src/data/meta.ts`, `src/data/packs.ts`
- Test: `tests/unit/data/meta.test.ts`, `tests/unit/data/packs.test.ts`

**Interfaces:**
- Consumes: `RegisterPack`, `AlertsPack`, `CommunityFlag`, `Correction`, `Manifest`, `Level`, `Reason`, `ReportReason`, `ScanInput`, `Verdict` (Task 2); `compareVersions`, `validateManifest` (Task 5).
- Produces:
  - `type Lang = 'en' | 'ha' | 'pcm' | 'yo' | 'ig'`, `LANG_CODES: readonly Lang[]`.
  - `APP_VERSION: string`.
  - `class DawaDB extends Dexie` with tables `packs`, `checks`, `reports`, `events`, `meta`; `db: DawaDB`; row types `PackName`, `PackRow`, `CheckRow`, `ReportRow`, `EventRow`, `MetaRow`.
  - `interface Settings { lang: Lang; state: string | null; consent: boolean; onboarded: boolean }`, `DEFAULT_SETTINGS`, `getMeta<T>(key, d?)`, `setMeta(key, value, d?)`, `getSettings(d?)`, `saveSettings(patch, d?): Promise<Settings>`, `uuid(): string`, `getDeviceId(d?): Promise<string>`.
  - `interface LoadedPacks { register: RegisterPack; alerts: AlertsPack; flags: CommunityFlag[]; corrections: Correction[]; manifest: Manifest | null }`, `loadPacks(opts?: { fetchImpl?: typeof fetch; d?: DawaDB; base?: string }): Promise<LoadedPacks>`, `savePack(name: PackName, version: string, json: string, d?): Promise<void>`.

- [x] **Step 1: Append to `src/core/types.ts`**

```ts
export type Lang = 'en' | 'ha' | 'pcm' | 'yo' | 'ig';
export const LANG_CODES: readonly Lang[] = ['en', 'ha', 'pcm', 'yo', 'ig'];
```

`src/lib/version.ts`:
```ts
export const APP_VERSION = '0.1.0';
```

- [x] **Step 2: Write the failing tests**

`tests/unit/data/meta.test.ts`:
```ts
import { DawaDB } from '../../../src/data/db';
import { DEFAULT_SETTINGS, getDeviceId, getSettings, saveSettings, uuid } from '../../../src/data/meta';

const fresh = () => new DawaDB(`t-${Math.random()}`);

test('settings default, then merge saved patches', async () => {
  const d = fresh();
  expect(await getSettings(d)).toEqual(DEFAULT_SETTINGS);
  await saveSettings({ lang: 'ha' }, d);
  await saveSettings({ consent: true }, d);
  expect(await getSettings(d)).toEqual({ ...DEFAULT_SETTINGS, lang: 'ha', consent: true });
});

test('device id is created once and then stable', async () => {
  const d = fresh();
  const a = await getDeviceId(d);
  expect(a).toMatch(/^[0-9a-f-]{36}$/);
  expect(await getDeviceId(d)).toBe(a);
});

test('uuid looks like a v4 uuid', () => {
  expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
```

`tests/unit/data/packs.test.ts`:
```ts
import { DawaDB } from '../../../src/data/db';
import { loadPacks, savePack } from '../../../src/data/packs';
import { REGISTER, ALERTS } from '../../helpers/fixtures';

const fresh = () => new DawaDB(`t-${Math.random()}`);
const entry = (v: string, file: string) => ({ version: v, file, sha256: 'a'.repeat(64), count: 1, bytes: 1 });

function fakeFetch(files: Record<string, unknown>) {
  const calls: string[] = [];
  const f = (async (url: string) => {
    calls.push(url);
    const key = url.replace(/^\//, '');
    if (!(key in files)) return new Response('missing', { status: 404 });
    return new Response(JSON.stringify(files[key]), { status: 200 });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const bundled = (regVersion = '2026-10-03') => ({
  'packs/manifest.json': { schema: 1, generatedAt: 'x', packs: { register: entry(regVersion, 'register.json'), alerts: entry('2026-10-03', 'alerts.json') } },
  'packs/register.json': { ...REGISTER, version: regVersion },
  'packs/alerts.json': { version: '2026-10-03', fetchedAt: 'x', alerts: ALERTS },
});

test('empty database loads bundled packs and stores them', async () => {
  const d = fresh();
  const { f } = fakeFetch(bundled());
  const p = await loadPacks({ fetchImpl: f, d, base: '/' });
  expect(p.register.products).toHaveLength(7);
  expect(p.alerts.alerts).toHaveLength(4);
  expect(p.flags).toEqual([]);
  expect((await d.packs.get('register'))?.version).toBe('2026-10-03');
});

test('a newer pack already in the database wins over the bundled one', async () => {
  const d = fresh();
  await savePack('register', '2026-10-05', JSON.stringify({ ...REGISTER, version: '2026-10-05', products: REGISTER.products.slice(0, 2) }), d);
  const { f, calls } = fakeFetch(bundled());
  const p = await loadPacks({ fetchImpl: f, d, base: '/' });
  expect(p.register.version).toBe('2026-10-05');
  expect(p.register.products).toHaveLength(2);
  expect(calls).not.toContain('/packs/register.json');
});

test('an older pack in the database is replaced by a newer bundled one', async () => {
  const d = fresh();
  await savePack('register', '2026-09-01', JSON.stringify({ ...REGISTER, version: '2026-09-01', products: [] }), d);
  const { f } = fakeFetch(bundled('2026-10-03'));
  const p = await loadPacks({ fetchImpl: f, d, base: '/' });
  expect(p.register.version).toBe('2026-10-03');
});

test('learned flags and corrections come from the database', async () => {
  const d = fresh();
  await savePack('flags', '1', JSON.stringify([{ nrn: 'A4-6238', reports: 3, devices: 2, states: [], level: 'watch', last_report_at: 'x' }]), d);
  await savePack('corrections', '1', JSON.stringify([{ read: 'A4-6239', corrected: 'A4-6238', n: 2 }]), d);
  const { f } = fakeFetch(bundled());
  const p = await loadPacks({ fetchImpl: f, d, base: '/' });
  expect(p.flags[0].nrn).toBe('A4-6238');
  expect(p.corrections[0].n).toBe(2);
});

test('offline with no manifest still uses stored packs', async () => {
  const d = fresh();
  await savePack('register', '2026-10-03', JSON.stringify(REGISTER), d);
  await savePack('alerts', '2026-10-03', JSON.stringify({ version: '2026-10-03', fetchedAt: 'x', alerts: ALERTS }), d);
  const f = (async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;
  const p = await loadPacks({ fetchImpl: f, d, base: '/' });
  expect(p.register.products).toHaveLength(7);
  expect(p.manifest).toBeNull();
});
```

- [x] **Step 3: Run to verify failure**

Run: `npx vitest run tests/unit/data`
Expected: FAIL, modules not found.

- [x] **Step 4: Implement**

`src/data/db.ts`:
```ts
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
```

`src/data/meta.ts`:
```ts
import { db as defaultDb, type DawaDB } from './db';
import type { Lang } from '../core/types';

export interface Settings {
  lang: Lang;
  state: string | null;
  consent: boolean;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = { lang: 'en', state: null, consent: false, onboarded: false };

export async function getMeta<T>(key: string, d: DawaDB = defaultDb): Promise<T | undefined> {
  return (await d.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown, d: DawaDB = defaultDb): Promise<void> {
  await d.meta.put({ key, value });
}

export async function getSettings(d: DawaDB = defaultDb): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await getMeta<Partial<Settings>>('settings', d)) ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>, d: DawaDB = defaultDb): Promise<Settings> {
  const next = { ...(await getSettings(d)), ...patch };
  await setMeta('settings', next, d);
  return next;
}

export function uuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function getDeviceId(d: DawaDB = defaultDb): Promise<string> {
  const existing = await getMeta<string>('deviceId', d);
  if (existing) return existing;
  const id = uuid();
  await setMeta('deviceId', id, d);
  return id;
}
```

`src/data/packs.ts`:
```ts
import { db as defaultDb, type DawaDB, type PackName } from './db';
import { compareVersions, validateManifest } from '../core/manifest';
import type { AlertsPack, CommunityFlag, Correction, Manifest, RegisterPack } from '../core/types';

export interface LoadedPacks {
  register: RegisterPack;
  alerts: AlertsPack;
  flags: CommunityFlag[];
  corrections: Correction[];
  manifest: Manifest | null;
}

export interface LoadOptions {
  fetchImpl?: typeof fetch;
  d?: DawaDB;
  base?: string;
}

export async function savePack(name: PackName, version: string, json: string, d: DawaDB = defaultDb): Promise<void> {
  await d.packs.put({ name, version, json, updatedAt: new Date().toISOString() });
}

async function loadBundled<T extends { version: string }>(
  name: 'register' | 'alerts',
  bundledVersion: string | undefined,
  f: typeof fetch,
  base: string,
  d: DawaDB,
): Promise<T> {
  const row = await d.packs.get(name);
  if (row && (!bundledVersion || compareVersions(row.version, bundledVersion) >= 0)) return JSON.parse(row.json) as T;
  let res: Response;
  try {
    res = await f(`${base}packs/${name}.json`);
  } catch (e) {
    if (row) return JSON.parse(row.json) as T;
    throw e;
  }
  if (!res.ok) {
    if (row) return JSON.parse(row.json) as T;
    throw new Error(`could not load ${name} pack (HTTP ${res.status})`);
  }
  const text = await res.text();
  const pack = JSON.parse(text) as T;
  await savePack(name, pack.version, text, d);
  return pack;
}

export async function loadPacks(opts: LoadOptions = {}): Promise<LoadedPacks> {
  const f = opts.fetchImpl ?? fetch.bind(globalThis);
  const d = opts.d ?? defaultDb;
  const base = opts.base ?? import.meta.env.BASE_URL ?? '/';
  let manifest: Manifest | null = null;
  try {
    const r = await f(`${base}packs/manifest.json`);
    if (r.ok) manifest = validateManifest(await r.json());
  } catch {
    manifest = null;
  }
  const register = await loadBundled<RegisterPack>('register', manifest?.packs.register.version, f, base, d);
  const alerts = await loadBundled<AlertsPack>('alerts', manifest?.packs.alerts.version, f, base, d);
  const flags = JSON.parse((await d.packs.get('flags'))?.json ?? '[]') as CommunityFlag[];
  const corrections = JSON.parse((await d.packs.get('corrections'))?.json ?? '[]') as Correction[];
  return { register, alerts, flags, corrections, manifest };
}
```

- [x] **Step 5: Run tests**

Run: `npx vitest run tests/unit/data && npm run typecheck`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add IndexedDB storage, settings and offline pack loading"
```

---

### Task 12: Checks, reports, events, states and SMS helpers

**Files:**
- Create: `src/data/checks.ts`, `src/data/reports.ts`, `src/telemetry/events.ts`, `src/core/states.ts`, `src/core/sms.ts`
- Test: `tests/unit/data/stores.test.ts`, `tests/unit/core/sms.test.ts`

**Interfaces:**
- Consumes: Task 11 (`DawaDB`, rows, `uuid`), `APP_VERSION`, core types.
- Produces:
  - `saveCheck(input: ScanInput, verdict: Verdict, thumb: Blob | null, d?): Promise<CheckRow>`, `getCheck(id, d?)`, `listChecks(limit?, d?): Promise<CheckRow[]>` (newest first), `pruneChecks(max, d?)`.
  - `interface NewReport { checkId: string | null; nrn: string | null; productName: string | null; reason: ReportReason; verdict: Level; state: string | null; note: string | null; photoThumb: string | null; ocrExcerpt: string | null; lang: string; packVersion: string }`, `saveReport(r: NewReport, d?): Promise<ReportRow>`, `pendingReports(d?)`, `countPendingReports(d?)`, `markReportsSynced(ids: string[], at: string, d?)`, `bumpReportAttempts(ids: string[], d?)`.
  - `type EventType` (union below), `type EventProp = string | number | boolean | null | string[]`, `setEventContext(c: { lang?: string; packVersion?: string })`, `logEvent(type: EventType, props?: Record<string, EventProp>, d?): Promise<EventRow>`, `sanitizeProps(props)`, `pendingEvents(limit?, d?)`, `countPendingEvents(d?)`, `markEventsSynced(ids, at, d?)`, `pruneEvents(max, d?)`.
  - `NG_STATES: { code: string; name: string }[]` (37 entries), `stateName(code: string | null): string | null`.
  - `smsBody(r: { nrn: string | null; reason: ReportReason; state: string | null }): string`, `smsHref(body: string, to?: string): string`, `reportReasonFor(v: Verdict): ReportReason`, `NAFDAC_HOTLINE = '0800-162-3322'`.

- [x] **Step 1: Write the failing tests**

`tests/unit/data/stores.test.ts`:
```ts
import { DawaDB } from '../../../src/data/db';
import { getCheck, listChecks, pruneChecks, saveCheck } from '../../../src/data/checks';
import { countPendingReports, markReportsSynced, pendingReports, saveReport } from '../../../src/data/reports';
import { countPendingEvents, logEvent, markEventsSynced, pendingEvents, pruneEvents, sanitizeProps, setEventContext } from '../../../src/telemetry/events';
import { decide } from '../../../src/core/verdict';
import { manualInput } from '../../../src/core/parse';
import { buildRegisterIndex } from '../../../src/core/registerIndex';
import { buildConfusion } from '../../../src/core/confusion';
import { DEFAULT_THRESHOLDS } from '../../../src/core/types';
import { ALERTS, REGISTER, TODAY } from '../../helpers/fixtures';

const fresh = () => new DawaDB(`t-${Math.random()}`);
const ctx = { register: buildRegisterIndex(REGISTER), alerts: ALERTS, flags: new Map(), confusion: buildConfusion([]), today: TODAY, thresholds: DEFAULT_THRESHOLDS };

test('checks are saved, read back newest first and pruned', async () => {
  const d = fresh();
  const input = manualInput('A4-6238')!;
  const a = await saveCheck(input, decide(input, ctx), null, d);
  const b = await saveCheck(input, decide(input, ctx), null, d);
  expect((await getCheck(a.id, d))?.productName).toBe('Artheget EZ');
  expect((await listChecks(10, d)).map((c) => c.id)).toEqual([b.id, a.id]);
  await pruneChecks(1, d);
  expect(await d.checks.count()).toBe(1);
});

test('reports queue until marked synced', async () => {
  const d = fresh();
  const r = await saveReport(
    { checkId: null, nrn: 'A4-99231', productName: null, reason: 'not_in_register', verdict: 'red', state: 'KN', note: 'x'.repeat(300), photoThumb: null, ocrExcerpt: null, lang: 'en', packVersion: '2026-10-03' },
    d,
  );
  expect(r.note).toHaveLength(200);
  expect(await countPendingReports(d)).toBe(1);
  await markReportsSynced([r.id], '2026-10-03T12:00:00Z', d);
  expect(await pendingReports(d)).toEqual([]);
});

test('events carry context, are sanitized, queue and prune', async () => {
  const d = fresh();
  setEventContext({ lang: 'ha', packVersion: '2026-10-03' });
  const e = await logEvent('verdict_shown', { level: 'green', reasons: ['registered'] }, d);
  expect(e).toMatchObject({ type: 'verdict_shown', lang: 'ha', packVersion: '2026-10-03', syncedAt: null });
  expect(await countPendingEvents(d)).toBe(1);
  await markEventsSynced([e.id], 'now', d);
  expect(await pendingEvents(500, d)).toEqual([]);
  for (let i = 0; i < 5; i++) await logEvent('app_open', {}, d);
  await pruneEvents(3, d);
  expect(await d.events.count()).toBe(3);
});

test('sanitizeProps truncates strings and arrays', () => {
  const p = sanitizeProps({ s: 'y'.repeat(100), a: Array.from({ length: 30 }, () => 'z'.repeat(50)), n: 3, b: true, z: null });
  expect((p.s as string).length).toBe(64);
  expect((p.a as string[]).length).toBe(20);
  expect((p.a as string[])[0].length).toBe(32);
  expect(p.n).toBe(3);
});
```

`tests/unit/core/sms.test.ts`:
```ts
import { NAFDAC_HOTLINE, reportReasonFor, smsBody, smsHref } from '../../../src/core/sms';
import { NG_STATES, stateName } from '../../../src/core/states';
import type { Verdict } from '../../../src/core/types';

test('sms body is short and coded', () => {
  expect(smsBody({ nrn: 'A4-6238', reason: 'name_mismatch', state: 'KN' })).toBe('DC R A4-6238 MISMATCH KN');
  expect(smsBody({ nrn: null, reason: 'other', state: null })).toBe('DC R NONRN OTHER NA');
  expect(smsHref('DC R A4-6238 MISMATCH KN')).toBe('sms:?&body=DC%20R%20A4-6238%20MISMATCH%20KN');
  expect(NAFDAC_HOTLINE).toBe('0800-162-3322');
});

test('report reason follows the most severe verdict reason', () => {
  const v = (reasons: Verdict['reasons']) => ({ reasons }) as Verdict;
  expect(reportReasonFor(v(['registered', 'name_mismatch', 'strength_mismatch']))).toBe('name_mismatch');
  expect(reportReasonFor(v(['not_in_register', 'on_alert']))).toBe('on_alert');
  expect(reportReasonFor(v(['registered']))).toBe('looks_different');
});

test('37 Nigerian states including FCT', () => {
  expect(NG_STATES).toHaveLength(37);
  expect(stateName('KN')).toBe('Kano');
  expect(stateName(null)).toBeNull();
});
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/data/stores.test.ts tests/unit/core/sms.test.ts`
Expected: FAIL, modules not found.

- [x] **Step 3: Implement**

`src/data/checks.ts`:
```ts
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
```

`src/data/reports.ts`:
```ts
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
```

`src/telemetry/events.ts`:
```ts
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
```

`src/core/states.ts`:
```ts
export const NG_STATES: { code: string; name: string }[] = [
  { code: 'AB', name: 'Abia' }, { code: 'AD', name: 'Adamawa' }, { code: 'AK', name: 'Akwa Ibom' }, { code: 'AN', name: 'Anambra' },
  { code: 'BA', name: 'Bauchi' }, { code: 'BY', name: 'Bayelsa' }, { code: 'BE', name: 'Benue' }, { code: 'BO', name: 'Borno' },
  { code: 'CR', name: 'Cross River' }, { code: 'DE', name: 'Delta' }, { code: 'EB', name: 'Ebonyi' }, { code: 'ED', name: 'Edo' },
  { code: 'EK', name: 'Ekiti' }, { code: 'EN', name: 'Enugu' }, { code: 'FC', name: 'Federal Capital Territory' }, { code: 'GO', name: 'Gombe' },
  { code: 'IM', name: 'Imo' }, { code: 'JI', name: 'Jigawa' }, { code: 'KD', name: 'Kaduna' }, { code: 'KN', name: 'Kano' },
  { code: 'KT', name: 'Katsina' }, { code: 'KE', name: 'Kebbi' }, { code: 'KO', name: 'Kogi' }, { code: 'KW', name: 'Kwara' },
  { code: 'LA', name: 'Lagos' }, { code: 'NA', name: 'Nasarawa' }, { code: 'NI', name: 'Niger' }, { code: 'OG', name: 'Ogun' },
  { code: 'ON', name: 'Ondo' }, { code: 'OS', name: 'Osun' }, { code: 'OY', name: 'Oyo' }, { code: 'PL', name: 'Plateau' },
  { code: 'RI', name: 'Rivers' }, { code: 'SO', name: 'Sokoto' }, { code: 'TA', name: 'Taraba' }, { code: 'YO', name: 'Yobe' },
  { code: 'ZA', name: 'Zamfara' },
];

export function stateName(code: string | null): string | null {
  return NG_STATES.find((s) => s.code === code)?.name ?? null;
}
```

`src/core/sms.ts`:
```ts
import type { ReportReason, Verdict } from './types';

export const NAFDAC_HOTLINE = '0800-162-3322';

const CODES: Record<ReportReason, string> = {
  not_in_register: 'NOTREG',
  name_mismatch: 'MISMATCH',
  strength_mismatch: 'STRENGTH',
  pack_expired: 'EXPIRED',
  reg_lapsed: 'LAPSED',
  on_alert: 'ALERT',
  batch_on_alert: 'BATCH',
  alert_product: 'ALERTPROD',
  community_flag: 'COMMUNITY',
  looks_different: 'LOOKS',
  other: 'OTHER',
};

export function smsBody(r: { nrn: string | null; reason: ReportReason; state: string | null }): string {
  return ['DC', 'R', r.nrn ?? 'NONRN', CODES[r.reason], r.state ?? 'NA'].join(' ');
}

export function smsHref(body: string, to = ''): string {
  return `sms:${to}?&body=${encodeURIComponent(body)}`;
}

const ORDER: ReportReason[] = [
  'batch_on_alert', 'on_alert', 'not_in_register', 'pack_expired', 'name_mismatch',
  'strength_mismatch', 'alert_product', 'reg_lapsed', 'community_flag',
];

export function reportReasonFor(v: Verdict): ReportReason {
  return ORDER.find((r) => (v.reasons as string[]).includes(r)) ?? 'looks_different';
}
```

- [x] **Step 4: Run tests**

Run: `npx vitest run tests/unit && npm run typecheck`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: store checks, reports and usage events offline; add SMS and state helpers"
```

---

### Task 13: i18n (5 languages) and voice clip texts

**Files:**
- Create: `src/i18n/en.ts`, `src/i18n/ha.ts`, `src/i18n/pcm.ts`, `src/i18n/yo.ts`, `src/i18n/ig.ts`, `src/i18n/index.ts`, `src/voice/clips.ts`
- Test: `tests/unit/i18n.test.ts`

**Interfaces:**
- Consumes: `Lang` (Task 11).
- Produces: `en` (const object), `type MessageKey = keyof typeof en`, `LANGS: { code: Lang; label: string; native: string; draft: boolean; voice: boolean }[]`, `CORE_KEYS: MessageKey[]`, `translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string`; `CLIP_KEYS`, `type ClipKey`, `type VoiceLang = 'en' | 'ha' | 'pcm'`, `CLIPS: Record<ClipKey, Record<VoiceLang, string>>`, `voiceLangFor(lang: Lang): VoiceLang`.

Hausa and Pidgin are complete. Yoruba and Igbo are partial drafts covering `CORE_KEYS`; everything else falls back to English. All non-English text is a draft for native-speaker review (README lists this).

- [x] **Step 1: Write the failing test** `tests/unit/i18n.test.ts`

```ts
import { CORE_KEYS, LANGS, translate, type MessageKey } from '../../src/i18n';
import { en } from '../../src/i18n/en';
import { ha } from '../../src/i18n/ha';
import { pcm } from '../../src/i18n/pcm';
import { yo } from '../../src/i18n/yo';
import { ig } from '../../src/i18n/ig';
import { CLIPS, CLIP_KEYS, voiceLangFor } from '../../src/voice/clips';

const keys = Object.keys(en) as MessageKey[];

test('Hausa and Pidgin cover every key with non-empty text', () => {
  for (const dict of [ha, pcm]) for (const k of keys) expect(dict[k]?.trim().length, k).toBeGreaterThan(0);
});

test('Yoruba and Igbo drafts cover the core keys', () => {
  for (const dict of [yo, ig]) for (const k of CORE_KEYS) expect(dict[k]?.trim().length, k).toBeGreaterThan(0);
});

test('placeholders are preserved in every translation', () => {
  for (const dict of [ha, pcm, yo, ig] as Partial<Record<MessageKey, string>>[]) {
    for (const k of keys) {
      const s = dict[k];
      if (!s) continue;
      const want = (en[k].match(/\{\w+\}/g) ?? []).sort();
      const got = (s.match(/\{\w+\}/g) ?? []).sort();
      expect(got, `${k}`).toEqual(want);
    }
  }
});

test('translate interpolates and falls back to English', () => {
  expect(translate('en', 'status_pending', { n: 3 })).toBe('Reports waiting: 3');
  expect(translate('yo', 'settings_title')).toBe(en.settings_title);
  expect(translate('ha', 'v_green_title')).toBe('An yi rajista da NAFDAC');
});

test('copy rules: no "safe", "genuine" or "authentic" in English UI text', () => {
  for (const s of Object.values(en)) expect(s).not.toMatch(/\b(safe|genuine|authentic)\b/i);
  expect(en.v_green_title).toBe('Registered with NAFDAC');
  expect(en.about_body).toBe(
    'DawaCheck checks NAFDAC records and what is printed on the box. It cannot test what is inside. If in doubt, do not take it and ask a health worker.',
  );
});

test('languages list marks Yoruba and Igbo as drafts', () => {
  expect(LANGS.map((l) => l.code)).toEqual(['ha', 'en', 'pcm', 'yo', 'ig']);
  expect(LANGS.filter((l) => l.draft).map((l) => l.code)).toEqual(['yo', 'ig']);
});

test('voice clips exist in en, ha and pcm for every key', () => {
  for (const k of CLIP_KEYS) for (const l of ['en', 'ha', 'pcm'] as const) expect(CLIPS[k][l].length, `${k}/${l}`).toBeGreaterThan(10);
  expect(voiceLangFor('yo')).toBe('en');
  expect(voiceLangFor('ha')).toBe('ha');
});
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/i18n.test.ts`
Expected: FAIL, modules not found.

- [x] **Step 3: Implement dictionaries**

`src/i18n/en.ts`:
```ts
export const en = {
  app_name: 'DawaCheck',
  tagline: 'Check a medicine with no internet',
  status_offline: 'No internet',
  status_online: 'Online',
  status_register: 'Register {date} · {count} products',
  status_pending: 'Reports waiting: {n}',
  home_check: 'Check medicine',
  home_check_sub: 'Take a photo of the box',
  home_type: 'Type NAFDAC number',
  home_listen: 'Listen: how to use',
  home_recent: 'Recent checks',
  home_no_recent: 'No checks yet',
  nav_home: 'Home',
  nav_history: 'History',
  nav_settings: 'Settings',
  welcome_title: 'Choose your language',
  consent_title: 'Help improve DawaCheck',
  consent_body: 'Share anonymous usage: which screens you use and whether reading the label worked. No name, phone number or location.',
  consent_yes: 'Share anonymous usage',
  state_label: 'Your state (optional)',
  state_none: 'Prefer not to say',
  continue: 'Continue',
  back: 'Back',
  type_title: 'Type the NAFDAC number',
  type_hint: 'It looks like A4-1234 and is printed on the box.',
  type_check: 'Check',
  type_invalid: 'That does not look like a NAFDAC number. Example: A4-1234',
  scan_reading: 'Reading the label on this phone…',
  scan_found: 'Found',
  scan_none: 'No NAFDAC number found',
  scan_crop: 'Number unclear? Draw a box around it',
  scan_crop_help: 'Drag across the NAFDAC number, then tap Read this area.',
  scan_crop_done: 'Read this area',
  scan_type: 'Type the number instead',
  scan_private: 'The photo stays on this phone.',
  scan_failed: 'Could not read the photo. Try again in good light or type the number.',
  v_green_title: 'Registered with NAFDAC',
  v_amber_title: 'Check carefully',
  v_red_title: 'Do not take this medicine',
  v_unknown_title: 'Could not check this box',
  r_registered: 'This number is in the NAFDAC register.',
  r_name_unconfirmed: 'Check that the name on the box is {name}.',
  r_corrected_number: 'We read {read} and matched it to {nrn}.',
  r_reg_lapsed: 'Its NAFDAC registration is not active. Ask a pharmacist before using it.',
  r_name_mismatch: 'The name on the box does not match this NAFDAC number. Fakes often copy a real number.',
  r_strength_mismatch: 'The strength on the box does not match the registered strength.',
  r_alert_product: 'NAFDAC has warned about fake or bad versions of this product. Compare the batch number.',
  r_community_flag: 'Other users reported this number recently ({n} reports).',
  r_not_in_register: 'This number is not in the NAFDAC register.',
  r_on_alert: 'NAFDAC has issued an alert about this product.',
  r_batch_on_alert: 'This batch number is named in a NAFDAC alert.',
  r_pack_expired: 'This medicine is past its expiry date ({date}).',
  r_no_number_found: 'We could not find a NAFDAC number. Try again in good light, or type it.',
  r_ambiguous_number: 'The number is unclear. Pick the right one below or type it.',
  next_green: 'Check that it looks like the description below.',
  next_amber: 'Ask a pharmacist or health worker before taking it.',
  next_red: 'Show it to a health worker and report it.',
  next_unknown: 'Try again in good light, or type the number.',
  looks_like: 'Check it looks like this',
  pack_label: 'Pack: {pack}',
  reg_valid_to: 'Registration valid to {date}',
  box_says: 'On the box',
  nrn_is: '{nrn} is registered as',
  alert_label: 'NAFDAC alert {id}',
  alert_batches: 'Batches named: {batches}',
  ingredient_note: 'NAFDAC has alerts about some {ingredient} products. Compare your batch number with NAFDAC alerts.',
  did_you_mean: 'Did you mean',
  listen: 'Listen',
  report: 'Report this box',
  done: 'Done',
  report_title: 'Report this box',
  report_reason: 'What is wrong?',
  reason_not_in_register: 'Number not in the register',
  reason_name_mismatch: 'Name does not match the number',
  reason_strength_mismatch: 'Strength does not match',
  reason_pack_expired: 'Expired',
  reason_reg_lapsed: 'Registration not active',
  reason_on_alert: 'On a NAFDAC alert',
  reason_batch_on_alert: 'Batch on a NAFDAC alert',
  reason_alert_product: 'Product has NAFDAC warnings',
  reason_community_flag: 'Others reported it',
  reason_looks_different: 'Looks different from the description',
  reason_other: 'Something else',
  report_state: 'State',
  report_photo: 'Attach a small photo',
  report_note: 'Note (optional)',
  report_save: 'Save report',
  report_saved: 'Report saved on this phone',
  report_waiting: 'Reports waiting: {n}. They send automatically when you have internet.',
  report_sms: 'Send by SMS now',
  report_sms_note: 'Uses SMS credit. Works on a weak signal.',
  report_hotline: 'NAFDAC hotline',
  report_privacy: 'No name or phone number is collected.',
  history_title: 'History',
  history_empty: 'No checks yet',
  settings_title: 'Settings',
  settings_language: 'Language',
  settings_share: 'Share anonymous usage',
  settings_data: 'Data on this phone',
  settings_register: 'Register: {count} products · {version}',
  settings_alerts: 'NAFDAC alerts: {count} · {version}',
  settings_flags: 'Community flags: {count}',
  settings_pending: 'Waiting to send: {reports} reports, {events} usage events',
  settings_sync: 'Sync now',
  settings_last_sync: 'Last sync: {when}',
  settings_never: 'never',
  settings_sync_off: 'Sync is not set up on this build.',
  settings_draft: 'This language is a draft translation.',
  about_title: 'About',
  about_body: 'DawaCheck checks NAFDAC records and what is printed on the box. It cannot test what is inside. If in doubt, do not take it and ask a health worker.',
  sync_sent: 'Sent {reports} reports and {events} usage events',
  sync_register: 'Register updated: {from} → {to} products',
  sync_alerts: 'NAFDAC alerts updated: {n}',
  sync_flags: 'Community flags: {n}',
  sync_failed: 'Sync failed. It will try again.',
  sync_running: 'Syncing…',
  load_failed: 'The medicine data is not on this phone yet. Connect to the internet once to download it.',
  draft_badge: 'Draft translation',
} as const;
```

`src/i18n/ha.ts`:
```ts
import type { MessageKey } from './index';

export const ha: Record<MessageKey, string> = {
  app_name: 'DawaCheck',
  tagline: 'Duba magani ba tare da intanet ba',
  status_offline: 'Babu intanet',
  status_online: 'Akwai intanet',
  status_register: 'Rajista {date} · magunguna {count}',
  status_pending: 'Rahotannin da ke jira: {n}',
  home_check: 'Duba magani',
  home_check_sub: 'Ɗauki hoton kwalin',
  home_type: 'Rubuta lambar NAFDAC',
  home_listen: 'Saurara: yadda ake amfani',
  home_recent: 'Na baya-bayan nan',
  home_no_recent: 'Ba a duba komai ba tukuna',
  nav_home: 'Gida',
  nav_history: 'Tarihi',
  nav_settings: 'Saituna',
  welcome_title: 'Zaɓi harshenka',
  consent_title: 'Taimaka mana inganta DawaCheck',
  consent_body: 'Raba bayanan amfani ba tare da suna ba: shafukan da kake amfani da su, da ko karanta lakabin ya yi aiki. Babu suna, lambar waya ko wuri.',
  consent_yes: 'Raba bayanan amfani ba tare da suna ba',
  state_label: 'Jiharka (ba dole ba)',
  state_none: 'Ban so in faɗa ba',
  continue: 'Ci gaba',
  back: 'Koma baya',
  type_title: 'Rubuta lambar NAFDAC',
  type_hint: 'Tana kama da A4-1234 kuma an buga ta a kan kwalin.',
  type_check: 'Duba',
  type_invalid: 'Wannan ba ya kama da lambar NAFDAC. Misali: A4-1234',
  scan_reading: 'Ana karanta lakabin a wannan wayar…',
  scan_found: 'An samu',
  scan_none: 'Ba a samu lambar NAFDAC ba',
  scan_crop: 'Lambar ba ta fito sosai ba? Zana akwati a kanta',
  scan_crop_help: 'Ja yatsa a kan lambar NAFDAC, sannan ka danna Karanta wannan wurin.',
  scan_crop_done: 'Karanta wannan wurin',
  scan_type: 'Rubuta lambar maimakon haka',
  scan_private: 'Hoton yana nan a wannan wayar kawai.',
  scan_failed: 'Ba a iya karanta hoton ba. Sake gwadawa a wuri mai haske ko ka rubuta lambar.',
  v_green_title: 'An yi rajista da NAFDAC',
  v_amber_title: 'A duba a hankali',
  v_red_title: 'Kada a sha wannan magani',
  v_unknown_title: 'Ba a iya duba wannan kwalin ba',
  r_registered: 'Wannan lambar tana cikin rajistar NAFDAC.',
  r_name_unconfirmed: 'Ka tabbata sunan da ke kan kwalin shi ne {name}.',
  r_corrected_number: 'Mun karanta {read} kuma mun daidaita shi da {nrn}.',
  r_reg_lapsed: 'Rajistar NAFDAC ta wannan magani ba ta aiki. Tambayi masanin magunguna kafin amfani.',
  r_name_mismatch: 'Sunan da ke kan kwalin bai yi daidai da wannan lambar NAFDAC ba. Jabun magani yakan kwafi lambar gaskiya.',
  r_strength_mismatch: 'Ƙarfin maganin da ke kan kwalin bai yi daidai da wanda aka yi wa rajista ba.',
  r_alert_product: 'NAFDAC ta yi gargaɗi game da jabun wannan magani. Kwatanta lambar batch.',
  r_community_flag: 'Wasu masu amfani sun kai rahoton wannan lambar kwanan nan (rahotanni {n}).',
  r_not_in_register: 'Wannan lambar ba ta cikin rajistar NAFDAC.',
  r_on_alert: 'NAFDAC ta fitar da gargaɗi game da wannan magani.',
  r_batch_on_alert: 'An ambaci wannan lambar batch a cikin gargaɗin NAFDAC.',
  r_pack_expired: 'Wannan magani ya wuce ranar ƙarewarsa ({date}).',
  r_no_number_found: 'Ba mu samu lambar NAFDAC ba. Sake gwadawa a wuri mai haske, ko ka rubuta ta.',
  r_ambiguous_number: 'Lambar ba ta fito sosai ba. Zaɓi daidai a ƙasa ko ka rubuta ta.',
  next_green: 'Ka tabbata yana kama da bayanin da ke ƙasa.',
  next_amber: 'Tambayi masanin magunguna ko maʼaikacin lafiya kafin ka sha.',
  next_red: 'Nuna shi ga maʼaikacin lafiya kuma ka kai rahoto.',
  next_unknown: 'Sake gwadawa a wuri mai haske, ko ka rubuta lambar.',
  looks_like: 'Ka duba ko yana kama da haka',
  pack_label: 'Kwali: {pack}',
  reg_valid_to: 'Rajista tana aiki har zuwa {date}',
  box_says: 'A kan kwalin',
  nrn_is: 'An yi wa {nrn} rajista a matsayin',
  alert_label: 'Gargaɗin NAFDAC {id}',
  alert_batches: 'Lambobin batch da aka ambata: {batches}',
  ingredient_note: 'NAFDAC tana da gargaɗi game da wasu magungunan {ingredient}. Kwatanta lambar batch ɗinka da gargaɗin NAFDAC.',
  did_you_mean: 'Kana nufin',
  listen: 'Saurara',
  report: 'Kai rahoton wannan kwalin',
  done: 'Shi ke nan',
  report_title: 'Kai rahoton wannan kwalin',
  report_reason: 'Me ke damun sa?',
  reason_not_in_register: 'Lambar ba ta cikin rajista',
  reason_name_mismatch: 'Suna bai dace da lambar ba',
  reason_strength_mismatch: 'Ƙarfi bai dace ba',
  reason_pack_expired: 'Ya wuce ranar ƙarewa',
  reason_reg_lapsed: 'Rajista ba ta aiki',
  reason_on_alert: 'Yana cikin gargaɗin NAFDAC',
  reason_batch_on_alert: 'Batch yana cikin gargaɗin NAFDAC',
  reason_alert_product: 'NAFDAC ta yi gargaɗi game da maganin',
  reason_community_flag: 'Wasu sun kai rahotonsa',
  reason_looks_different: 'Ya bambanta da bayanin',
  reason_other: 'Wani abu daban',
  report_state: 'Jiha',
  report_photo: 'Haɗa ƙaramin hoto',
  report_note: 'Bayani (ba dole ba)',
  report_save: 'Ajiye rahoto',
  report_saved: 'An ajiye rahoto a wannan wayar',
  report_waiting: 'Rahotannin da ke jira: {n}. Za a aika su da kansu idan akwai intanet.',
  report_sms: 'Aika ta SMS yanzu',
  report_sms_note: 'Yana amfani da kuɗin SMS. Yana aiki ko da sigina ba ta da ƙarfi.',
  report_hotline: 'Layin waya na NAFDAC',
  report_privacy: 'Ba a karɓar suna ko lambar waya.',
  history_title: 'Tarihi',
  history_empty: 'Ba a duba komai ba tukuna',
  settings_title: 'Saituna',
  settings_language: 'Harshe',
  settings_share: 'Raba bayanan amfani ba tare da suna ba',
  settings_data: 'Bayanai a wannan wayar',
  settings_register: 'Rajista: magunguna {count} · {version}',
  settings_alerts: 'Gargaɗin NAFDAC: {count} · {version}',
  settings_flags: 'Gargaɗin alʼumma: {count}',
  settings_pending: 'Suna jiran aikawa: rahotanni {reports}, bayanan amfani {events}',
  settings_sync: 'Daidaita yanzu',
  settings_last_sync: 'Daidaitawa ta ƙarshe: {when}',
  settings_never: 'ba a taɓa ba',
  settings_sync_off: 'Ba a saita daidaitawa a wannan sigar ba.',
  settings_draft: 'Wannan harshe fassarar gwaji ce.',
  about_title: 'Game da DawaCheck',
  about_body: 'DawaCheck tana duba bayanan NAFDAC da abin da aka buga a kan kwalin. Ba za ta iya gwada abin da ke ciki ba. Idan kana da shakka, kada ka sha, ka tambayi maʼaikacin lafiya.',
  sync_sent: 'An aika rahotanni {reports} da bayanan amfani {events}',
  sync_register: 'An sabunta rajista: magunguna {from} → {to}',
  sync_alerts: 'An sabunta gargaɗin NAFDAC: {n}',
  sync_flags: 'Gargaɗin alʼumma: {n}',
  sync_failed: 'Daidaitawa ta kasa. Za a sake gwadawa.',
  sync_running: 'Ana daidaitawa…',
  load_failed: 'Bayanan magunguna ba su riga sun shigo wannan wayar ba. Haɗa da intanet sau ɗaya don saukar da su.',
  draft_badge: 'Fassarar gwaji',
};
```

`src/i18n/pcm.ts`:
```ts
import type { MessageKey } from './index';

export const pcm: Record<MessageKey, string> = {
  app_name: 'DawaCheck',
  tagline: 'Check medicine without internet',
  status_offline: 'No network',
  status_online: 'Network dey',
  status_register: 'Register {date} · {count} medicines',
  status_pending: 'Reports wey dey wait: {n}',
  home_check: 'Check medicine',
  home_check_sub: 'Snap the box',
  home_type: 'Type NAFDAC number',
  home_listen: 'Listen: how to use am',
  home_recent: 'Wetin you check before',
  home_no_recent: 'You never check anything yet',
  nav_home: 'Home',
  nav_history: 'History',
  nav_settings: 'Settings',
  welcome_title: 'Choose your language',
  consent_title: 'Help us make DawaCheck better',
  consent_body: 'Share how you dey use the app, without your name: which page you open and if e read the label well. We no dey collect name, phone number or where you dey.',
  consent_yes: 'Share am without my name',
  state_label: 'Your state (if you want)',
  state_none: 'I no wan talk',
  continue: 'Continue',
  back: 'Go back',
  type_title: 'Type the NAFDAC number',
  type_hint: 'E dey look like A4-1234 and dem print am for the box.',
  type_check: 'Check am',
  type_invalid: 'This one no be NAFDAC number. Example: A4-1234',
  scan_reading: 'We dey read the label for this phone…',
  scan_found: 'We see',
  scan_none: 'We no see NAFDAC number',
  scan_crop: 'Number no clear? Draw box round am',
  scan_crop_help: 'Drag your finger for the NAFDAC number, then press Read this place.',
  scan_crop_done: 'Read this place',
  scan_type: 'Type the number instead',
  scan_private: 'The photo no dey comot from this phone.',
  scan_failed: 'We no fit read the photo. Try again for better light or type the number.',
  v_green_title: 'NAFDAC don register am',
  v_amber_title: 'Check am well',
  v_red_title: 'No take this medicine',
  v_unknown_title: 'We no fit check this box',
  r_registered: 'This number dey inside NAFDAC register.',
  r_name_unconfirmed: 'Make sure say the name for the box na {name}.',
  r_corrected_number: 'We read {read} and we match am to {nrn}.',
  r_reg_lapsed: 'Im NAFDAC registration no dey active. Ask pharmacist before you use am.',
  r_name_mismatch: 'The name for the box no match this NAFDAC number. Fake medicine dey copy real number.',
  r_strength_mismatch: 'The strength for the box no match wetin dem register.',
  r_alert_product: 'NAFDAC don warn about fake or bad ones of this medicine. Compare the batch number.',
  r_community_flag: 'Other people don report this number recently ({n} reports).',
  r_not_in_register: 'This number no dey inside NAFDAC register.',
  r_on_alert: 'NAFDAC don give alert about this medicine.',
  r_batch_on_alert: 'This batch number dey inside NAFDAC alert.',
  r_pack_expired: 'This medicine don expire ({date}).',
  r_no_number_found: 'We no see NAFDAC number. Try again for better light, or type am.',
  r_ambiguous_number: 'The number no clear. Pick the correct one for down or type am.',
  next_green: 'Check say e resemble wetin dem write for down.',
  next_amber: 'Ask pharmacist or health worker before you take am.',
  next_red: 'Show am to health worker and report am.',
  next_unknown: 'Try again for better light, or type the number.',
  looks_like: 'Check say e look like this',
  pack_label: 'Pack: {pack}',
  reg_valid_to: 'Registration dey valid till {date}',
  box_says: 'For the box',
  nrn_is: 'Dem register {nrn} as',
  alert_label: 'NAFDAC alert {id}',
  alert_batches: 'Batch numbers wey dem mention: {batches}',
  ingredient_note: 'NAFDAC get alerts about some {ingredient} medicines. Compare your batch number with NAFDAC alerts.',
  did_you_mean: 'You mean',
  listen: 'Listen',
  report: 'Report this box',
  done: 'Finish',
  report_title: 'Report this box',
  report_reason: 'Wetin wrong?',
  reason_not_in_register: 'Number no dey register',
  reason_name_mismatch: 'Name no match the number',
  reason_strength_mismatch: 'Strength no match',
  reason_pack_expired: 'E don expire',
  reason_reg_lapsed: 'Registration no dey active',
  reason_on_alert: 'E dey NAFDAC alert',
  reason_batch_on_alert: 'Batch dey NAFDAC alert',
  reason_alert_product: 'NAFDAC don warn about am',
  reason_community_flag: 'Other people don report am',
  reason_looks_different: 'E no resemble wetin dem describe',
  reason_other: 'Another thing',
  report_state: 'State',
  report_photo: 'Add small photo',
  report_note: 'Note (if you want)',
  report_save: 'Save report',
  report_saved: 'We don save the report for this phone',
  report_waiting: 'Reports wey dey wait: {n}. Dem go send by themselves when network come.',
  report_sms: 'Send am by SMS now',
  report_sms_note: 'E go use SMS credit. E dey work even when network weak.',
  report_hotline: 'NAFDAC hotline',
  report_privacy: 'We no dey collect name or phone number.',
  history_title: 'History',
  history_empty: 'You never check anything yet',
  settings_title: 'Settings',
  settings_language: 'Language',
  settings_share: 'Share how you use the app (no name)',
  settings_data: 'Data wey dey this phone',
  settings_register: 'Register: {count} medicines · {version}',
  settings_alerts: 'NAFDAC alerts: {count} · {version}',
  settings_flags: 'Community warnings: {count}',
  settings_pending: 'Dey wait to send: {reports} reports, {events} usage records',
  settings_sync: 'Sync now',
  settings_last_sync: 'Last sync: {when}',
  settings_never: 'never',
  settings_sync_off: 'Sync never set for this version.',
  settings_draft: 'This language translation na draft.',
  about_title: 'About',
  about_body: 'DawaCheck dey check NAFDAC records and wetin dem print for the box. E no fit test wetin dey inside. If you no sure, no take am, ask health worker.',
  sync_sent: 'We don send {reports} reports and {events} usage records',
  sync_register: 'Register update: {from} → {to} medicines',
  sync_alerts: 'NAFDAC alerts update: {n}',
  sync_flags: 'Community warnings: {n}',
  sync_failed: 'Sync no work. E go try again.',
  sync_running: 'E dey sync…',
  load_failed: 'Medicine data never enter this phone. Connect to internet one time to download am.',
  draft_badge: 'Draft translation',
};
```

`src/i18n/yo.ts` (draft, partial):
```ts
import type { MessageKey } from './index';

export const yo: Partial<Record<MessageKey, string>> = {
  status_offline: 'Kò sí íńtánẹ́ẹ̀tì',
  home_check: 'Ṣàyẹ̀wò oògùn',
  home_check_sub: 'Ya fọ́tò àpótí rẹ̀',
  home_type: 'Tẹ nọ́ńbà NAFDAC',
  welcome_title: 'Yan èdè rẹ',
  continue: 'Tẹ̀síwájú',
  v_green_title: 'Ó ti forúkọsílẹ̀ pẹ̀lú NAFDAC',
  v_amber_title: 'Ṣàyẹ̀wò dáadáa',
  v_red_title: 'Má ṣe lo oògùn yìí',
  v_unknown_title: 'A kò lè ṣàyẹ̀wò àpótí yìí',
  next_green: 'Rí i dájú pé ó jọ àpèjúwe tó wà nísàlẹ̀.',
  next_amber: 'Béèrè lọ́wọ́ oníṣègùn tàbí òṣìṣẹ́ ìlera kí o tó lò ó.',
  next_red: 'Fi hàn òṣìṣẹ́ ìlera kí o sì fi ìròyìn ránṣẹ́.',
  next_unknown: 'Gbìyànjú lẹ́ẹ̀kan sí i níbi tí ìmọ́lẹ̀ wà, tàbí tẹ nọ́ńbà náà.',
  report: 'Fi ìròyìn nípa àpótí yìí ránṣẹ́',
  listen: 'Gbọ́',
  done: 'Ó ti parí',
  draft_badge: 'Ìtumọ̀ àkọ́kọ́',
};
```

`src/i18n/ig.ts` (draft, partial):
```ts
import type { MessageKey } from './index';

export const ig: Partial<Record<MessageKey, string>> = {
  status_offline: 'Enweghị ịntanetị',
  home_check: 'Lelee ọgwụ',
  home_check_sub: 'See foto igbe ya',
  home_type: 'Pịnye nọmba NAFDAC',
  welcome_title: 'Họrọ asụsụ gị',
  continue: 'Gaa n’ihu',
  v_green_title: 'Edebanyela ya na NAFDAC',
  v_amber_title: 'Lelee ya nke ọma',
  v_red_title: 'Ewela ọgwụ a',
  v_unknown_title: 'Anyị enweghị ike ilele igbe a',
  next_green: 'Hụ na ọ dị ka nkọwa dị n’okpuru.',
  next_amber: 'Jụọ onye na-ere ọgwụ ma ọ bụ onye ọrụ ahụike tupu ị ṅụọ ya.',
  next_red: 'Gosi onye ọrụ ahụike ya ma kọọ ya.',
  next_unknown: 'Nwaa ọzọ ebe ìhè dị, ma ọ bụ pịnye nọmba ahụ.',
  report: 'Kọọ maka igbe a',
  listen: 'Gee ntị',
  done: 'Emechaala',
  draft_badge: 'Ntụgharị nlele',
};
```

`src/i18n/index.ts`:
```ts
import type { Lang } from '../core/types';
import { en } from './en';
import { ha } from './ha';
import { pcm } from './pcm';
import { yo } from './yo';
import { ig } from './ig';

export type MessageKey = keyof typeof en;

export const LANGS: { code: Lang; label: string; native: string; draft: boolean; voice: boolean }[] = [
  { code: 'ha', label: 'Hausa', native: 'Hausa', draft: false, voice: true },
  { code: 'en', label: 'English', native: 'English', draft: false, voice: true },
  { code: 'pcm', label: 'Pidgin', native: 'Naijá (Pidgin)', draft: false, voice: true },
  { code: 'yo', label: 'Yoruba', native: 'Yorùbá', draft: true, voice: false },
  { code: 'ig', label: 'Igbo', native: 'Igbo', draft: true, voice: false },
];

export const CORE_KEYS: MessageKey[] = [
  'status_offline', 'home_check', 'home_check_sub', 'home_type', 'welcome_title', 'continue',
  'v_green_title', 'v_amber_title', 'v_red_title', 'v_unknown_title',
  'next_green', 'next_amber', 'next_red', 'next_unknown', 'report', 'listen', 'done', 'draft_badge',
];

const MESSAGES: Record<Lang, Partial<Record<MessageKey, string>>> = { en, ha, pcm, yo, ig };

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const s = MESSAGES[lang]?.[key] ?? en[key];
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
```

`src/voice/clips.ts`:
```ts
import type { Lang } from '../core/types';

export const CLIP_KEYS = [
  'welcome', 'howto', 'v_green', 'v_green_unconfirmed', 'v_amber_mismatch', 'v_amber_lapsed', 'v_amber_alert',
  'v_amber_community', 'v_red_notfound', 'v_red_alert', 'v_red_expired', 'v_unknown', 'report_saved', 'sync_done',
] as const;
export type ClipKey = (typeof CLIP_KEYS)[number];
export type VoiceLang = 'en' | 'ha' | 'pcm';

export function voiceLangFor(lang: Lang): VoiceLang {
  return lang === 'ha' || lang === 'pcm' ? lang : 'en';
}

export const CLIPS: Record<ClipKey, Record<VoiceLang, string>> = {
  welcome: {
    en: 'Welcome to DawaCheck. Choose your language.',
    ha: 'Barka da zuwa DawaCheck. Zaɓi harshenka.',
    pcm: 'Welcome to DawaCheck. Choose your language.',
  },
  howto: {
    en: 'To check a medicine, press the big button and take a photo of the box. Make sure the NAFDAC number is clear. You can also type the number.',
    ha: 'Don duba magani, danna babban maɓalli ka ɗauki hoton kwalin. Ka tabbata lambar NAFDAC ta fito sosai. Kana iya rubuta lambar ma.',
    pcm: 'To check medicine, press the big button and snap the box. Make sure say the NAFDAC number clear. You fit type the number too.',
  },
  v_green: {
    en: 'This number is registered with NAFDAC. Check that the medicine looks like the description on the screen.',
    ha: 'An yi wa wannan lambar rajista da NAFDAC. Ka tabbata maganin yana kama da bayanin da ke kan allo.',
    pcm: 'NAFDAC don register this number. Check say the medicine resemble wetin dey the screen.',
  },
  v_green_unconfirmed: {
    en: 'This number is registered with NAFDAC. Check that the name on the box matches the name on the screen.',
    ha: 'An yi wa wannan lambar rajista da NAFDAC. Ka tabbata sunan da ke kan kwalin ya yi daidai da sunan da ke kan allo.',
    pcm: 'NAFDAC don register this number. Check say the name for the box match the name for the screen.',
  },
  v_amber_mismatch: {
    en: 'Be careful. The box does not match its NAFDAC number. Ask a pharmacist or health worker before taking it.',
    ha: 'A kula. Kwalin bai yi daidai da lambarsa ta NAFDAC ba. Tambayi masanin magunguna ko maʼaikacin lafiya kafin ka sha.',
    pcm: 'Take care. This box no match im NAFDAC number. Ask pharmacist or health worker before you take am.',
  },
  v_amber_lapsed: {
    en: 'Be careful. The NAFDAC registration of this product is not active. Ask a pharmacist before using it.',
    ha: 'A kula. Rajistar NAFDAC ta wannan magani ba ta aiki. Tambayi masanin magunguna kafin amfani.',
    pcm: 'Take care. The NAFDAC registration for this medicine no dey active. Ask pharmacist before you use am.',
  },
  v_amber_alert: {
    en: 'Be careful. NAFDAC has warned about fake versions of this medicine. Compare the batch number with a health worker.',
    ha: 'A kula. NAFDAC ta yi gargaɗi game da jabun wannan magani. Kwatanta lambar batch tare da maʼaikacin lafiya.',
    pcm: 'Take care. NAFDAC don warn about fake ones of this medicine. Compare the batch number with health worker.',
  },
  v_amber_community: {
    en: 'Be careful. Other people have reported this number. Ask a health worker before taking it.',
    ha: 'A kula. Wasu mutane sun kai rahoton wannan lambar. Tambayi maʼaikacin lafiya kafin ka sha.',
    pcm: 'Take care. Other people don report this number. Ask health worker before you take am.',
  },
  v_red_notfound: {
    en: 'Warning. This number is not in the NAFDAC register. Do not take this medicine. Show it to a health worker and report it.',
    ha: 'Gargaɗi. Wannan lambar ba ta cikin rajistar NAFDAC. Kada ka sha wannan magani. Nuna shi ga maʼaikacin lafiya kuma ka kai rahoto.',
    pcm: 'Warning. This number no dey NAFDAC register. No take this medicine. Show am to health worker and report am.',
  },
  v_red_alert: {
    en: 'Warning. NAFDAC has issued an alert about this medicine. Do not take it. Report it.',
    ha: 'Gargaɗi. NAFDAC ta fitar da gargaɗi game da wannan magani. Kada ka sha shi. Ka kai rahoto.',
    pcm: 'Warning. NAFDAC don give alert about this medicine. No take am. Report am.',
  },
  v_red_expired: {
    en: 'Warning. This medicine has expired. Do not take it.',
    ha: 'Gargaɗi. Wannan magani ya wuce ranar ƙarewarsa. Kada ka sha shi.',
    pcm: 'Warning. This medicine don expire. No take am.',
  },
  v_unknown: {
    en: 'We could not read the number. Try again in good light, or type the number.',
    ha: 'Ba mu iya karanta lambar ba. Sake gwadawa a wuri mai haske, ko ka rubuta lambar.',
    pcm: 'We no fit read the number. Try again for better light, or type the number.',
  },
  report_saved: {
    en: 'Your report is saved. It will be sent when you have internet.',
    ha: 'An ajiye rahotonka. Za a aika shi idan akwai intanet.',
    pcm: 'We don save your report. E go send when network come.',
  },
  sync_done: {
    en: 'DawaCheck is up to date.',
    ha: 'DawaCheck ta sabunta.',
    pcm: 'DawaCheck don update.',
  },
};
```

- [x] **Step 4: Run tests**

Run: `npx vitest run tests/unit/i18n.test.ts && npm run typecheck`
Expected: PASS. A circular type import (`ha.ts` imports `MessageKey` from `index.ts`) is fine because it is type-only.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Hausa, Pidgin, English UI text with Yoruba and Igbo drafts, plus voice clip scripts"
```

---

### Task 14: App shell, onboarding, Home, Type number, Result (MVP) + first E2E

**Files:**
- Create: `src/lib/time.ts`, `src/lib/pendingScan.ts`, `src/state/AppContext.tsx`, `src/components/Layout.tsx`, `src/components/StatusPill.tsx`, `src/components/VerdictView.tsx`, `src/screens/Welcome.tsx`, `src/screens/Home.tsx`, `src/screens/TypeNumber.tsx`, `src/screens/Result.tsx`
- Modify: `src/App.tsx` (replace), `tests/unit/smoke.test.tsx` (replace)
- Create: `playwright.config.ts`, `tests/e2e/helpers.ts`, `tests/e2e/mvp.spec.ts`
- Test: `tests/unit/ui/verdictView.test.tsx`, `tests/unit/time.test.ts`

**Interfaces:**
- Consumes: Tasks 2–13.
- Produces:
  - `formatExpiry(e: Expiry | null): string` (`MM/YYYY`), `formatDate(iso: string | null): string` (`1 Dec 2026`), `timeAgo(iso: string, now?: Date): string`.
  - `pendingScan: { set(f: File): void; take(): File | null }`.
  - `AppProvider` props `{ children: ReactNode; loader?: () => Promise<LoadedPacks>; now?: () => Date }`; `useApp(): AppApi` where `AppApi` has `status: 'loading' | 'ready' | 'error'`, `error: string | null`, `settings: Settings`, `packs: LoadedPacks | null`, `ctx: DecideContext | null`, `online: boolean`, `pendingReports: number`, `t(key, vars?)`, `updateSettings(patch): Promise<void>`, `reloadPacks(): Promise<void>`, `refreshCounts(): Promise<void>`, `check(input: ScanInput, thumb?: Blob | null): Promise<CheckRow>`.
  - `VerdictView` props `{ verdict: Verdict; t: AppApi['t']; onPickSuggestion?: (nrn: string) => void; actions?: ReactNode }`. It renders `data-testid="verdict"` with `data-level={verdict.level}`.
  - Routes after this task: `/welcome`, `/`, `/type`, `/result/:id`, and `*` redirects to `/`.

- [x] **Step 1: Write the failing unit tests**

`tests/unit/time.test.ts`:
```ts
import { formatDate, formatExpiry, timeAgo } from '../../src/lib/time';

test('formats dates for people', () => {
  expect(formatExpiry({ month: 3, year: 2028 })).toBe('03/2028');
  expect(formatExpiry(null)).toBe('');
  expect(formatDate('2026-12-01')).toBe('1 Dec 2026');
  expect(formatDate(null)).toBe('');
  const now = new Date('2026-10-03T12:00:00Z');
  expect(timeAgo('2026-10-03T11:59:30Z', now)).toBe('just now');
  expect(timeAgo('2026-10-03T11:15:00Z', now)).toBe('45 min ago');
  expect(timeAgo('2026-10-03T09:00:00Z', now)).toBe('3 h ago');
  expect(timeAgo('2026-10-01T12:00:00Z', now)).toBe('2 d ago');
});
```

`tests/unit/ui/verdictView.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { VerdictView } from '../../../src/components/VerdictView';
import { decide } from '../../../src/core/verdict';
import { manualInput, parseScan } from '../../../src/core/parse';
import { buildRegisterIndex } from '../../../src/core/registerIndex';
import { buildConfusion } from '../../../src/core/confusion';
import { DEFAULT_THRESHOLDS } from '../../../src/core/types';
import { translate } from '../../../src/i18n';
import { ALERTS, DEMO_TEXT, REGISTER, TODAY } from '../../helpers/fixtures';

const ctx = { register: buildRegisterIndex(REGISTER), alerts: ALERTS, flags: new Map(), confusion: buildConfusion([]), today: TODAY, thresholds: DEFAULT_THRESHOLDS };
const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate('en', k, v);

test('green verdict shows the registered title, product and look-alike description', () => {
  render(<VerdictView verdict={decide(parseScan(DEMO_TEXT.green), ctx)} t={t} />);
  expect(screen.getByTestId('verdict')).toHaveAttribute('data-level', 'green');
  expect(screen.getByText('Registered with NAFDAC')).toBeInTheDocument();
  expect(screen.getByText('Artheget EZ')).toBeInTheDocument();
  expect(screen.getByText(/Yellow colored, oblong/)).toBeInTheDocument();
  expect(screen.getByText('A4-6238')).toHaveClass('code');
});

test('amber mismatch shows the box versus register comparison', () => {
  render(<VerdictView verdict={decide(parseScan(DEMO_TEXT.mismatch), ctx)} t={t} />);
  expect(screen.getByTestId('verdict')).toHaveAttribute('data-level', 'amber');
  expect(screen.getByText('MALAQUICK')).toBeInTheDocument();
  expect(screen.getByText(/does not match this NAFDAC number/)).toBeInTheDocument();
});

test('red verdict for an unknown number offers suggestions', () => {
  const picked: string[] = [];
  render(<VerdictView verdict={decide(manualInput('A4-6239')!, ctx)} t={t} onPickSuggestion={(n) => picked.push(n)} />);
  expect(screen.getByText('Do not take this medicine')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /A4-6238/ }));
  expect(picked).toEqual(['A4-6238']);
});

test('alert verdict shows the alert card', () => {
  render(<VerdictView verdict={decide(parseScan(DEMO_TEXT.alert), ctx)} t={t} />);
  expect(screen.getByText('NAFDAC alert 035/2026')).toBeInTheDocument();
});
```

Replace `tests/unit/smoke.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { App } from '../../src/App';
import { REGISTER, ALERTS } from '../helpers/fixtures';

test('app boots to the language picker on first run', async () => {
  const loader = async () => ({
    register: REGISTER,
    alerts: { version: '2026-10-03', fetchedAt: 'x', alerts: ALERTS },
    flags: [],
    corrections: [],
    manifest: null,
  });
  render(<App loader={loader} />);
  expect(await screen.findByText('Choose your language')).toBeInTheDocument();
});
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/time.test.ts tests/unit/ui tests/unit/smoke.test.tsx`
Expected: FAIL, modules not found.

- [x] **Step 3: Implement helpers**

`src/lib/time.ts`:
```ts
import type { Expiry } from '../core/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatExpiry(e: Expiry | null): string {
  return e ? `${String(e.month).padStart(2, '0')}/${e.year}` : '';
}

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
```

`src/lib/pendingScan.ts`:
```ts
let pending: File | null = null;

export const pendingScan = {
  set(f: File): void {
    pending = f;
  },
  take(): File | null {
    const f = pending;
    pending = null;
    return f;
  },
};
```

- [x] **Step 4: Implement state**

`src/state/AppContext.tsx`:
```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadPacks, type LoadedPacks } from '../data/packs';
import { getSettings, saveSettings, DEFAULT_SETTINGS, type Settings } from '../data/meta';
import { saveCheck } from '../data/checks';
import { countPendingReports } from '../data/reports';
import type { CheckRow } from '../data/db';
import { logEvent, setEventContext } from '../telemetry/events';
import { buildRegisterIndex } from '../core/registerIndex';
import { buildConfusion } from '../core/confusion';
import { decide, type DecideContext } from '../core/verdict';
import { DEFAULT_THRESHOLDS, type ScanInput } from '../core/types';
import { translate, type MessageKey } from '../i18n';

export interface AppApi {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  settings: Settings;
  packs: LoadedPacks | null;
  ctx: DecideContext | null;
  online: boolean;
  pendingReports: number;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  reloadPacks: () => Promise<void>;
  refreshCounts: () => Promise<void>;
  check: (input: ScanInput, thumb?: Blob | null) => Promise<CheckRow>;
}

const AppCtx = createContext<AppApi | null>(null);

export function buildDecideContext(p: LoadedPacks, today: Date): DecideContext {
  return {
    register: buildRegisterIndex(p.register),
    alerts: p.alerts.alerts,
    flags: new Map(p.flags.map((f) => [f.nrn, f])),
    confusion: buildConfusion(p.corrections),
    today,
    thresholds: p.manifest?.thresholds ?? DEFAULT_THRESHOLDS,
  };
}

export function AppProvider({ children, loader = loadPacks, now = () => new Date() }: { children: ReactNode; loader?: () => Promise<LoadedPacks>; now?: () => Date }) {
  const [status, setStatus] = useState<AppApi['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [packs, setPacks] = useState<LoadedPacks | null>(null);
  const [online, setOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pendingReports, setPending] = useState(0);

  const refreshCounts = useCallback(async () => {
    setPending(await countPendingReports());
  }, []);

  const reloadPacks = useCallback(async () => {
    const p = await loader();
    setPacks(p);
    setEventContext({ packVersion: p.register.version });
  }, [loader]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getSettings();
        if (cancelled) return;
        setSettings(s);
        setEventContext({ lang: s.lang });
        await reloadPacks();
        await refreshCounts();
        if (!cancelled) setStatus('ready');
        void logEvent('app_open', { online: navigator.onLine });
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadPacks, refreshCounts]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Keep `now` out of the deps: the default arrow is new every render and would rebuild the 8.9k-product index.
  const nowRef = useRef(now);
  const ctx = useMemo(() => (packs ? buildDecideContext(packs, nowRef.current()) : null), [packs]);

  const t = useCallback<AppApi['t']>((key, vars) => translate(settings.lang, key, vars), [settings.lang]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = await saveSettings(patch);
    setSettings(next);
    setEventContext({ lang: next.lang });
  }, []);

  const check = useCallback<AppApi['check']>(
    async (input, thumb = null) => {
      if (!ctx) throw new Error('packs not loaded');
      const verdict = decide(input, ctx);
      const row = await saveCheck(input, verdict, thumb);
      void logEvent('verdict_shown', { level: verdict.level, reasons: verdict.reasons, source: input.source });
      return row;
    },
    [ctx],
  );

  const api: AppApi = { status, error, settings, packs, ctx, online, pendingReports, t, updateSettings, reloadPacks, refreshCounts, check };
  return <AppCtx.Provider value={api}>{children}</AppCtx.Provider>;
}

export function useApp(): AppApi {
  const v = useContext(AppCtx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
```

- [x] **Step 5: Implement components**

`src/components/Layout.tsx`:
```tsx
import { Link, NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useApp } from '../state/AppContext';
import { LANGS } from '../i18n';

export function Layout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { t, settings } = useApp();
  const lang = LANGS.find((l) => l.code === settings.lang);
  return (
    <div className={wide ? 'app wide' : 'app'}>
      <header className="topbar">
        <Link to="/" className="brand">{t('app_name')}</Link>
        <Link to="/settings" className="pill" aria-label={t('settings_language')}>{lang?.native ?? 'English'}</Link>
      </header>
      <main className="main">{children}</main>
      <nav className="nav" aria-label="Main">
        <NavLink to="/" end>{t('nav_home')}</NavLink>
        <NavLink to="/history">{t('nav_history')}</NavLink>
        <NavLink to="/settings">{t('nav_settings')}</NavLink>
      </nav>
    </div>
  );
}
```

`src/components/StatusPill.tsx`:
```tsx
import { useApp } from '../state/AppContext';
import { formatDate } from '../lib/time';

export function StatusPill() {
  const { t, online, packs, pendingReports } = useApp();
  const count = packs?.register.products.length ?? 0;
  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="pill" data-testid="status-pill">
        <span className={`dot ${online ? 'dot-online' : 'dot-offline'}`} />
        {online ? t('status_online') : t('status_offline')} · {t('status_register', { date: formatDate(packs?.register.version ?? null), count: count.toLocaleString('en') })}
      </span>
      {pendingReports > 0 && <span className="pill">{t('status_pending', { n: pendingReports })}</span>}
    </div>
  );
}
```

`src/components/VerdictView.tsx`:
```tsx
import type { ReactNode } from 'react';
import type { Reason, Verdict } from '../core/types';
import type { AppApi } from '../state/AppContext';
import { formatDate, formatExpiry } from '../lib/time';

const ICONS = {
  green: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  amber: (
    <>
      <path d="M12 3l9.5 17h-19z" />
      <path d="M12 10v4M12 17.5h.01" />
    </>
  ),
  red: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  unknown: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17.5h.01" />
    </>
  ),
};

const INFO_ONLY: Reason[] = ['registered'];

export function VerdictView({
  verdict: v,
  t,
  onPickSuggestion,
  actions,
}: {
  verdict: Verdict;
  t: AppApi['t'];
  onPickSuggestion?: (nrn: string) => void;
  actions?: ReactNode;
}) {
  const title = { green: t('v_green_title'), amber: t('v_amber_title'), red: t('v_red_title'), unknown: t('v_unknown_title') }[v.level];
  const next = { green: t('next_green'), amber: t('next_amber'), red: t('next_red'), unknown: t('next_unknown') }[v.level];
  const p = v.product;
  const vars = {
    name: p?.name ?? '',
    read: v.correctedFrom ?? '',
    nrn: v.nrn ?? '',
    n: v.flag?.reports ?? 0,
    date: formatExpiry(v.expiry),
  };
  const shown = v.reasons.filter((r) => !(INFO_ONLY.includes(r) && v.level !== 'green'));
  const mismatch = v.reasons.includes('name_mismatch') || v.reasons.includes('strength_mismatch');
  const boxStrength = v.boxStrengths.filter((s) => s.unit === 'MG').map((s) => s.value).join(' / ');
  return (
    <section className="stack" data-testid="verdict" data-level={v.level}>
      <div className={`band band-${v.level}`} role="status">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {ICONS[v.level]}
        </svg>
        <span>{title}</span>
      </div>
      <p><strong>{next}</strong></p>

      {p && (
        <div className="card">
          <h2>{p.name}</h2>
          <span>{p.ingredient}{p.strength ? ` · ${p.strength}` : ''}</span>
          <span className="muted small">{[p.form, p.route].filter(Boolean).join(' · ')}</span>
          <span className="code">{p.nrn}</span>
          {p.regExpiry && <span className="small">{t('reg_valid_to', { date: formatDate(p.regExpiry) })}</span>}
        </div>
      )}

      {mismatch && p && (
        <div className="cmp">
          <div className="cmp-box">
            <span className="label">{t('box_says')}</span>
            <strong>{v.boxName ?? '—'}</strong>
            {boxStrength && <span className="code">{boxStrength} mg</span>}
          </div>
          <div>
            <span className="label">{t('nrn_is', { nrn: p.nrn })}</span>
            <strong>{p.name}</strong>
            <span className="code">{p.strength}</span>
          </div>
        </div>
      )}

      {p && v.level !== 'red' && (p.description || p.packSize) && (
        <div className="look">
          <span className="label">{t('looks_like')}</span>
          {p.description && <span>{p.description}</span>}
          {p.packSize && <span>{t('pack_label', { pack: p.packSize })}</span>}
        </div>
      )}

      {v.alert && (
        <div className="alertcard">
          <strong>{t('alert_label', { id: v.alert.id })}</strong>
          <span>{v.alert.summary || v.alert.title}</span>
          {v.alert.products.some((ap) => ap.batches.length) && (
            <span className="code small">{t('alert_batches', { batches: v.alert.products.flatMap((ap) => ap.batches).join(', ') })}</span>
          )}
        </div>
      )}

      <ul className="reasons">
        {shown.map((r) => (
          <li key={r}>{t(`r_${r}` as Parameters<AppApi['t']>[0], vars)}</li>
        ))}
      </ul>

      {v.ingredientAlertNote && <p className="notice small">{t('ingredient_note', { ingredient: v.ingredientAlertNote })}</p>}

      {v.suggestions.length > 0 && onPickSuggestion && (
        <div className="stack">
          <span className="label">{t('did_you_mean')}</span>
          {v.suggestions.map((s) => (
            <button key={`${s.nrn}-${s.name}`} type="button" className="btn btn-plain" onClick={() => onPickSuggestion(s.nrn)}>
              <span className="code">{s.nrn}</span> {s.name}
            </button>
          ))}
        </div>
      )}

      {actions}
    </section>
  );
}
```

- [x] **Step 6: Implement screens and routing**

`src/screens/Welcome.tsx`:
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { LANGS } from '../i18n';
import { NG_STATES } from '../core/states';
import { logEvent } from '../telemetry/events';
import type { Lang } from '../core/types';

export function Welcome() {
  const { t, settings, updateSettings } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<'lang' | 'consent'>('lang');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<string>('');

  async function pick(lang: Lang) {
    await updateSettings({ lang });
    void logEvent('lang_selected', { lang });
    setStep('consent');
  }

  async function finish() {
    await updateSettings({ consent, state: state || null, onboarded: true });
    void logEvent('consent_changed', { value: consent });
    navigate('/', { replace: true });
  }

  return (
    <div className="app">
      <main className="main">
        <span className="brand">{t('app_name')}</span>
        {step === 'lang' ? (
          <>
            <h1>{t('welcome_title')}</h1>
            <div className="stack">
              {LANGS.map((l) => (
                <button key={l.code} type="button" className={`btn ${settings.lang === l.code ? 'btn-primary' : 'btn-outline'}`} onClick={() => pick(l.code)}>
                  {l.native}
                  {l.draft && <span className="small"> · {t('draft_badge')}</span>}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1>{t('consent_title')}</h1>
            <p>{t('consent_body')}</p>
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              {t('consent_yes')}
            </label>
            <label className="field">
              <span className="label">{t('state_label')}</span>
              <select value={state} onChange={(e) => setState(e.target.value)}>
                <option value="">{t('state_none')}</option>
                {NG_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-primary" onClick={finish}>{t('continue')}</button>
          </>
        )}
      </main>
    </div>
  );
}
```

`src/screens/Home.tsx`:
```tsx
import { useEffect, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { StatusPill } from '../components/StatusPill';
import { listChecks } from '../data/checks';
import type { CheckRow } from '../data/db';
import { pendingScan } from '../lib/pendingScan';
import { logEvent } from '../telemetry/events';

export function Home() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [recent, setRecent] = useState<CheckRow[]>([]);

  useEffect(() => {
    void listChecks(5).then(setRecent);
  }, []);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    pendingScan.set(f);
    void logEvent('scan_started', { via: 'camera' });
    navigate('/scan');
  }

  return (
    <Layout>
      <StatusPill />
      <label className="btn btn-primary btn-hero" data-testid="check-button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
        <strong>{t('home_check')}</strong>
        <span>{t('home_check_sub')}</span>
        <input className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={onFile} data-testid="photo-input" />
      </label>
      <Link to="/type" className="btn btn-outline">{t('home_type')}</Link>
      <span className="label">{t('home_recent')}</span>
      {recent.length === 0 ? (
        <p className="muted">{t('home_no_recent')}</p>
      ) : (
        <div className="list">
          {recent.map((c) => (
            <Link key={c.id} to={`/result/${c.id}`}>
              <span className={`dot dot-${c.level}`} />
              <span className="stack" style={{ gap: 0 }}>
                <span>{c.productName ?? c.nrn ?? '—'}</span>
                <span className="small muted code">{c.nrn ?? ''}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
```

`src/screens/TypeNumber.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { manualInput } from '../core/parse';
import { logEvent } from '../telemetry/events';

export function TypeNumber() {
  const { t, check } = useApp();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input = manualInput(value);
    if (!input) {
      setError(true);
      return;
    }
    void logEvent('manual_entry', {});
    const row = await check(input);
    navigate(`/result/${row.id}`);
  }

  return (
    <Layout>
      <h1>{t('type_title')}</h1>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span className="muted">{t('type_hint')}</span>
          <input
            type="text"
            className="code"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="A4-1234"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            data-testid="nrn-input"
          />
        </label>
        {error && <p className="error" role="alert">{t('type_invalid')}</p>}
        <button type="submit" className="btn btn-primary">{t('type_check')}</button>
      </form>
    </Layout>
  );
}
```

`src/screens/Result.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { VerdictView } from '../components/VerdictView';
import { getCheck } from '../data/checks';
import type { CheckRow } from '../data/db';
import { logEvent } from '../telemetry/events';

export function Result() {
  const { id = '' } = useParams();
  const { t, check } = useApp();
  const navigate = useNavigate();
  const [row, setRow] = useState<CheckRow | null>(null);

  useEffect(() => {
    void getCheck(id).then((r) => setRow(r ?? null));
  }, [id]);

  async function pick(nrn: string) {
    if (!row) return;
    void logEvent('suggestion_chosen', { nrn });
    if (row.verdict.nrn) void logEvent('nrn_corrected', { read: row.verdict.nrn, corrected: nrn });
    const next = await check({ ...row.input, nrnCandidates: [nrn] });
    navigate(`/result/${next.id}`, { replace: true });
  }

  if (!row) return <Layout><p className="muted">…</p></Layout>;
  return (
    <Layout>
      <VerdictView
        verdict={row.verdict}
        t={t}
        onPickSuggestion={pick}
        actions={
          <div className="stack">
            {row.verdict.level !== 'green' && (
              <Link to={`/report/${row.id}`} className="btn btn-outline" data-testid="report-link">{t('report')}</Link>
            )}
            <Link to="/" className="btn btn-plain">{t('done')}</Link>
          </div>
        }
      />
    </Layout>
  );
}
```

`src/App.tsx` (replace):
```tsx
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppProvider, useApp } from './state/AppContext';
import type { LoadedPacks } from './data/packs';
import { Welcome } from './screens/Welcome';
import { Home } from './screens/Home';
import { TypeNumber } from './screens/TypeNumber';
import { Result } from './screens/Result';

function Gate({ children }: { children: ReactNode }) {
  const { status, error, settings, t } = useApp();
  const location = useLocation();
  if (status === 'loading') {
    return (
      <div className="app">
        <main className="main"><span className="brand">DawaCheck</span><div className="progress"><i style={{ width: '60%' }} /></div></main>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="app">
        <main className="main"><span className="brand">DawaCheck</span><p className="error">{t('load_failed')}</p><p className="small muted">{error}</p></main>
      </div>
    );
  }
  if (!settings.onboarded && location.pathname !== '/welcome') return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

export function App({ loader }: { loader?: () => Promise<LoadedPacks> }) {
  return (
    <AppProvider loader={loader}>
      <HashRouter>
        <Gate>
          <Routes>
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/" element={<Home />} />
            <Route path="/type" element={<TypeNumber />} />
            <Route path="/result/:id" element={<Result />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Gate>
      </HashRouter>
    </AppProvider>
  );
}
```

- [x] **Step 7: Run unit tests**

Run: `npx vitest run tests/unit && npm run typecheck`
Expected: PASS.

- [x] **Step 8: Add Playwright and the first E2E**

```bash
npm i -D @playwright/test
npx playwright install chromium
npm pkg set scripts.build:e2e="vite build --mode e2e --outDir dist-e2e" scripts.preview:e2e="vite preview --outDir dist-e2e --port 4173 --strictPort" scripts.e2e="playwright test" scripts.verify="npm run typecheck && npm run test && npm run build && npm run e2e"
```

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure', serviceWorkers: 'allow' },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
  webServer: [
    {
      command: 'npm run build:e2e && npm run preview:e2e',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
  ],
});
```

`tests/e2e/helpers.ts`:
```ts
import { expect, type Page } from '@playwright/test';

export async function onboard(page: Page, lang = 'English') {
  await page.goto('/');
  await expect(page.getByText('Choose your language')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: lang, exact: false }).first().click();
  await page.getByRole('button', { name: /Continue|Ci gaba|Continue/ }).click();
  await expect(page.getByTestId('check-button')).toBeVisible();
}

export async function typeNumber(page: Page, nrn: string) {
  await page.goto('/#/type');
  await page.getByTestId('nrn-input').fill(nrn);
  await page.getByRole('button', { name: /^Check$/ }).click();
  await expect(page.getByTestId('verdict')).toBeVisible();
}
```

`tests/e2e/mvp.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { onboard, typeNumber } from './helpers';

test('first run, then a registered number is green', async ({ page }) => {
  await onboard(page);
  await typeNumber(page, 'A4-6238');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'green');
  await expect(page.getByText('Registered with NAFDAC')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Artheget EZ' })).toBeVisible();
});

test('a number missing from the register is red', async ({ page }) => {
  await onboard(page);
  await typeNumber(page, 'A4-99231');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'red');
  await expect(page.getByText('Do not take this medicine')).toBeVisible();
});

test('Hausa interface', async ({ page }) => {
  await onboard(page, 'Hausa');
  await expect(page.getByText('Duba magani')).toBeVisible();
});
```

- [x] **Step 9: Run E2E**

Run: `npm run e2e`
Expected: 3 passed. If `onboard` cannot find the Continue button in Hausa, the consent screen is already translated. Match `Ci gaba` (the regex already includes it).

- [x] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: app shell with onboarding, home, typed check and verdict screen"
```

---

### Task 15: Report, History, Settings screens + phase gate (MVP checkpoint)

**Files:**
- Create: `src/lib/blob.ts`, `src/screens/Report.tsx`, `src/screens/History.tsx`, `src/screens/Settings.tsx`
- Modify: `src/App.tsx` (add routes `/report/:id`, `/history`, `/settings`)
- Test: `tests/unit/ui/report.test.tsx`, `tests/e2e/report.spec.ts`

**Interfaces:**
- Consumes: Tasks 11–14.
- Produces: `blobToDataUrl(b: Blob): Promise<string>`; routes `/report/:id`, `/history`, `/settings`; the report screen element `data-testid="report-saved"` after saving.

- [ ] **Step 1: Write the failing component test** `tests/unit/ui/report.test.tsx`

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from '../../../src/state/AppContext';
import { Report } from '../../../src/screens/Report';
import { saveCheck } from '../../../src/data/checks';
import { db } from '../../../src/data/db';
import { decide } from '../../../src/core/verdict';
import { manualInput } from '../../../src/core/parse';
import { buildRegisterIndex } from '../../../src/core/registerIndex';
import { buildConfusion } from '../../../src/core/confusion';
import { DEFAULT_THRESHOLDS } from '../../../src/core/types';
import { ALERTS, REGISTER, TODAY } from '../../helpers/fixtures';

const loader = async () => ({ register: REGISTER, alerts: { version: 'v', fetchedAt: 'x', alerts: ALERTS }, flags: [], corrections: [], manifest: null });

test('saving a report queues it and shows SMS backup and hotline', async () => {
  const ctx = { register: buildRegisterIndex(REGISTER), alerts: ALERTS, flags: new Map(), confusion: buildConfusion([]), today: TODAY, thresholds: DEFAULT_THRESHOLDS };
  const input = manualInput('A4-99231')!;
  const row = await saveCheck(input, decide(input, ctx), null);
  render(
    <AppProvider loader={loader}>
      <MemoryRouter initialEntries={[`/report/${row.id}`]}>
        <Routes>
          <Route path="/report/:id" element={<Report />} />
        </Routes>
      </MemoryRouter>
    </AppProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Save report' }));
  await waitFor(() => expect(screen.getByTestId('report-saved')).toBeInTheDocument());
  const reports = await db.reports.toArray();
  expect(reports.at(-1)).toMatchObject({ nrn: 'A4-99231', reason: 'not_in_register', verdict: 'red', syncedAt: null });
  expect(screen.getByText('0800-162-3322')).toHaveClass('code');
  expect(screen.getByRole('link', { name: 'Send by SMS now' }).getAttribute('href')).toContain('sms:');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/ui/report.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/lib/blob.ts`:
```ts
export function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}
```

`src/screens/Report.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { getCheck } from '../data/checks';
import { saveReport, countPendingReports } from '../data/reports';
import type { CheckRow } from '../data/db';
import { NG_STATES } from '../core/states';
import { NAFDAC_HOTLINE, reportReasonFor, smsBody, smsHref } from '../core/sms';
import { REPORT_REASONS, type ReportReason } from '../core/types';
import { blobToDataUrl } from '../lib/blob';
import { logEvent } from '../telemetry/events';
import type { MessageKey } from '../i18n';

export function Report() {
  const { id = '' } = useParams();
  const { t, settings, packs, refreshCounts } = useApp();
  const [row, setRow] = useState<CheckRow | null>(null);
  const [reason, setReason] = useState<ReportReason>('other');
  const [state, setState] = useState<string>(settings.state ?? '');
  const [photo, setPhoto] = useState(false);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<number | null>(null);

  useEffect(() => {
    void getCheck(id).then((r) => {
      if (!r) return;
      setRow(r);
      setReason(reportReasonFor(r.verdict));
    });
  }, [id]);

  async function save() {
    if (!row) return;
    await saveReport({
      checkId: row.id,
      nrn: row.verdict.nrn,
      productName: row.verdict.product?.name ?? null,
      reason,
      verdict: row.verdict.level,
      state: state || null,
      note: note.trim() || null,
      photoThumb: photo && row.thumb ? await blobToDataUrl(row.thumb) : null,
      ocrExcerpt: row.input.text ? row.input.text.slice(0, 500) : null,
      lang: settings.lang,
      packVersion: packs?.register.version ?? '',
    });
    void logEvent('report_saved', { reason });
    await refreshCounts();
    setSaved(await countPendingReports());
  }

  if (!row) return <Layout><p className="muted">…</p></Layout>;

  if (saved !== null) {
    const body = smsBody({ nrn: row.verdict.nrn, reason, state: state || null });
    return (
      <Layout>
        <h1 data-testid="report-saved">{t('report_saved')}</h1>
        <div className="queue"><strong>{t('report_waiting', { n: saved })}</strong></div>
        <a className="btn btn-plain" href={smsHref(body)} onClick={() => void logEvent('report_sms_opened', {})}>{t('report_sms')}</a>
        <p className="small muted">{t('report_sms_note')}</p>
        <p>{t('report_hotline')}: <span className="code">{NAFDAC_HOTLINE}</span></p>
        <p className="small muted">{t('report_privacy')}</p>
        <Link to="/" className="btn btn-primary">{t('done')}</Link>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1>{t('report_title')}</h1>
      <p className="code">{row.verdict.nrn ?? '—'} {row.verdict.product?.name ?? ''}</p>
      <label className="field">
        <span className="label">{t('report_reason')}</span>
        <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>{t(`reason_${r}` as MessageKey)}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">{t('report_state')}</span>
        <select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">{t('state_none')}</option>
          {NG_STATES.map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
      </label>
      {row.thumb && (
        <label className="check">
          <input type="checkbox" checked={photo} onChange={(e) => setPhoto(e.target.checked)} />
          {t('report_photo')}
        </label>
      )}
      <label className="field">
        <span className="label">{t('report_note')}</span>
        <textarea maxLength={200} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <p className="small muted">{t('report_privacy')}</p>
      <button type="button" className="btn btn-primary" onClick={save}>{t('report_save')}</button>
    </Layout>
  );
}
```

`src/screens/History.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { listChecks } from '../data/checks';
import type { CheckRow } from '../data/db';
import { timeAgo } from '../lib/time';

export function History() {
  const { t } = useApp();
  const [rows, setRows] = useState<CheckRow[]>([]);
  useEffect(() => {
    void listChecks(200).then(setRows);
  }, []);
  return (
    <Layout>
      <h1>{t('history_title')}</h1>
      {rows.length === 0 ? (
        <p className="muted">{t('history_empty')}</p>
      ) : (
        <div className="list">
          {rows.map((c) => (
            <Link key={c.id} to={`/result/${c.id}`}>
              <span className={`dot dot-${c.level}`} />
              <span className="stack" style={{ gap: 0, flex: 1 }}>
                <span>{c.productName ?? c.nrn ?? '—'}</span>
                <span className="small muted"><span className="code">{c.nrn ?? ''}</span> · {timeAgo(c.createdAt)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
```

`src/screens/Settings.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { LANGS } from '../i18n';
import { NG_STATES } from '../core/states';
import { countPendingEvents, logEvent } from '../telemetry/events';
import type { Lang } from '../core/types';

export function Settings() {
  const { t, settings, updateSettings, packs, pendingReports } = useApp();
  const [pendingEvents, setPendingEvents] = useState(0);
  const lang = LANGS.find((l) => l.code === settings.lang);

  useEffect(() => {
    void countPendingEvents().then(setPendingEvents);
  }, []);

  return (
    <Layout>
      <h1>{t('settings_title')}</h1>
      <label className="field">
        <span className="label">{t('settings_language')}</span>
        <select
          value={settings.lang}
          onChange={(e) => {
            const l = e.target.value as Lang;
            void updateSettings({ lang: l });
            void logEvent('lang_selected', { lang: l });
          }}
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>{l.native}</option>
          ))}
        </select>
      </label>
      {lang?.draft && <p className="notice small">{t('settings_draft')}</p>}
      <label className="field">
        <span className="label">{t('report_state')}</span>
        <select value={settings.state ?? ''} onChange={(e) => void updateSettings({ state: e.target.value || null })}>
          <option value="">{t('state_none')}</option>
          {NG_STATES.map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={settings.consent}
          onChange={(e) => {
            void updateSettings({ consent: e.target.checked });
            void logEvent('consent_changed', { value: e.target.checked });
          }}
          data-testid="consent-toggle"
        />
        {t('settings_share')}
      </label>
      <h2>{t('settings_data')}</h2>
      <div className="card small" data-testid="data-card">
        <span>{t('settings_register', { count: (packs?.register.products.length ?? 0).toLocaleString('en'), version: packs?.register.version ?? '' })}</span>
        <span>{t('settings_alerts', { count: packs?.alerts.alerts.length ?? 0, version: packs?.alerts.version ?? '' })}</span>
        <span>{t('settings_flags', { count: packs?.flags.length ?? 0 })}</span>
        <span>{t('settings_pending', { reports: pendingReports, events: pendingEvents })}</span>
      </div>
      <h2>{t('about_title')}</h2>
      <p>{t('about_body')}</p>
    </Layout>
  );
}
```

Modify `src/App.tsx`: add imports and routes before the `*` route:
```tsx
import { Report } from './screens/Report';
import { History } from './screens/History';
import { Settings } from './screens/Settings';
// inside <Routes>:
<Route path="/report/:id" element={<Report />} />
<Route path="/history" element={<History />} />
<Route path="/settings" element={<Settings />} />
```

- [ ] **Step 4: Write E2E** `tests/e2e/report.spec.ts`

```ts
import { expect, test } from '@playwright/test';
import { onboard, typeNumber } from './helpers';

test('report a red box offline-style and see the queue', async ({ page }) => {
  await onboard(page);
  await typeNumber(page, 'A4-99231');
  await page.getByTestId('report-link').click();
  await page.getByRole('button', { name: 'Save report' }).click();
  await expect(page.getByTestId('report-saved')).toBeVisible();
  await expect(page.getByText(/Reports waiting: 1/)).toBeVisible();
  await page.goto('/#/history');
  await expect(page.locator('.list a')).toHaveCount(1);
  await page.goto('/#/settings');
  await expect(page.getByTestId('data-card')).toContainText('Register:');
});
```

- [ ] **Step 5: Phase gate**

Run: `npm run verify`
Expected: typecheck, all unit tests, build and all E2E specs PASS.

**MVP checkpoint:** typed checks, verdicts, reports, history, settings and 5 languages now work. Append `- HH:MM · MVP checkpoint reached` to `docs/progress.md`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: report, history and settings screens (MVP checkpoint)"
```
