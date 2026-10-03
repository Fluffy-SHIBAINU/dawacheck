import { syncConfig } from './config';
import { authHeaders, fetchWithRetry } from './http';

export async function getView<T>(name: string, f: typeof fetch = fetch.bind(globalThis)): Promise<T[]> {
  const cfg = syncConfig();
  if (!cfg.enabled) throw new Error('sync not configured');
  const res = await fetchWithRetry(f, `${cfg.url}/rest/v1/${name}?select=*`, { headers: authHeaders(cfg) }, { tries: 2, delays: [500], timeoutMs: 10_000 });
  if (!res.ok) throw new Error(`${name} HTTP ${res.status}`);
  return (await res.json()) as T[];
}
