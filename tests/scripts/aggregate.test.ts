import { communityFlags, dashActivity, dashByReason, dashByState, dashUnknown, nrnCorrections, type ServerEvent, type ServerReport } from '../../scripts/lib/aggregate';

const now = new Date('2026-10-03T12:00:00Z');
const r = (nrn: string | null, device: string, state: string | null, reason = 'name_mismatch', daysAgo = 1): ServerReport => ({
  id: `${nrn}-${device}-${Math.random()}`,
  device_id: device,
  created_at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  nrn,
  reason,
  verdict: 'amber',
  state,
});

test('community flags need 3 reports from 2 phones within 14 days', () => {
  const reports = [r('A4-6238', 'd1', 'KN'), r('A4-6238', 'd1', 'KN'), r('A4-6238', 'd2', 'KD'), r('B4-1', 'd1', null), r('B4-1', 'd1', null), r('B4-1', 'd1', null), r('C4-9', 'd1', 'KN', 'other', 20), r('C4-9', 'd2', 'KN', 'other', 20), r('C4-9', 'd3', 'KN', 'other', 20)];
  const flags = communityFlags(reports, now);
  expect(flags).toHaveLength(1);
  expect(flags[0]).toMatchObject({ nrn: 'A4-6238', reports: 3, devices: 2, states: ['KD', 'KN'], level: 'watch' });
});

test('5 reports from 3 phones escalate to warning', () => {
  const reports = ['d1', 'd2', 'd3', 'd1', 'd2'].map((d) => r('A4-6238', d, 'KN'));
  expect(communityFlags(reports, now)[0].level).toBe('warning');
});

test('corrections are grouped from nrn_corrected events', () => {
  const ev = (read: string, corrected: string): ServerEvent => ({ id: Math.random().toString(), device_id: 'd', ts: now.toISOString(), type: 'nrn_corrected', props: { read, corrected } });
  expect(nrnCorrections([ev('A4-6239', 'A4-6238'), ev('A4-6239', 'A4-6238'), { ...ev('x', 'y'), type: 'app_open' }], now)).toEqual([{ read: 'A4-6239', corrected: 'A4-6238', n: 2 }]);
});

test('dashboard aggregates', () => {
  const reports = [r('A', 'd1', 'KN', 'not_in_register'), r('A', 'd2', 'KN', 'not_in_register'), r('B', 'd1', 'LA', 'pack_expired')];
  const events: ServerEvent[] = [
    { id: '1', device_id: 'd1', ts: now.toISOString(), type: 'verdict_shown', props: { level: 'red' } },
    { id: '2', device_id: 'd2', ts: now.toISOString(), type: 'verdict_shown', props: { level: 'green' } },
  ];
  expect(dashActivity(events, reports, now)).toEqual([{ checks: 2, red: 1, devices: 2, reports: 3 }]);
  expect(dashByState(reports, now)).toEqual([{ state: 'KN', reports: 2 }, { state: 'LA', reports: 1 }]);
  expect(dashByReason(reports, now)[0]).toEqual({ reason: 'not_in_register', reports: 2 });
  expect(dashUnknown(reports)).toEqual([expect.objectContaining({ nrn: 'A', reports: 2, devices: 2 })]);
});
