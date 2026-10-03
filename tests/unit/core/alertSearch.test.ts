import { filterAlerts } from '../../../src/core/alertSearch';
import { ALERTS } from '../../helpers/fixtures';

const ids = (q: string) => filterAlerts(ALERTS, q).map((a) => a.id);

test('newest first when there is no query', () => {
  expect(ids('')).toEqual(['042/2026', '036/2026', '035/2026', '025/2026']);
});

test('matches title, brand, batch and manufacturer, any case', () => {
  expect(ids('menofix')).toEqual(['035/2026']);
  expect(ids('fx123')).toEqual(['036/2026']);
  expect(ids('bppl artemether')).toEqual(['042/2026']);
  expect(ids('astrazeneca')).toEqual(['036/2026']);
});

test('no match', () => {
  expect(ids('zzzz')).toEqual([]);
});
