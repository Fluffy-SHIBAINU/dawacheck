import type { Product } from '../../src/core/types';
import { collapseWs, decodeEntities } from '../../src/core/text';
import { normalizeNrn } from '../../src/core/parse/nrn';

export interface GreenbookRow {
  NAFDAC?: string | null;
  product_name?: string | null;
  ingredient_name?: string | null;
  strength?: string | null;
  form_name?: string | null;
  route_name?: string | null;
  applicant_name?: string | null;
  category_name?: string | null;
  expiry_date?: string | null;
  status?: string | null;
  product_description?: string | null;
  pack_size?: string | null;
  atc?: string | null;
}

const clean = (s?: string | null): string => collapseWs(decodeEntities(s ?? ''));

export function normalizeRecord(r: GreenbookRow): Product | null {
  const nrn = normalizeNrn(r.NAFDAC);
  if (!nrn) return null;
  return {
    nrn,
    nrnRaw: (r.NAFDAC ?? '').trim(),
    name: collapseWs(clean(r.product_name).replace(/[#*]/g, '')),
    ingredient: clean(r.ingredient_name),
    strength: clean(r.strength),
    form: clean(r.form_name),
    route: clean(r.route_name),
    applicant: clean(r.applicant_name),
    category: clean(r.category_name),
    regExpiry: r.expiry_date && /^\d{4}-\d{2}-\d{2}$/.test(r.expiry_date) ? r.expiry_date : null,
    status: clean(r.status) || 'Unknown',
    description: clean(r.product_description),
    packSize: clean(r.pack_size),
    atc: r.atc ? clean(r.atc) : null,
  };
}

export function normalizeAll(rows: GreenbookRow[]): { products: Product[]; dropped: string[] } {
  const products: Product[] = [];
  const dropped: string[] = [];
  for (const r of rows) {
    const p = normalizeRecord(r);
    if (p) products.push(p);
    else dropped.push(String(r.NAFDAC ?? ''));
  }
  return { products, dropped };
}
