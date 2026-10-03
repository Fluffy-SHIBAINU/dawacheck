import type { Product, RegisterPack } from './types';
import { nameTokens } from './parse/name';

export interface RegisterIndex {
  byNrn: Map<string, Product[]>;
  size: number;
  version: string;
  /** Every ingredient word in the register (e.g. ARTEMETHER). Used to ignore generic words when matching brands. */
  generic: Set<string>;
}

export function buildRegisterIndex(pack: RegisterPack): RegisterIndex {
  const byNrn = new Map<string, Product[]>();
  const generic = new Set<string>();
  for (const p of pack.products) {
    const arr = byNrn.get(p.nrn);
    if (arr) arr.push(p);
    else byNrn.set(p.nrn, [p]);
    for (const w of nameTokens(p.ingredient)) generic.add(w);
  }
  return { byNrn, size: pack.products.length, version: pack.version, generic };
}

export function lookup(idx: RegisterIndex, nrn: string): Product[] {
  return idx.byNrn.get(nrn) ?? [];
}
