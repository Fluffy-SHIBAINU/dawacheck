import { DawaDB } from '../../../src/data/db';
import { DEFAULT_SETTINGS, getDeviceId, getSettings, saveSettings, uuid } from '../../../src/data/meta';

const fresh = () => new DawaDB(`t-${Math.random()}`);

test('settings default, then merge saved patches', async () => {
  const d = fresh();
  expect(await getSettings(d)).toEqual(DEFAULT_SETTINGS);
  await saveSettings({ lang: 'ha' }, d);
  await saveSettings({ consent: true }, d);
  expect(await getSettings(d)).toEqual({ ...DEFAULT_SETTINGS, lang: 'ha', consent: true });
});

test('device id is created once and then stable', async () => {
  const d = fresh();
  const a = await getDeviceId(d);
  expect(a).toMatch(/^[0-9a-f-]{36}$/);
  expect(await getDeviceId(d)).toBe(a);
});

test('uuid looks like a v4 uuid', () => {
  expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
