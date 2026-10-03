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
  await new Promise((r) => setTimeout(r, 5));
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
