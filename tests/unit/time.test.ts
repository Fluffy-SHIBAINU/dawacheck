import { formatDate, formatExpiry, timeAgo } from '../../src/lib/time';

test('formats dates for people', () => {
  expect(formatExpiry({ month: 3, year: 2028 })).toBe('03/2028');
  expect(formatExpiry(null)).toBe('');
  expect(formatDate('2026-12-01')).toBe('1 Dec 2026');
  expect(formatDate(null)).toBe('');
  const now = new Date('2026-10-03T12:00:00Z');
  expect(timeAgo('2026-10-03T11:59:30Z', now)).toBe('just now');
  expect(timeAgo('2026-10-03T11:15:00Z', now)).toBe('45 min ago');
  expect(timeAgo('2026-10-03T09:00:00Z', now)).toBe('3 h ago');
  expect(timeAgo('2026-10-01T12:00:00Z', now)).toBe('2 d ago');
});
