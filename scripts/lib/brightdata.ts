import { env } from './env';

export async function fetchViaBrightData(url: string): Promise<string> {
  const key = env('BRIGHTDATA_API_KEY');
  const zone = env('BRIGHTDATA_ZONE') ?? 'web_unlocker1';
  if (!key) throw new Error('BRIGHTDATA_API_KEY not set');
  const res = await fetch('https://api.brightdata.com/request', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ zone, url, format: 'raw' }),
  });
  if (!res.ok) throw new Error(`BrightData HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return await res.text();
}
