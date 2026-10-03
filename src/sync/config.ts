export interface SyncConfig {
  mode: 'supabase' | 'mock' | 'off';
  url: string;
  anonKey: string;
  enabled: boolean;
}

export function syncConfig(env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>): SyncConfig {
  // Unit tests render the whole app; never let them reach a real backend even if .env enables sync.
  if (env.MODE === 'test' || env.VITEST) return { mode: 'off', url: '', anonKey: '', enabled: false };
  const mode = (env.VITE_SYNC_MODE ?? 'off') as SyncConfig['mode'];
  const url = (env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
  const anonKey = env.VITE_SUPABASE_ANON_KEY ?? '';
  return { mode, url, anonKey, enabled: mode !== 'off' && Boolean(url) && Boolean(anonKey) };
}
