import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { env, sleep } from './lib/env';
import { alertIdFromTitle, fallbackAlertFromTitle, htmlToText, normalizeAlert, type AlertMeta } from './lib/alerts';
import { extractAlert } from './lib/extractAlert';
import { fetchViaBrightData } from './lib/brightdata';
import type { Alert, AlertsPack } from '../src/core/types';

const WP = 'https://nafdac.gov.ng/wp-json/wp/v2/posts';

interface WpPost {
  id: number;
  date: string;
  link: string;
  title: { rendered: string };
  content?: { rendered: string };
}

async function listPosts(): Promise<WpPost[]> {
  const out: WpPost[] = [];
  for (let page = 1; page <= 5; page++) {
    const url = `${WP}?search=${encodeURIComponent('Public Alert')}&per_page=100&page=${page}&after=2025-01-01T00:00:00&_fields=id,date,link,title,content`;
    const res = await fetch(url, { headers: { 'User-Agent': 'DawaCheck/0.1 (hackathon)' } });
    if (res.status === 400) break;
    if (!res.ok) throw new Error(`WP HTTP ${res.status}`);
    const batch = (await res.json()) as WpPost[];
    out.push(...batch);
    if (batch.length < 100) break;
    await sleep(1000);
  }
  return out;
}

async function main(): Promise<void> {
  const via = process.argv.find((a) => a.startsWith('--via='))?.split('=')[1] ?? 'wp';
  const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 200);
  const hasClaude = Boolean(env('ANTHROPIC_API_KEY'));
  const posts = (await listPosts()).filter((p) => alertIdFromTitle(htmlToText(p.title.rendered)));
  await mkdir('data/alerts-cache', { recursive: true });
  const alerts: Alert[] = [];
  for (const p of posts.slice(0, limit)) {
    const meta: AlertMeta = { wpId: p.id, url: p.link, date: p.date.slice(0, 10), title: htmlToText(p.title.rendered) };
    const cachePath = `data/alerts-cache/${p.id}.json`;
    if (existsSync(cachePath)) {
      alerts.push(JSON.parse(await readFile(cachePath, 'utf8')) as Alert);
      continue;
    }
    let alert: Alert;
    try {
      let text = htmlToText(p.content?.rendered ?? '');
      if (via === 'brightdata' || text.length < 80) text = htmlToText(await fetchViaBrightData(p.link));
      if (hasClaude) {
        alert = normalizeAlert(await extractAlert(text, meta.title), meta);
        await writeFile(cachePath, JSON.stringify(alert, null, 2));
      } else {
        alert = fallbackAlertFromTitle(meta);
      }
    } catch (e) {
      console.warn(`alert ${p.id}: fallback (${(e as Error).message})`);
      alert = fallbackAlertFromTitle(meta);
    }
    alerts.push(alert);
  }
  alerts.sort((a, b) => b.date.localeCompare(a.date));
  const pack: AlertsPack = { version: new Date().toISOString().slice(0, 10), fetchedAt: new Date().toISOString(), alerts };
  await mkdir('public/packs', { recursive: true });
  await writeFile('public/packs/alerts.json', JSON.stringify(pack, null, 1));
  console.log(`alerts.json: ${alerts.length} alerts (claude: ${hasClaude ? 'yes' : 'no, title fallback'}; via: ${via})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
