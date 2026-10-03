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

test('mock caps each device at 20 reports a day; a batch that crosses the cap is rejected whole', async () => {
  const m = await startMock(0);
  try {
    const h = { apikey: 'k', Authorization: 'Bearer k', 'Content-Type': 'application/json' };
    const row = (device: string, i: number) => ({ id: `${device}-${i}`, device_id: device, created_at: new Date().toISOString(), nrn: 'A4-6238', reason: 'other', verdict: 'amber', state: 'KN' });
    const post = (rows: object[]) => fetch(`${m.url}/rest/v1/reports`, { method: 'POST', headers: h, body: JSON.stringify(rows) });
    const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => row('d1', from + i));
    expect((await post(range(0, 15))).status).toBe(201);
    expect((await post(range(15, 10))).status).toBe(429);
    expect(m.state.reports).toHaveLength(15);
    expect((await post(range(15, 5))).status).toBe(201);
    expect((await post(range(20, 1))).status).toBe(429);
    expect((await post(range(0, 1))).status).toBe(409); // a retried id is "already stored", never "limited"
    expect((await post([row('d2', 0)])).status).toBe(201);
    expect(m.state.reports).toHaveLength(21);
  } finally {
    await m.close();
  }
});

test('like Postgres, a plain insert of a stored id is a 409 and inserts nothing', async () => {
  const m = await startMock(0);
  try {
    const h = { apikey: 'k', Authorization: 'Bearer k', 'Content-Type': 'application/json' };
    const row = (id: string) => ({ id, device_id: 'd1', created_at: new Date().toISOString(), nrn: 'A4-6238', reason: 'other', verdict: 'amber', state: 'KN' });
    expect((await fetch(`${m.url}/rest/v1/reports`, { method: 'POST', headers: h, body: JSON.stringify([row('a')]) })).status).toBe(201);
    expect((await fetch(`${m.url}/rest/v1/reports`, { method: 'POST', headers: h, body: JSON.stringify([row('b'), row('a')]) })).status).toBe(409);
    expect(m.state.reports.map((r) => r.id)).toEqual(['a']);
  } finally {
    await m.close();
  }
});
