import type { Lang } from '../core/types';
import { en } from './en';
import { ha } from './ha';
import { pcm } from './pcm';
import { yo } from './yo';
import { ig } from './ig';

export type MessageKey = keyof typeof en;

export const LANGS: { code: Lang; label: string; native: string; draft: boolean; voice: boolean }[] = [
  { code: 'ha', label: 'Hausa', native: 'Hausa', draft: false, voice: true },
  { code: 'en', label: 'English', native: 'English', draft: false, voice: true },
  { code: 'pcm', label: 'Pidgin', native: 'Naijá (Pidgin)', draft: false, voice: true },
  { code: 'yo', label: 'Yoruba', native: 'Yorùbá', draft: true, voice: false },
  { code: 'ig', label: 'Igbo', native: 'Igbo', draft: true, voice: false },
];

export const CORE_KEYS: MessageKey[] = [
  'status_offline', 'home_check', 'home_check_sub', 'home_type', 'welcome_title', 'continue',
  'v_green_title', 'v_amber_title', 'v_red_title', 'v_unknown_title',
  'next_green', 'next_amber', 'next_red', 'next_unknown', 'report', 'listen', 'done', 'draft_badge',
];

const MESSAGES: Record<Lang, Partial<Record<MessageKey, string>>> = { en, ha, pcm, yo, ig };

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const s = MESSAGES[lang]?.[key] ?? en[key];
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
