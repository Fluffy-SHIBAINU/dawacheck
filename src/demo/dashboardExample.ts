import type { Activity, ByReason, ByState, Flag, Unknown } from '../screens/Dashboard';

/**
 * Shown on the dashboard when no backend is configured. Built from the same fictional seed as the
 * deck screenshot: every NRN here is absent from the NAFDAC register (a unit test checks this).
 */
export const EXAMPLE_DASHBOARD: { a: Activity; s: ByState[]; r: ByReason[]; u: Unknown[]; f: Flag[] } = {
  a: { checks: 140, red: 16, devices: 9, reports: 23 },
  s: [
    { state: 'KN', reports: 9 },
    { state: 'KD', reports: 5 },
    { state: 'LA', reports: 4 },
    { state: 'OY', reports: 3 },
    { state: 'EN', reports: 2 },
  ],
  r: [
    { reason: 'not_in_register', reports: 17 },
    { reason: 'pack_expired', reports: 4 },
    { reason: 'on_alert', reports: 2 },
  ],
  u: [
    { nrn: 'A4-99231', reports: 9, devices: 4 },
    { nrn: 'B4-77120', reports: 5, devices: 4 },
    { nrn: 'A4-90417', reports: 3, devices: 3 },
  ],
  f: [
    { nrn: 'A4-99231', reports: 9, devices: 4, level: 'warning', states: ['KN'] },
    { nrn: 'B4-77120', reports: 5, devices: 4, level: 'warning', states: ['KD'] },
    { nrn: 'C4-55519', reports: 4, devices: 4, level: 'watch', states: ['LA'] },
    { nrn: 'A4-90417', reports: 3, devices: 3, level: 'watch', states: ['OY'] },
  ],
};
