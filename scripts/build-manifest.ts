import { readFile, writeFile } from 'node:fs/promises';
import { sha256Hex } from '../src/core/sha';
import { DEFAULT_THRESHOLDS, type AlertsPack, type Manifest, type PackEntry, type RegisterPack } from '../src/core/types';

const dir = process.argv.find((a) => a.startsWith('--dir='))?.split('=')[1] ?? 'public/packs';

async function entry<T extends { version: string }>(file: string, count: (j: T) => number): Promise<PackEntry> {
  const text = await readFile(`${dir}/${file}`, 'utf8');
  const json = JSON.parse(text) as T;
  return { version: json.version, file, sha256: await sha256Hex(text), count: count(json), bytes: Buffer.byteLength(text) };
}

const manifest: Manifest = {
  schema: 1,
  generatedAt: new Date().toISOString(),
  packs: {
    register: await entry<RegisterPack>('register.json', (j) => j.products.length),
    alerts: await entry<AlertsPack>('alerts.json', (j) => j.alerts.length),
  },
  thresholds: DEFAULT_THRESHOLDS,
};
await writeFile(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`manifest.json (${dir}): register ${manifest.packs.register.count} (${manifest.packs.register.version}), alerts ${manifest.packs.alerts.count}`);
