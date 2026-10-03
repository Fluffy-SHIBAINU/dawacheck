import type { SyncConfig } from './config';

export interface RetryOpts {
  tries: number;
  delays: number[];
  timeoutMs: number;
}

export const DEFAULT_RETRY: RetryOpts = { tries: 3, delays: [1000, 2000, 4000], timeoutMs: 15_000 };

export async function fetchWithRetry(f: typeof fetch, url: string, init: RequestInit = {}, retry: RetryOpts = DEFAULT_RETRY): Promise<Response> {
  let last: unknown = null;
  for (let i = 0; i < retry.tries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), retry.timeoutMs);
    try {
      const res = await f(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      clearTimeout(timer);
      last = e;
      if (i < retry.tries - 1) await new Promise((r) => setTimeout(r, retry.delays[i] ?? 4000));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

export function authHeaders(cfg: SyncConfig, extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}`, 'Content-Type': 'application/json', ...extra };
}
