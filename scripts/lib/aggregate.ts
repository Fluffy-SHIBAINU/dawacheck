import type { CommunityFlag, Correction } from '../../src/core/types';

export interface ServerReport {
  id: string;
  device_id: string;
  created_at: string;
  nrn: string | null;
  reason: string;
  verdict: string;
  state: string | null;
  [k: string]: unknown;
}

export interface ServerEvent {
  id: string;
  device_id: string;
  ts: string;
  type: string;
  props: Record<string, unknown>;
  [k: string]: unknown;
}

const DAY = 86_400_000;
const within = (iso: string, now: Date, days: number) => new Date(iso).getTime() > now.getTime() - days * DAY;

function group<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const arr = m.get(k);
    if (arr) arr.push(x);
    else m.set(k, [x]);
  }
  return m;
}

export function communityFlags(reports: ServerReport[], now: Date): CommunityFlag[] {
  const recent = reports.filter((r) => r.nrn && within(r.created_at, now, 14));
  const out: CommunityFlag[] = [];
  for (const [nrn, rs] of group(recent, (r) => r.nrn!)) {
    const devices = new Set(rs.map((r) => r.device_id)).size;
    if (rs.length < 3 || devices < 2) continue;
    out.push({
      nrn,
      reports: rs.length,
      devices,
      states: [...new Set(rs.map((r) => r.state).filter((s): s is string => Boolean(s)))].sort(),
      level: rs.length >= 5 && devices >= 3 ? 'warning' : 'watch',
      last_report_at: rs.map((r) => r.created_at).sort().at(-1)!,
    });
  }
  return out;
}

export function nrnCorrections(events: ServerEvent[], now: Date): Correction[] {
  const ok = events.filter((e) => e.type === 'nrn_corrected' && within(e.ts, now, 90) && e.props.read && e.props.corrected);
  return [...group(ok, (e) => `${e.props.read}|${e.props.corrected}`).values()].map((es) => ({
    read: String(es[0].props.read),
    corrected: String(es[0].props.corrected),
    n: es.length,
  }));
}

export function dashActivity(events: ServerEvent[], reports: ServerReport[], now: Date) {
  const recent = events.filter((e) => within(e.ts, now, 7));
  const shown = recent.filter((e) => e.type === 'verdict_shown');
  return [
    {
      checks: shown.length,
      red: shown.filter((e) => e.props.level === 'red').length,
      devices: new Set(recent.map((e) => e.device_id)).size,
      reports: reports.filter((r) => within(r.created_at, now, 7)).length,
    },
  ];
}

const counted = <K extends string>(m: Map<string, unknown[]>, key: K) =>
  [...m.entries()].map(([k, v]) => ({ [key]: k, reports: v.length }) as Record<K, string> & { reports: number }).sort((a, b) => b.reports - a.reports);

export function dashByState(reports: ServerReport[], now: Date) {
  return counted(group(reports.filter((r) => within(r.created_at, now, 7)), (r) => r.state ?? '??'), 'state');
}

export function dashByReason(reports: ServerReport[], now: Date) {
  return counted(group(reports.filter((r) => within(r.created_at, now, 7)), (r) => r.reason), 'reason');
}

export function dashUnknown(reports: ServerReport[]) {
  const unknown = reports.filter((r) => r.reason === 'not_in_register' && r.nrn);
  return [...group(unknown, (r) => r.nrn!).entries()]
    .filter(([, rs]) => rs.length >= 2)
    .map(([nrn, rs]) => ({ nrn, reports: rs.length, devices: new Set(rs.map((r) => r.device_id)).size, last_report_at: rs.map((r) => r.created_at).sort().at(-1)! }))
    .sort((a, b) => b.reports - a.reports);
}
