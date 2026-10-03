import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = (pad: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#0B6E4F"/>
<g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})">
<rect x="136" y="96" width="240" height="320" rx="36" fill="#F6F9F7"/>
<rect x="176" y="150" width="160" height="22" rx="11" fill="#0B6E4F" opacity=".35"/>
<rect x="176" y="192" width="120" height="22" rx="11" fill="#0B6E4F" opacity=".35"/>
<path d="M190 300l46 46 92-104" fill="none" stroke="#1D8752" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
</g></svg>`;

mkdirSync('public/icons', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
const shots: [string, number, number][] = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['apple-touch-icon.png', 180, 0],
  ['maskable-512.png', 512, 64],
];
for (const [name, size, pad] of shots) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `public/icons/${name}`, clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();
console.log('icons written');
