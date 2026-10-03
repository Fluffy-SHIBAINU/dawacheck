import { env } from './lib/env';

const url = env('VITE_SUPABASE_URL');
const anon = env('VITE_SUPABASE_ANON_KEY');
if (!url || !anon) {
  console.error('Supabase not configured in .env');
  process.exit(2);
}
const h = { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
const ev = { id: crypto.randomUUID(), device_id: '00000000-0000-4000-8000-000000000000', ts: new Date().toISOString(), type: 'app_open', props: { smoke: true } };
const ins = await fetch(`${url}/rest/v1/events`, { method: 'POST', headers: h, body: JSON.stringify(ev) });
console.log(`insert event: ${ins.status}`);
const flags = await fetch(`${url}/rest/v1/community_flags?select=*`, { headers: h });
console.log(`read community_flags: ${flags.status}`);
const raw = await fetch(`${url}/rest/v1/events?select=*&limit=1`, { headers: h });
console.log(`read raw events (must be empty or denied): ${raw.status} ${(await raw.text()).slice(0, 40)}`);
if (ins.status !== 201 || flags.status !== 200) process.exit(1);
console.log('backend OK');
