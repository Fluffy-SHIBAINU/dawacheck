import { matchAlerts } from '../../../src/core/alerts';
import { nameTokens } from '../../../src/core/parse/name';
import { ALERTS, ARTHEGET, FORX } from '../../helpers/fixtures';
import type { Alert } from '../../../src/core/types';

const base = { alerts: ALERTS, threshold: 0.8, nrn: null, batch: null, product: null };

test('brand match on box text without batch', () => {
  const r = matchAlerts({ ...base, boxTokens: nameTokens('FORXIGA 10 mg'), product: FORX, nrn: FORX.nrn });
  expect(r.match?.alert.id).toBe('036/2026');
  expect(r.match?.batchMatch).toBe(false);
});

test('brand match with a named batch', () => {
  const r = matchAlerts({ ...base, boxTokens: nameTokens('FORXIGA'), batch: 'fx123' });
  expect(r.match?.batchMatch).toBe(true);
});

test('unregistered product matched by name alone', () => {
  const r = matchAlerts({ ...base, boxTokens: nameTokens('MENOFIX COMPOSITION herbal mixture') });
  expect(r.match?.alert.kind).toBe('unregistered');
});

test('half of a multi-word brand is enough', () => {
  const r = matchAlerts({ ...base, boxTokens: nameTokens('MENOFIX') });
  expect(r.match?.alert.id).toBe('035/2026');
});

test('ingredient-only overlap gives a note, not a match', () => {
  const r = matchAlerts({ ...base, boxTokens: nameTokens('ARTHEGET EZ Artemether Lumefantrine'), product: ARTHEGET, nrn: ARTHEGET.nrn });
  expect(r.match).toBeNull();
  expect(r.ingredientNote).toBe('Artemether/Lumefantrine');
});

test('title-only alerts: generic register words never count as brand words', () => {
  const titleOnly: Alert = { ...ALERTS[2], products: [{ brand: 'BPPL Artemether/Lumefantrine 80mg/480mg', ingredient: null, strength: null, manufacturer: null, nrn: null, batches: [] }] };
  const generic = new Set(['ARTEMETHER', 'LUMEFANTRINE']);
  expect(matchAlerts({ ...base, alerts: [titleOnly], boxTokens: nameTokens('ARTEMETHER LUMEFANTRINE tablets'), generic }).match).toBeNull();
  expect(matchAlerts({ ...base, alerts: [titleOnly], boxTokens: nameTokens('BPPL ARTEMETHER LUMEFANTRINE'), generic }).match?.alert.id).toBe('042/2026');
});

test('foreign-only alerts are ignored', () => {
  const r = matchAlerts({ ...base, boxTokens: nameTokens('CITRO SODA'), batch: 'CS1' });
  expect(r.match).toBeNull();
});

test('nrn stated in an alert matches directly', () => {
  const alerts = [{ ...ALERTS[0], products: [{ ...ALERTS[0].products[0], brand: null, nrn: 'B4-3030' }] }];
  const r = matchAlerts({ ...base, alerts, boxTokens: [], nrn: 'B4-3030' });
  expect(r.match?.alert.id).toBe('036/2026');
});
