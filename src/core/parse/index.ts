import type { ScanInput } from '../types';
import { findNrnCandidates, manualCandidates } from './nrn';
import { findStrengths } from './strength';
import { findBatch } from './batch';
import { findExpiry } from './expiry';

export function parseScan(text: string): ScanInput {
  return {
    source: 'ocr',
    nrnCandidates: findNrnCandidates(text).map((c) => c.nrn),
    text,
    strengths: findStrengths(text),
    batch: findBatch(text),
    expiry: findExpiry(text),
  };
}

export function manualInput(raw: string): ScanInput | null {
  const nrnCandidates = manualCandidates(raw);
  if (!nrnCandidates.length) return null;
  return { source: 'manual', nrnCandidates, text: '', strengths: [], batch: null, expiry: null };
}
