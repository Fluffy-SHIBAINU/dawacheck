export type Level = 'green' | 'amber' | 'red' | 'unknown';

export type Reason =
  | 'registered'
  | 'name_unconfirmed'
  | 'corrected_number'
  | 'reg_lapsed'
  | 'name_mismatch'
  | 'strength_mismatch'
  | 'alert_product'
  | 'community_flag'
  | 'not_in_register'
  | 'on_alert'
  | 'batch_on_alert'
  | 'pack_expired'
  | 'no_number_found'
  | 'ambiguous_number';

export const RED_REASONS: readonly Reason[] = ['not_in_register', 'on_alert', 'batch_on_alert', 'pack_expired'];
export const AMBER_REASONS: readonly Reason[] = ['reg_lapsed', 'name_mismatch', 'strength_mismatch', 'alert_product', 'community_flag'];

export interface Product {
  nrn: string;
  nrnRaw: string;
  name: string;
  ingredient: string;
  strength: string;
  form: string;
  route: string;
  applicant: string;
  category: string;
  regExpiry: string | null;
  status: string;
  description: string;
  packSize: string;
  atc: string | null;
}

export interface RegisterPack {
  version: string;
  source: string;
  fetchedAt: string;
  products: Product[];
}

export type AlertKind = 'counterfeit' | 'substandard' | 'recall' | 'unregistered' | 'watchlist' | 'other';
export const ALERT_KINDS: readonly AlertKind[] = ['counterfeit', 'substandard', 'recall', 'unregistered', 'watchlist', 'other'];

export interface AlertProduct {
  brand: string | null;
  ingredient: string | null;
  strength: string | null;
  manufacturer: string | null;
  nrn: string | null;
  batches: string[];
}

export interface Alert {
  id: string;
  wpId: number;
  url: string;
  date: string;
  title: string;
  kind: AlertKind;
  products: AlertProduct[];
  summary: string;
  appliesToNigeria: boolean;
}

export interface AlertsPack {
  version: string;
  fetchedAt: string;
  alerts: Alert[];
}

export interface CommunityFlag {
  nrn: string;
  reports: number;
  devices: number;
  states: string[];
  level: 'watch' | 'warning';
  last_report_at: string;
}

export interface Correction {
  read: string;
  corrected: string;
  n: number;
}

export interface Thresholds {
  nameMatch: number;
  nameMismatch: number;
  flagWatchReports: number;
  flagWatchDevices: number;
  flagWarnReports: number;
  flagWarnDevices: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  nameMatch: 0.8,
  nameMismatch: 0.5,
  flagWatchReports: 3,
  flagWatchDevices: 2,
  flagWarnReports: 5,
  flagWarnDevices: 3,
};

export interface PackEntry {
  version: string;
  file: string;
  sha256: string;
  count: number;
  bytes: number;
}

export interface Manifest {
  schema: 1;
  generatedAt: string;
  packs: { register: PackEntry; alerts: PackEntry };
  thresholds: Thresholds;
}

export interface Strength {
  value: number;
  unit: string;
}

export interface Expiry {
  month: number;
  year: number;
}

export interface ScanInput {
  source: 'ocr' | 'manual';
  nrnCandidates: string[];
  text: string;
  strengths: Strength[];
  batch: string | null;
  expiry: Expiry | null;
}

export interface Verdict {
  level: Level;
  reasons: Reason[];
  nrn: string | null;
  product: Product | null;
  products: Product[];
  alert: Alert | null;
  flag: CommunityFlag | null;
  suggestions: Product[];
  correctedFrom: string | null;
  ingredientAlertNote: string | null;
  boxName: string | null;
  boxStrengths: Strength[];
  expiry: Expiry | null;
  batch: string | null;
}

export type ReportReason =
  | 'not_in_register'
  | 'name_mismatch'
  | 'strength_mismatch'
  | 'pack_expired'
  | 'reg_lapsed'
  | 'on_alert'
  | 'batch_on_alert'
  | 'alert_product'
  | 'community_flag'
  | 'looks_different'
  | 'other';

export const REPORT_REASONS: readonly ReportReason[] = [
  'not_in_register', 'name_mismatch', 'strength_mismatch', 'pack_expired', 'reg_lapsed',
  'on_alert', 'batch_on_alert', 'alert_product', 'community_flag', 'looks_different', 'other',
];

export type Lang = 'en' | 'ha' | 'pcm' | 'yo' | 'ig';
export const LANG_CODES: readonly Lang[] = ['en', 'ha', 'pcm', 'yo', 'ig'];
