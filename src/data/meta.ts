import { db as defaultDb, type DawaDB } from './db';
import type { Lang } from '../core/types';

export interface Settings {
  lang: Lang;
  state: string | null;
  consent: boolean;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = { lang: 'en', state: null, consent: false, onboarded: false };

export async function getMeta<T>(key: string, d: DawaDB = defaultDb): Promise<T | undefined> {
  return (await d.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown, d: DawaDB = defaultDb): Promise<void> {
  await d.meta.put({ key, value });
}

export async function getSettings(d: DawaDB = defaultDb): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await getMeta<Partial<Settings>>('settings', d)) ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>, d: DawaDB = defaultDb): Promise<Settings> {
  const next = { ...(await getSettings(d)), ...patch };
  await setMeta('settings', next, d);
  return next;
}

export function uuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function getDeviceId(d: DawaDB = defaultDb): Promise<string> {
  const existing = await getMeta<string>('deviceId', d);
  if (existing) return existing;
  const id = uuid();
  await setMeta('deviceId', id, d);
  return id;
}
