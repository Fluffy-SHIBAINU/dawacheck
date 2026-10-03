import {
  alertIdFromTitle,
  appliesToNigeriaFromTitle,
  brandFromTitle,
  fallbackAlertFromTitle,
  htmlToText,
  kindFromText,
  normalizeAlert,
} from '../../scripts/lib/alerts';

const T35 = 'Public Alert No. 035/2026 – Alert on the Marketing and Sale of Unregistered Menofix Composition';
const T36 = 'Public Alert No. 036/2026 Alert on Suspected Counterfeit Products Mimicking Forxiga® (dapagliflozin)';
const T42 = 'Public Alert No. 042/2026-Alert on the Seizure of Suspected Substandard and Falsified BPPL Artemether/Lumefantrine 80mg/480mg';
const T25 = 'Public Alert No. 025/2026 -Alert on the Recall Specific Batches of Antacid (Citro-Soda regular) in South Africa';
const T9 = 'Public Alert No. 09/2026 - Public Reminder of NAFDAC’s Regulatory Directive';

test('alertIdFromTitle pads the number', () => {
  expect(alertIdFromTitle(T35)).toBe('035/2026');
  expect(alertIdFromTitle(T9)).toBe('009/2026');
  expect(alertIdFromTitle('NAFDAC news item')).toBeNull();
});

test('htmlToText strips tags and decodes entities', () => {
  expect(htmlToText('<p>Batch&nbsp;No: <strong>AB123</strong></p><p>Mfg &#8211; 2025</p>')).toBe('Batch No: AB123\nMfg – 2025');
});

test('kindFromText', () => {
  expect(kindFromText(T35)).toBe('unregistered');
  expect(kindFromText(T36)).toBe('counterfeit');
  expect(kindFromText(T42)).toBe('counterfeit');
  expect(kindFromText(T25)).toBe('recall');
  expect(kindFromText('Alert on adulterated syrup')).toBe('substandard');
  expect(kindFromText('Products placed on watchlist')).toBe('watchlist');
  expect(kindFromText('General notice')).toBe('other');
});

test('brandFromTitle strips alert phrasing', () => {
  expect(brandFromTitle(T35)).toBe('Menofix Composition');
  expect(brandFromTitle(T36)).toMatch(/^Forxiga/);
  expect(brandFromTitle(T42)).toBe('BPPL Artemether/Lumefantrine 80mg/480mg');
  expect(brandFromTitle(T25)).toBe('Antacid');
});

test('appliesToNigeriaFromTitle is false for foreign recalls only', () => {
  expect(appliesToNigeriaFromTitle(T25)).toBe(false);
  expect(appliesToNigeriaFromTitle(T35)).toBe(true);
});

test('fallbackAlertFromTitle builds a usable alert', () => {
  const a = fallbackAlertFromTitle({ wpId: 1, url: 'https://x', date: '2026-07-01', title: T35 });
  expect(a).toMatchObject({ id: '035/2026', kind: 'unregistered', appliesToNigeria: true });
  expect(a.products[0]).toEqual({ brand: 'Menofix Composition', ingredient: null, strength: null, manufacturer: null, nrn: null, batches: [] });
});

test('normalizeAlert cleans extracted output', () => {
  const a = normalizeAlert(
    {
      kind: 'counterfeit',
      summary: 'x'.repeat(400),
      appliesToNigeria: true,
      products: [{ brand: ' Forxiga ', ingredient: 'dapagliflozin', strength: '10 mg', manufacturer: null, nrn: 'b4 - 1234', batches: ['ab 12', 'cd34'] }],
    },
    { wpId: 2, url: 'https://y', date: '2026-08-01', title: T36 },
  );
  expect(a.id).toBe('036/2026');
  expect(a.summary.length).toBe(280);
  expect(a.products[0]).toEqual({ brand: 'Forxiga', ingredient: 'dapagliflozin', strength: '10 mg', manufacturer: null, nrn: 'B4-1234', batches: ['AB12', 'CD34'] });
});

test('normalizeAlert falls back to the title brand when no products were extracted', () => {
  const a = normalizeAlert({ kind: 'unregistered', summary: 's', appliesToNigeria: true, products: [] }, { wpId: 3, url: 'u', date: '2026-07-01', title: T35 });
  expect(a.products[0].brand).toBe('Menofix Composition');
});
