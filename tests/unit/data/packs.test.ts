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

test('a newer bundled pack that fails to download falls back to the stored older one', async () => {
  for (const failure of ['network', 'http'] as const) {
    const d = fresh();
    await savePack('register', '2026-09-01', JSON.stringify({ ...REGISTER, version: '2026-09-01' }), d);
    const files = bundled('2026-10-03') as Record<string, unknown>;
    const f = (async (url: string) => {
      if (url.endsWith('register.json')) {
        if (failure === 'network') throw new TypeError('Failed to fetch');
        return new Response('busy', { status: 503 });
      }
      return new Response(JSON.stringify(files[url.replace(/^\//, '')]), { status: 200 });
    }) as unknown as typeof fetch;
    const p = await loadPacks({ fetchImpl: f, d, base: '/' });
    expect(p.register.version, failure).toBe('2026-09-01');
  }
});

test('with nothing stored, a failed pack download is an error the app can show', async () => {
  const d = fresh();
  const files = bundled() as Record<string, unknown>;
  const f = (async (url: string) =>
    url.endsWith('register.json') ? new Response('busy', { status: 503 }) : new Response(JSON.stringify(files[url.replace(/^\//, '')]), { status: 200 })) as unknown as typeof fetch;
  await expect(loadPacks({ fetchImpl: f, d, base: '/' })).rejects.toThrow('could not load register pack (HTTP 503)');
});
