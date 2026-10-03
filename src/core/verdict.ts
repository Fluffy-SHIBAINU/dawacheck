import {
  AMBER_REASONS,
  RED_REASONS,
  type Alert,
  type CommunityFlag,
  type Level,
  type Product,
  type Reason,
  type ScanInput,
  type Thresholds,
  type Verdict,
} from './types';
import type { RegisterIndex } from './registerIndex';
import { nrnVariants, type ConfusionTable } from './confusion';
import { matchAlerts } from './alerts';
import { bestTokenSimilarity, nameTokens, productTokens } from './parse/name';
import { findStrengths, strengthsConflict, strengthsOverlap } from './parse/strength';
import { isExpired } from './parse/expiry';

export interface DecideContext {
  register: RegisterIndex;
  alerts: Alert[];
  flags: Map<string, CommunityFlag>;
  confusion: ConfusionTable;
  today: Date;
  thresholds: Thresholds;
}

export function levelFor(reasons: Reason[]): Level {
  if (reasons.some((r) => RED_REASONS.includes(r))) return 'red';
  if (reasons.some((r) => AMBER_REASONS.includes(r))) return 'amber';
  if (reasons.includes('registered')) return 'green';
  return 'unknown';
}

function nameScore(p: Product, boxTokens: string[]): number {
  return bestTokenSimilarity(productTokens(p.name), boxTokens);
}

// Brand words only (ingredient words removed). A generic name like "Paracetamol" can never confirm a correction.
function brandScore(p: Product, boxTokens: string[]): number {
  const generic = nameTokens(p.ingredient);
  const own = productTokens(p.name).filter((tk) => bestTokenSimilarity([tk], generic) < 0.8);
  return own.length ? bestTokenSimilarity(own, boxTokens) : 0;
}

export function pickRecord(products: Product[], input: ScanInput, boxTokens: string[]): Product {
  const score = (p: Product) =>
    (input.source === 'ocr' ? nameScore(p, boxTokens) : 0) +
    (strengthsOverlap(input.strengths, findStrengths(p.strength)) ? 0.5 : 0) +
    (p.status === 'Active' ? 0.25 : 0);
  return [...products].sort((a, b) => score(b) - score(a))[0];
}

function distinctiveTokens(boxTokens: string[], p: Product, threshold: number): string[] {
  const generic = [...nameTokens(p.ingredient), ...nameTokens(p.applicant)];
  return boxTokens.filter((t) => bestTokenSimilarity([t], generic) < threshold);
}

export function decide(input: ScanInput, ctx: DecideContext): Verdict {
  const t = ctx.thresholds;
  const boxTokens = input.source === 'ocr' ? nameTokens(input.text) : [];
  const reasons: Reason[] = [];
  const v: Verdict = {
    level: 'unknown',
    reasons,
    nrn: null,
    product: null,
    products: [],
    alert: null,
    flag: null,
    suggestions: [],
    correctedFrom: null,
    ingredientAlertNote: null,
    boxName: boxTokens.length ? boxTokens.slice(0, 2).join(' ') : null,
    boxStrengths: input.strengths,
    expiry: input.expiry,
    batch: input.batch,
  };

  // 1. Resolve the number: exact hit first, then guarded fuzzy correction for OCR input.
  let resolved: string | null = input.nrnCandidates.find((c) => ctx.register.byNrn.has(c)) ?? null;
  if (!resolved && input.nrnCandidates.length) {
    const first = input.nrnCandidates[0];
    const variants = nrnVariants(first, ctx.register, ctx.confusion);
    const asProducts = (xs: { nrn: string }[]) => xs.slice(0, 3).map((x) => pickRecord(ctx.register.byNrn.get(x.nrn)!, input, boxTokens));
    v.suggestions = asProducts(variants);
    if (input.source === 'ocr') {
      const named = variants.filter((x) => ctx.register.byNrn.get(x.nrn)!.some((p) => brandScore(p, boxTokens) >= t.nameMatch));
      if (named.length === 1 || (named.length > 1 && named[0].weight >= 2 * named[1].weight)) {
        resolved = named[0].nrn;
        v.correctedFrom = first;
        reasons.push('corrected_number');
        v.suggestions = [];
      } else if (named.length > 1) {
        reasons.push('ambiguous_number');
        v.suggestions = asProducts(named);
      }
    }
  }
  v.nrn = resolved ?? input.nrnCandidates[0] ?? null;
  if (resolved) {
    v.products = ctx.register.byNrn.get(resolved)!;
    v.product = pickRecord(v.products, input, boxTokens);
  }

  // 2. Alerts (run even without a number).
  const am = matchAlerts({
    alerts: ctx.alerts,
    boxTokens,
    product: v.product,
    nrn: resolved,
    batch: input.batch,
    threshold: t.nameMatch,
    generic: ctx.register.generic,
  });
  v.ingredientAlertNote = am.ingredientNote;
  if (am.match) {
    v.alert = am.match.alert;
    if (am.match.batchMatch) reasons.push('batch_on_alert');
    else if (am.match.alert.kind === 'unregistered') reasons.push('on_alert');
    else reasons.push('alert_product');
  }

  // 3. No number at all.
  if (!input.nrnCandidates.length) {
    if (!reasons.some((r) => RED_REASONS.includes(r))) reasons.push('no_number_found');
    v.level = levelFor(reasons);
    return v;
  }
  if (reasons.includes('ambiguous_number')) {
    v.level = levelFor(reasons);
    return v;
  }

  // 4. Not in register.
  if (!resolved) reasons.push('not_in_register');

  // 5. Pack expiry.
  if (input.expiry && isExpired(input.expiry, ctx.today)) reasons.push('pack_expired');

  if (v.product) {
    const p = v.product;
    // 6. Registration status.
    const todayIso = ctx.today.toISOString().slice(0, 10);
    if (p.status !== 'Active' || (p.regExpiry !== null && p.regExpiry < todayIso)) reasons.push('reg_lapsed');

    // 7. Box vs register (OCR only).
    if (input.source === 'ocr') {
      const distinct = distinctiveTokens(boxTokens, p, t.nameMatch);
      if (distinct.length) v.boxName = distinct.slice(0, 2).join(' ');
      if (nameScore(p, boxTokens) < t.nameMatch) {
        const firstDistinct = distinct[0];
        const mismatch =
          boxTokens.length >= 3 && firstDistinct !== undefined && bestTokenSimilarity([firstDistinct], productTokens(p.name)) < t.nameMismatch;
        reasons.push(mismatch ? 'name_mismatch' : 'name_unconfirmed');
      }
      if (strengthsConflict(input.strengths, findStrengths(p.strength))) reasons.push('strength_mismatch');
    } else {
      reasons.push('name_unconfirmed');
    }

    // 8. Community flag.
    const flag = ctx.flags.get(p.nrn);
    if (flag) {
      v.flag = flag;
      reasons.push('community_flag');
    }

    // 9. Registered.
    reasons.push('registered');
  }

  v.level = levelFor(reasons);
  return v;
}
