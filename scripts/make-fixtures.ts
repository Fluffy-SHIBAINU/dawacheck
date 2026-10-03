import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { CARTONS, cartonHtml } from '../src/demo/cartons';

const out = 'tests/fixtures/labels';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });
for (const c of CARTONS) {
  await page.setContent(`<html><body style="margin:0;padding:30px;background:#E9ECEA">${cartonHtml(c)}</body></html>`);
  await page.locator('.carton').screenshot({ path: `${out}/${c.n}.png` });
}
await browser.close();
await writeFile(`${out}/expected.json`, JSON.stringify(CARTONS.map((c) => ({ file: `${c.n}.png`, nrn: c.nrn, level: c.expected, key: c.key })), null, 2));
console.log(`wrote ${CARTONS.length} fixtures to ${out}`);
