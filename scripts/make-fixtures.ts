import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
// A sideways photo of carton 1 (turned 90° clockwise) for the OCR rotation retry test. Not in expected.json:
// the plain OCR fixture test reads upright cartons only.
const upright = (await readFile(`${out}/1.png`)).toString('base64');
const sideways = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.height;
  c.height = img.width;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return c.toDataURL('image/png').split(',')[1];
}, upright);
await writeFile(`${out}/1-rot90.png`, Buffer.from(sideways, 'base64'));
await browser.close();
await writeFile(`${out}/expected.json`, JSON.stringify(CARTONS.map((c) => ({ file: `${c.n}.png`, nrn: c.nrn, level: c.expected, key: c.key })), null, 2));
console.log(`wrote ${CARTONS.length} fixtures to ${out}`);
