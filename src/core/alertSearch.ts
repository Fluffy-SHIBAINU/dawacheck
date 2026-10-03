import type { Alert } from './types';
import { normalizeText } from './text';

function haystack(a: Alert): string {
  const parts = [a.id, a.title, a.summary];
  for (const p of a.products) parts.push(p.brand ?? '', p.ingredient ?? '', p.manufacturer ?? '', ...p.batches);
  return normalizeText(parts.join(' ')).replace(/\s+/g, ' ');
}

/** NAFDAC alerts, newest first, filtered so that every query word appears somewhere in the alert. */
export function filterAlerts(alerts: Alert[], query: string): Alert[] {
  const sorted = [...alerts].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.join('').length < 2) return sorted;
  return sorted.filter((a) => {
    const h = haystack(a);
    return words.every((w) => h.includes(w));
  });
}
