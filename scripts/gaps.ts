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
