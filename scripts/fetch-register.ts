import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { sleep } from './lib/env';
import { normalizeAll, type GreenbookRow } from './lib/normalizeRegister';
import type { RegisterPack } from '../src/core/types';

const BASE = 'https://greenbook.nafdac.gov.ng/';
const PAGE = 1000;

async function fetchPage(start: number): Promise<{ recordsTotal: number; data: GreenbookRow[] }> {
  const url = `${BASE}?draw=1&start=${start}&length=${PAGE}&search_ingredient=`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json',
          'User-Agent': 'DawaCheck/0.1 (World Bank Small AI hackathon; offline medicine checker)',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { recordsTotal: number; data: GreenbookRow[] };
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(2000 * attempt);
    }
  }
  throw new Error('unreachable');
}

async function main(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const rawPath = `data/raw/greenbook-${today}.json`;
  let rows: GreenbookRow[];
  if (process.argv.includes('--from-cache')) {
    rows = JSON.parse(await readFile(rawPath, 'utf8')) as GreenbookRow[];
  } else {
    rows = [];
    let total = Infinity;
    for (let start = 0; start < total; start += PAGE) {
      const page = await fetchPage(start);
      total = page.recordsTotal;
      rows.push(...page.data);
      console.log(`fetched ${rows.length}/${total}`);
      if (page.data.length === 0) break;
      await sleep(1000);
    }
    await mkdir('data/raw', { recursive: true });
    await writeFile(rawPath, JSON.stringify(rows));
  }
  const { products, dropped } = normalizeAll(rows);
  const pack: RegisterPack = { version: today, source: 'NAFDAC Greenbook', fetchedAt: new Date().toISOString(), products };
  await mkdir('public/packs', { recursive: true });
  await writeFile('public/packs/register.json', JSON.stringify(pack));
  console.log(`register.json: ${products.length} products, dropped ${dropped.length} without a valid NRN: ${dropped.slice(0, 12).join(' | ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
