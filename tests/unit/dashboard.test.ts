import { barWidths } from '../../src/screens/Dashboard';

test('bar widths scale to the largest value', () => {
  expect(barWidths([{ reports: 96 }, { reports: 48 }, { reports: 0 }])).toEqual([100, 50, 0]);
  expect(barWidths([])).toEqual([]);
});
