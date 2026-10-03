// @vitest-environment node
import { startMock } from '../../scripts/mock-supabase';
import { publishPacks } from '../../scripts/publish-packs';

test('publishes the three pack files to storage', async () => {
  const m = await startMock(0);
  try {
    const done = await publishPacks({ dir: 'public/packs', url: m.url, serviceKey: 'service' });
    expect(done).toEqual(['register.json', 'alerts.json', 'manifest.json']);
    expect(Object.keys(m.state.storage).sort()).toEqual(['alerts.json', 'manifest.json', 'register.json']);
  } finally {
    await m.close();
  }
});
