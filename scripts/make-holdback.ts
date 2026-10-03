import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { RegisterPack } from '../src/core/types';

const n = Number(process.argv.find((a) => a.startsWith('--n='))?.split('=')[1] ?? 12);
const full = JSON.parse(readFileSync('public/packs/register.json', 'utf8')) as RegisterPack;
const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

mkdirSync('data/packs', { recursive: true });
writeFileSync('data/packs/register.json', JSON.stringify({ ...full, version: today }));
copyFileSync('public/packs/alerts.json', 'data/packs/alerts.json');

const held: RegisterPack = { ...full, version: yesterday, products: full.products.slice(0, full.products.length - n) };
writeFileSync('public/packs/register.json', JSON.stringify(held));

execSync('npx tsx scripts/build-manifest.ts --dir=data/packs', { stdio: 'inherit' });
execSync('npx tsx scripts/build-manifest.ts --dir=public/packs', { stdio: 'inherit' });
console.log(`bundled register: ${held.products.length} products (${yesterday}); update pack: ${full.products.length} (${today})`);
