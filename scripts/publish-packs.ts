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
