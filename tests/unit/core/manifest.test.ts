import { compareVersions, validateManifest } from '../../../src/core/manifest';
import { DEFAULT_THRESHOLDS } from '../../../src/core/types';

test('compareVersions orders dates and numeric suffixes', () => {
  expect(compareVersions('2026-10-03', '2026-10-02')).toBeGreaterThan(0);
  expect(compareVersions('2026-10-03', '2026-10-03')).toBe(0);
  expect(compareVersions('2026-10-03-2', '2026-10-03')).toBeGreaterThan(0);
  expect(compareVersions('2026-10-03-10', '2026-10-03-9')).toBeGreaterThan(0);
  expect(compareVersions('2026-09-30-5', '2026-10-01')).toBeLessThan(0);
});

const entry = { version: '2026-10-03', file: 'register.json', sha256: 'a'.repeat(64), count: 1, bytes: 1 };

test('validateManifest accepts a manifest and fills default thresholds', () => {
  const m = validateManifest({ schema: 1, generatedAt: 'x', packs: { register: entry, alerts: { ...entry, file: 'alerts.json' } } });
  expect(m.thresholds).toEqual(DEFAULT_THRESHOLDS);
});

test('validateManifest rejects bad input', () => {
  expect(() => validateManifest(null)).toThrow('invalid manifest');
  expect(() => validateManifest({ schema: 2 })).toThrow('invalid manifest');
});
