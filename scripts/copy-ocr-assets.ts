import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dest = 'public/tesseract';
mkdirSync(`${dest}/lang`, { recursive: true });

const worker = 'node_modules/tesseract.js/dist/worker.min.js';
if (!existsSync(worker)) throw new Error(`missing ${worker}`);
cpSync(worker, `${dest}/worker.min.js`);

const coreDir = 'node_modules/tesseract.js-core';
// The worker only loads *.wasm.js builds; the app picks SIMD or plain LSTM itself (see src/ocr/engine.ts).
const cores = readdirSync(coreDir).filter((f) => f === 'tesseract-core-simd-lstm.wasm.js' || f === 'tesseract-core-lstm.wasm.js');
if (!cores.length) throw new Error('no LSTM core files found in tesseract.js-core');
for (const f of cores) cpSync(join(coreDir, f), join(dest, f));

function find(dir: string, name: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...find(p, name));
    else if (e === name) out.push(p);
  }
  return out;
}
const langs = find('node_modules/@tesseract.js-data/eng', 'eng.traineddata.gz');
const lang = langs.find((p) => p.includes('best_int')) ?? langs[0];
if (!lang) throw new Error('eng.traineddata.gz not found under @tesseract.js-data/eng');
cpSync(lang, `${dest}/lang/eng.traineddata.gz`);

const size = (p: string) => `${(statSync(p).size / 1e6).toFixed(1)} MB`;
console.log(`OCR assets: worker ${size(`${dest}/worker.min.js`)}, cores ${cores.join(', ')}, lang ${size(`${dest}/lang/eng.traineddata.gz`)} (${lang})`);
