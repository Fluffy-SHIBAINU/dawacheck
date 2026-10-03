import { db as defaultDb, type DawaDB, type PackName } from './db';
import { compareVersions, validateManifest } from '../core/manifest';
import type { AlertsPack, CommunityFlag, Correction, Manifest, RegisterPack } from '../core/types';

export interface LoadedPacks {
  register: RegisterPack;
  alerts: AlertsPack;
  flags: CommunityFlag[];
  corrections: Correction[];
  manifest: Manifest | null;
}

export interface LoadOptions {
  fetchImpl?: typeof fetch;
  d?: DawaDB;
  base?: string;
}

export async function savePack(name: PackName, version: string, json: string, d: DawaDB = defaultDb): Promise<void> {
  await d.packs.put({ name, version, json, updatedAt: new Date().toISOString() });
}

async function loadBundled<T extends { version: string }>(
  name: 'register' | 'alerts',
  bundledVersion: string | undefined,
  f: typeof fetch,
  base: string,
  d: DawaDB,
): Promise<T> {
  const row = await d.packs.get(name);
  if (row && (!bundledVersion || compareVersions(row.version, bundledVersion) >= 0)) return JSON.parse(row.json) as T;
  let res: Response;
  try {
    res = await f(`${base}packs/${name}.json`);
  } catch (e) {
    if (row) return JSON.parse(row.json) as T;
    throw e;
  }
  if (!res.ok) {
    if (row) return JSON.parse(row.json) as T;
    throw new Error(`could not load ${name} pack (HTTP ${res.status})`);
  }
  const text = await res.text();
  const pack = JSON.parse(text) as T;
  await savePack(name, pack.version, text, d);
  return pack;
}

export async function loadPacks(opts: LoadOptions = {}): Promise<LoadedPacks> {
  const f = opts.fetchImpl ?? fetch.bind(globalThis);
  const d = opts.d ?? defaultDb;
  const base = opts.base ?? import.meta.env.BASE_URL ?? '/';
  let manifest: Manifest | null = null;
  try {
    const r = await f(`${base}packs/manifest.json`);
    if (r.ok) manifest = validateManifest(await r.json());
  } catch {
    manifest = null;
  }
  const register = await loadBundled<RegisterPack>('register', manifest?.packs.register.version, f, base, d);
  const alerts = await loadBundled<AlertsPack>('alerts', manifest?.packs.alerts.version, f, base, d);
  const flags = JSON.parse((await d.packs.get('flags'))?.json ?? '[]') as CommunityFlag[];
  const corrections = JSON.parse((await d.packs.get('corrections'))?.json ?? '[]') as Correction[];
  return { register, alerts, flags, corrections, manifest };
}
