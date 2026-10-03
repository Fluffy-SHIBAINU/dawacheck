import { ALERT_KINDS, type Alert, type AlertKind } from '../../src/core/types';
import { decodeEntities } from '../../src/core/text';
import { normalizeNrn } from '../../src/core/parse/nrn';

export interface AlertMeta {
  wpId: number;
  url: string;
  date: string;
  title: string;
}

export interface ExtractedAlert {
  kind: AlertKind;
  summary: string;
  appliesToNigeria: boolean;
  products: {
    brand: string | null;
    ingredient: string | null;
    strength: string | null;
    manufacturer: string | null;
    nrn: string | null;
    batches: string[];
  }[];
}

export function alertIdFromTitle(title: string): string | null {
  const m = title.match(/Public\s+Alert\s+No\.?\s*(\d{1,3})\s*\/\s*(\d{4})/i);
  return m ? `${m[1].padStart(3, '0')}/${m[2]}` : null;
}

export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(stripped)
    .replace(/[ \t ]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

export function kindFromText(t: string): AlertKind {
  const s = t.toLowerCase();
  if (/unregistered|not registered/.test(s)) return 'unregistered';
  if (/counterfeit|falsified|fake/.test(s)) return 'counterfeit';
  if (/recall/.test(s)) return 'recall';
  if (/substandard|adulterated|contaminat/.test(s)) return 'substandard';
  if (/watchlist/.test(s)) return 'watchlist';
  return 'other';
}

const LEADING = [
  /^alert on\s+/i,
  /^the\s+/i,
  /^seizure of\s+/i,
  /^marketing and sale of\s+/i,
  /^recall(ed)?\s+(of\s+)?/i,
  /^specific batches of\s+/i,
  /^suspected\s+/i,
  /^substandard and falsified\s+/i,
  /^counterfeit\s+/i,
  /^falsified\s+/i,
  /^substandard\s+/i,
  /^unregistered\s+/i,
  /^adulterated\s+/i,
  /^products mimicking\s+/i,
  /^and\s+/i,
];

export function brandFromTitle(title: string): string | null {
  let s = title.replace(/^.*?Public\s+Alert\s+No\.?\s*\d+\s*\/\s*\d{4}\s*[-–—:]?\s*/i, '').trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of LEADING) {
      if (re.test(s)) {
        s = s.replace(re, '');
        changed = true;
      }
    }
  }
  s = s
    .replace(/\(.*?\)/g, '')
    .replace(/\s+(in|by|from)\s+.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s ? s.slice(0, 80) : null;
}

export function appliesToNigeriaFromTitle(title: string): boolean {
  if (/nigeria/i.test(title)) return true;
  return !/(south africa|pakistan|india|europe|united states|united kingdom|canada|australia)/i.test(title);
}

function titleProduct(title: string) {
  return { brand: brandFromTitle(title), ingredient: null, strength: null, manufacturer: null, nrn: null, batches: [] as string[] };
}

export function fallbackAlertFromTitle(m: AlertMeta): Alert {
  return {
    id: alertIdFromTitle(m.title) ?? `wp-${m.wpId}`,
    wpId: m.wpId,
    url: m.url,
    date: m.date,
    title: m.title,
    kind: kindFromText(m.title),
    products: [titleProduct(m.title)],
    summary: m.title.slice(0, 280),
    appliesToNigeria: appliesToNigeriaFromTitle(m.title),
  };
}

const trimOrNull = (s: string | null | undefined): string | null => (s && s.trim() ? s.trim() : null);

export function normalizeAlert(x: ExtractedAlert, m: AlertMeta): Alert {
  const products = (x.products ?? []).map((p) => ({
    brand: trimOrNull(p.brand),
    ingredient: trimOrNull(p.ingredient),
    strength: trimOrNull(p.strength),
    manufacturer: trimOrNull(p.manufacturer),
    nrn: normalizeNrn(p.nrn),
    batches: (p.batches ?? []).map((b) => b.toUpperCase().replace(/\s+/g, '')).filter(Boolean),
  }));
  return {
    id: alertIdFromTitle(m.title) ?? `wp-${m.wpId}`,
    wpId: m.wpId,
    url: m.url,
    date: m.date,
    title: m.title,
    kind: ALERT_KINDS.includes(x.kind) ? x.kind : 'other',
    products: products.length ? products : [titleProduct(m.title)],
    summary: (x.summary ?? '').slice(0, 280),
    appliesToNigeria: x.appliesToNigeria !== false,
  };
}
