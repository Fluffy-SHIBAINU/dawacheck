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
