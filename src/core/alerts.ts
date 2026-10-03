import type { Alert, AlertProduct, Product } from './types';
import { bestTokenSimilarity, nameTokens, productTokens } from './parse/name';

export interface AlertMatch {
  alert: Alert;
  product: AlertProduct;
  batchMatch: boolean;
}

function rank(m: AlertMatch): number {
  return (m.batchMatch ? 3 : m.alert.kind === 'unregistered' ? 2 : 1) * 1e9 + Number(m.alert.date.replace(/-/g, ''));
}

// A brand matches only on its distinctive words: ingredient words (from the alert, the scanned
// product, or anywhere in the register) never count, so "Artemether" alone cannot trigger an alert.
function brandHit(ap: AlertProduct, hay: string[], threshold: number, generic: Set<string>, extraGeneric: string[]): boolean {
  if (!ap.brand) return false;
  const localGeneric = [...(ap.ingredient ? nameTokens(ap.ingredient) : []), ...extraGeneric];
  const distinctive = nameTokens(ap.brand).filter((t) => !generic.has(t) && bestTokenSimilarity([t], localGeneric) < threshold);
  if (!distinctive.length) return false;
  const hits = distinctive.filter((t) => bestTokenSimilarity([t], hay) >= threshold).length;
  return hits >= 1 && hits / distinctive.length >= 0.5;
}

export function matchAlerts(args: {
  alerts: Alert[];
  boxTokens: string[];
  product: Product | null;
  nrn: string | null;
  batch: string | null;
  threshold: number;
  generic?: Set<string>;
}): { match: AlertMatch | null; ingredientNote: string | null } {
  const generic = args.generic ?? new Set<string>();
  const hay = [...args.boxTokens, ...(args.product ? productTokens(args.product.name) : [])];
  const productIngredient = args.product ? nameTokens(args.product.ingredient) : [];
  const batch = args.batch ? args.batch.toUpperCase() : null;
  let best: AlertMatch | null = null;
  let ingredientNote: string | null = null;
  for (const alert of args.alerts) {
    if (!alert.appliesToNigeria) continue;
    for (const ap of alert.products) {
      const nrnHit = Boolean(ap.nrn && args.nrn && ap.nrn === args.nrn);
      if (nrnHit || brandHit(ap, hay, args.threshold, generic, productIngredient)) {
        const m: AlertMatch = { alert, product: ap, batchMatch: Boolean(batch && ap.batches.includes(batch)) };
        if (!best || rank(m) > rank(best)) best = m;
      } else if (!ingredientNote && ap.ingredient && productIngredient.length) {
        const alertIngredient = nameTokens(ap.ingredient);
        const shared = alertIngredient.length > 0 && alertIngredient.every((t) => bestTokenSimilarity([t], productIngredient) >= args.threshold);
        if (shared) ingredientNote = ap.ingredient;
      }
    }
  }
  return { match: best, ingredientNote };
}
