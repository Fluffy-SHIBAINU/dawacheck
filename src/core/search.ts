import type { Product } from './types';
import type { RegisterIndex } from './registerIndex';
import { normalizeText } from './text';

interface Entry {
  p: Product;
  name: string[];
  ingredient: string[];
  /** NRN without the hyphen, e.g. A46238. */
  nrn: string;
}

const cache = new WeakMap<RegisterIndex, Entry[]>();

function tokens(s: string): string[] {
  return normalizeText(s).split(/[^A-Z0-9]+/).filter(Boolean);
}

function entries(idx: RegisterIndex): Entry[] {
  let list = cache.get(idx);
  if (!list) {
    list = [];
    for (const products of idx.byNrn.values()) {
      for (const p of products) list.push({ p, name: tokens(p.name), ingredient: tokens(p.ingredient), nrn: p.nrn.replace('-', '') });
    }
    cache.set(idx, list);
  }
  return list;
}

const active = (p: Product) => (p.status === 'Active' ? 1 : 0);

/**
 * Offline register search by brand, ingredient or a partial NAFDAC number.
 * Every query word must prefix a word of the name (2 points) or the ingredient (1 point);
 * an NRN prefix scores 3. Ranked by score, then active registrations, then name.
 */
export function searchRegister(idx: RegisterIndex, query: string, limit = 20): Product[] {
  const q = tokens(query);
  const compact = q.join('');
  if (compact.length < 3) return [];
  const nrnLike = /^[ABC]?\d/.test(compact);
  const hits: { p: Product; score: number }[] = [];
  for (const e of entries(idx)) {
    let score = nrnLike && e.nrn.startsWith(compact) ? 3 : 0;
    let words = 0;
    for (const t of q) {
      if (e.name.some((w) => w.startsWith(t))) words += 2;
      else if (e.ingredient.some((w) => w.startsWith(t))) words += 1;
      else {
        words = 0;
        break;
      }
    }
    score = Math.max(score, words);
    if (score > 0) hits.push({ p: e.p, score });
  }
  hits.sort((a, b) => b.score - a.score || active(b.p) - active(a.p) || a.p.name.localeCompare(b.p.name) || a.p.nrn.localeCompare(b.p.nrn));
  return hits.slice(0, limit).map((h) => h.p);
}
