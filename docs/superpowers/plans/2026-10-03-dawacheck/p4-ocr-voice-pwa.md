# Phase 4: OCR, voice, offline

Read the plan index Global Constraints first. Spec reference: §7 (scan pipeline), §12 (voice), §14 (demo packs), §16 (testing), §17 (deploy notes).

---

### Task 16: Demo cartons page and OCR fixture images

**Files:**
- Create: `src/demo/cartons.ts`, `src/screens/DemoPacks.tsx`, `scripts/make-fixtures.ts`
- Modify: `src/App.tsx` (route `/demo-packs`; the Gate lets `/demo-packs` and `/dashboard` through without onboarding)
- Create (generated, committed): `tests/fixtures/labels/{1..5}.png`, `tests/fixtures/labels/expected.json`
- Test: `tests/unit/demo.test.ts`

**Interfaces:**
- Consumes: `parseScan`, `decide` (Phase 2), fixtures `DEMO_TEXT` (Task 6).
- Produces: `interface Carton { n: number; key: 'green' | 'mismatch' | 'notfound' | 'expired' | 'alert'; brand: string; lines: string[]; nrn: string; batch: string; exp: string; expected: Level; accent: string }`, `CARTONS: Carton[]`, `cartonText(c: Carton): string`, `cartonHtml(c: Carton): string`; route `/demo-packs` (all cartons) and `/demo-packs?fixture=N` (one carton).

- [ ] **Step 1: Write the failing test** `tests/unit/demo.test.ts`

```ts
import { CARTONS, cartonHtml, cartonText } from '../../src/demo/cartons';
import { decide } from '../../src/core/verdict';
import { parseScan } from '../../src/core/parse';
import { buildRegisterIndex } from '../../src/core/registerIndex';
import { buildConfusion } from '../../src/core/confusion';
import { DEFAULT_THRESHOLDS } from '../../src/core/types';
import { ALERTS, DEMO_TEXT, REGISTER, TODAY } from '../helpers/fixtures';

const ctx = { register: buildRegisterIndex(REGISTER), alerts: ALERTS, flags: new Map(), confusion: buildConfusion([]), today: TODAY, thresholds: DEFAULT_THRESHOLDS };

test('five cartons whose text equals the engine fixtures', () => {
  expect(CARTONS.map((c) => c.n)).toEqual([1, 2, 3, 4, 5]);
  for (const c of CARTONS) expect(cartonText(c)).toBe(DEMO_TEXT[c.key]);
});

test.each(CARTONS.map((c) => [c.n, c] as const))('carton %i gives its expected verdict', (_n, c) => {
  expect(decide(parseScan(cartonText(c)), ctx).level).toBe(c.expected);
});

test('carton html carries the number and a demo marker', () => {
  const html = cartonHtml(CARTONS[0]);
  expect(html).toContain('A4-6238');
  expect(html).toContain('DEMO PACK');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/demo.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/demo/cartons.ts`:
```ts
import type { Level } from '../core/types';

export interface Carton {
  n: number;
  key: 'green' | 'mismatch' | 'notfound' | 'expired' | 'alert';
  brand: string;
  lines: string[];
  nrn: string;
  batch: string;
  exp: string;
  expected: Level;
  accent: string;
}

export const CARTONS: Carton[] = [
  { n: 1, key: 'green', brand: 'ARTHEGET EZ', lines: ['Artemether 80 mg + Lumefantrine 480 mg', '6 tablets'], nrn: 'A4-6238', batch: 'AE2511', exp: '11/2027', expected: 'green', accent: '#7A1F1F' },
  { n: 2, key: 'mismatch', brand: 'MALAQUICK', lines: ['Artemether 20 mg + Lumefantrine 120 mg'], nrn: 'A4-6238', batch: 'MQ0925', exp: '09/2027', expected: 'amber', accent: '#1F4E7A' },
  { n: 3, key: 'notfound', brand: 'PARAMAX FORTE', lines: ['Paracetamol 500 mg'], nrn: 'A4-99231', batch: 'PX7731', exp: '03/2028', expected: 'red', accent: '#5B2B82' },
  { n: 4, key: 'expired', brand: 'ARTHEGET EZ', lines: ['Artemether 80 mg + Lumefantrine 480 mg'], nrn: 'A4-6238', batch: 'AE2402', exp: '08/2026', expected: 'red', accent: '#7A1F1F' },
  { n: 5, key: 'alert', brand: 'MENOFIX COMPOSITION', lines: ['Herbal mixture'], nrn: 'A4-0999', batch: 'MF0101', exp: '12/2027', expected: 'red', accent: '#2B6B3F' },
];

export function cartonText(c: Carton): string {
  return [c.brand, ...c.lines, `NAFDAC REG. NO. ${c.nrn}`, `BATCH ${c.batch} EXP ${c.exp}`, 'DEMO PACK'].join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function cartonHtml(c: Carton): string {
  return `<div class="carton" data-carton="${c.n}" style="width:720px;padding:36px 40px;background:#FFFDF6;color:#111;border:2px solid #ddd;border-radius:6px;font-family:Arial,Helvetica,sans-serif;display:flex;flex-direction:column;gap:14px">
  <div style="font-weight:800;font-size:56px;letter-spacing:1px;color:${c.accent}">${esc(c.brand)}</div>
  ${c.lines.map((l) => `<div style="font-size:30px">${esc(l)}</div>`).join('')}
  <div style="font-size:34px;font-weight:700;font-family:'Courier New',monospace">NAFDAC REG. NO. ${esc(c.nrn)}</div>
  <div style="font-size:30px;font-family:'Courier New',monospace">BATCH ${esc(c.batch)} EXP ${esc(c.exp)}</div>
  <div style="font-size:18px;color:#666">DEMO PACK</div>
</div>`;
}
```

`src/screens/DemoPacks.tsx`:
```tsx
import { useSearchParams } from 'react-router-dom';
import { CARTONS, cartonHtml } from '../demo/cartons';

export function DemoPacks() {
  const [params] = useSearchParams();
  const only = Number(params.get('fixture') ?? 0);
  const list = only ? CARTONS.filter((c) => c.n === only) : CARTONS;
  return (
    <div style={{ background: '#E9ECEA', minHeight: '100%', padding: 24, display: 'flex', flexWrap: 'wrap', gap: 24 }}>
      {list.map((c) => (
        <figure key={c.n} style={{ margin: 0 }}>
          <div dangerouslySetInnerHTML={{ __html: cartonHtml(c) }} />
          {!only && <figcaption style={{ fontFamily: 'Arial', marginTop: 8 }}>Carton {c.n}: expected {c.expected}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
```

Modify `src/App.tsx`:
- import `DemoPacks` and add `<Route path="/demo-packs" element={<DemoPacks />} />` before `*`.
- In `Gate`, change the onboarding redirect line to:
```tsx
const open = location.pathname.startsWith('/demo-packs') || location.pathname.startsWith('/dashboard');
if (!settings.onboarded && !open && location.pathname !== '/welcome') return <Navigate to="/welcome" replace />;
```

`scripts/make-fixtures.ts`:
```ts
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
```

- [ ] **Step 4: Generate fixtures and test**

```bash
npm pkg set scripts.fixtures="tsx scripts/make-fixtures.ts"
npm run fixtures
npx vitest run tests/unit/demo.test.ts && npm run typecheck
```
Expected: 5 PNGs plus expected.json, tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: demo cartons page and OCR fixture images"
```

---

### Task 17: On-device OCR and the Scan screen

**Files:**
- Create: `scripts/copy-ocr-assets.ts`, `src/ocr/engine.ts`, `src/ocr/preprocess.ts`, `src/ocr/scan.ts`, `src/components/CropBox.tsx`, `src/screens/Scan.tsx`, `vitest.ocr.config.ts`
- Modify: `src/App.tsx` (route `/scan`), `src/screens/TypeNumber.tsx` (log OCR corrections), `src/screens/Result.tsx` (link "Type the number instead" for OCR checks), `package.json` scripts
- Test: `tests/ocr/fixtures.test.ts`, `tests/e2e/scan.spec.ts`

**Interfaces:**
- Consumes: `parseScan` (Task 8), `pendingScan` (Task 14), `useApp().check` (Task 14), fixtures (Task 16).
- Produces: `recognize(image: HTMLCanvasElement | Blob | string, mode: 'sparse' | 'line', onProgress?: (p: number) => void): Promise<{ text: string; confidence: number; ms: number }>`; `interface Crop { x: number; y: number; w: number; h: number }` (fractions 0..1); `runScan(file: Blob, opts?: { onProgress?: (p: number) => void; crop?: Crop; previousText?: string }): Promise<ScanResult>` where `ScanResult = { input: ScanInput; text: string; ms: number; pass: 1 | 2 | 3; thumb: Blob | null; confidence: number }`; route `/scan`; TypeNumber accepts router state `{ read?: string }`.

- [ ] **Step 1: Install and copy OCR assets**

```bash
npm i tesseract.js
npm i -D @tesseract.js-data/eng
```

`scripts/copy-ocr-assets.ts`:
```ts
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dest = 'public/tesseract';
mkdirSync(`${dest}/lang`, { recursive: true });

const worker = 'node_modules/tesseract.js/dist/worker.min.js';
if (!existsSync(worker)) throw new Error(`missing ${worker}`);
cpSync(worker, `${dest}/worker.min.js`);

const coreDir = 'node_modules/tesseract.js-core';
const cores = readdirSync(coreDir).filter((f) => /^tesseract-core.*lstm.*\.(js|wasm)$/.test(f));
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
```

```bash
npm pkg set scripts.assets="tsx scripts/copy-ocr-assets.ts"
npm pkg set scripts.dev="npm run assets && vite" scripts.build="npm run assets && tsc --noEmit && vite build" scripts.build:e2e="npm run assets && vite build --mode e2e --outDir dist-e2e"
npm run assets
```
Expected: a size line. The total under `public/tesseract` should be about 10 MB or less. If `tesseract.js-core` sits nested under `node_modules/tesseract.js/node_modules/`, update `coreDir`.

- [ ] **Step 2: Write the failing OCR integration test**

`vitest.ocr.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['tests/ocr/**/*.test.ts'], testTimeout: 120_000 },
});
```

`tests/ocr/fixtures.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWorker, PSM } from 'tesseract.js';
import { parseScan } from '../../src/core/parse';
import { decide } from '../../src/core/verdict';
import { buildRegisterIndex } from '../../src/core/registerIndex';
import { buildConfusion } from '../../src/core/confusion';
import { DEFAULT_THRESHOLDS, type AlertsPack, type RegisterPack } from '../../src/core/types';

const expected = JSON.parse(readFileSync('tests/fixtures/labels/expected.json', 'utf8')) as { file: string; nrn: string; level: string }[];
const register = JSON.parse(readFileSync('public/packs/register.json', 'utf8')) as RegisterPack;
const alerts = JSON.parse(readFileSync('public/packs/alerts.json', 'utf8')) as AlertsPack;
const ctx = { register: buildRegisterIndex(register), alerts: alerts.alerts, flags: new Map(), confusion: buildConfusion([]), today: new Date('2026-10-03T12:00:00Z'), thresholds: DEFAULT_THRESHOLDS };

test('OCR reads the NAFDAC number and reaches the expected verdict on at least 4 of 5 demo cartons', async () => {
  const worker = await createWorker('eng', 1, { langPath: resolve('public/tesseract/lang'), gzip: true, cacheMethod: 'none' });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  let ok = 0;
  for (const e of expected) {
    const { data } = await worker.recognize(resolve('tests/fixtures/labels', e.file));
    const input = parseScan(data.text);
    const verdict = decide(input, ctx);
    const hit = input.nrnCandidates.includes(e.nrn) && verdict.level === e.level;
    if (hit) ok++;
    else console.log(`miss ${e.file}: candidates=${input.nrnCandidates.join(',')} level=${verdict.level}\n${data.text}`);
  }
  await worker.terminate();
  expect(ok).toBeGreaterThanOrEqual(4);
});
```

```bash
npm pkg set scripts.test:ocr="vitest run --config vitest.ocr.config.ts"
npm run test:ocr
```
Expected: PASS. If it fails, read the printed OCR text and fix the parsers in `src/core/parse/*` with a new unit test for each fix. Do not lower the 4-of-5 bar.

- [ ] **Step 3: Implement the browser OCR modules**

`src/ocr/engine.ts`:
```ts
import { createWorker, PSM, type Worker } from 'tesseract.js';

let workerP: Promise<Worker> | null = null;
let progressCb: ((p: number) => void) | null = null;

function base(): string {
  return import.meta.env.BASE_URL ?? '/';
}

export function getWorker(): Promise<Worker> {
  workerP ??= createWorker('eng', 1, {
    workerPath: `${base()}tesseract/worker.min.js`,
    corePath: `${base()}tesseract/`,
    langPath: `${base()}tesseract/lang`,
    gzip: true,
    cacheMethod: 'none',
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') progressCb?.(m.progress);
    },
  });
  return workerP;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('OCR timed out')), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

export async function recognize(
  image: HTMLCanvasElement | Blob | string,
  mode: 'sparse' | 'line',
  onProgress?: (p: number) => void,
): Promise<{ text: string; confidence: number; ms: number }> {
  progressCb = onProgress ?? null;
  const w = await getWorker();
  await w.setParameters(
    mode === 'sparse'
      ? { tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: '' }
      : { tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/ ' },
  );
  const t0 = performance.now();
  const { data } = await withTimeout(w.recognize(image), 20_000);
  return { text: data.text, confidence: data.confidence, ms: Math.round(performance.now() - t0) };
}
```

`src/ocr/preprocess.ts`:
```ts
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Source = ImageBitmap | HTMLImageElement;

function loadImg(b: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(b);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => reject(new Error('could not decode image'));
    img.src = url;
  });
}

export async function loadSource(b: Blob): Promise<Source> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(b);
    } catch {
      /* fall through to <img> decoding */
    }
  }
  return loadImg(b);
}

const dims = (s: Source) => ({ w: 'naturalWidth' in s ? s.naturalWidth : s.width, h: 'naturalHeight' in s ? s.naturalHeight : s.height });

export function toCanvas(src: Source, maxSide: number, crop?: Crop, upscale = 1): HTMLCanvasElement {
  const { w, h } = dims(src);
  const sx = crop ? crop.x * w : 0;
  const sy = crop ? crop.y * h : 0;
  const sw = crop ? crop.w * w : w;
  const sh = crop ? crop.h * h : h;
  const scale = Math.min(1, maxSide / Math.max(sw, sh)) * upscale;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * scale));
  c.height = Math.max(1, Math.round(sh * scale));
  c.getContext('2d')!.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

export function grayscaleStretch(c: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g]++;
  }
  const total = d.length / 4;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < total * 0.02; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < total * 0.02; hi--);
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.min(255, Math.max(0, ((d[i] - lo) * 255) / range));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function binarizeOtsu(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < d.length; i += 4) hist[d[i]]++;
  const total = d.length / 4;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] > threshold ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function thumbnail(src: Source, max = 480): Promise<Blob | null> {
  const c = toCanvas(src, max);
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', 0.6));
}
```

`src/ocr/scan.ts`:
```ts
import type { ScanInput } from '../core/types';
import { parseScan } from '../core/parse';
import { recognize } from './engine';
import { binarizeOtsu, grayscaleStretch, loadSource, thumbnail, toCanvas, type Crop } from './preprocess';

export interface ScanResult {
  input: ScanInput;
  text: string;
  ms: number;
  pass: 1 | 2 | 3;
  thumb: Blob | null;
  confidence: number;
}

export async function runScan(file: Blob, opts: { onProgress?: (p: number) => void; crop?: Crop; previousText?: string } = {}): Promise<ScanResult> {
  const src = await loadSource(file);
  const thumb = await thumbnail(src);
  if (opts.crop) {
    const c = grayscaleStretch(toCanvas(src, 2400, opts.crop, 2));
    const r = await recognize(c, 'line', opts.onProgress);
    const text = `NAFDAC ${r.text.trim()}\n${opts.previousText ?? ''}`;
    return { input: parseScan(text), text, ms: r.ms, pass: 3, thumb, confidence: r.confidence };
  }
  const a = grayscaleStretch(toCanvas(src, 1600));
  const r1 = await recognize(a, 'sparse', opts.onProgress);
  const first = parseScan(r1.text);
  if (first.nrnCandidates.length) return { input: first, text: r1.text, ms: r1.ms, pass: 1, thumb, confidence: r1.confidence };
  const r2 = await recognize(binarizeOtsu(a), 'sparse', opts.onProgress);
  const text = `${r1.text}\n${r2.text}`;
  return { input: parseScan(text), text, ms: r1.ms + r2.ms, pass: 2, thumb, confidence: Math.max(r1.confidence, r2.confidence) };
}
```

`src/components/CropBox.tsx`:
```tsx
import { useRef, useState, type PointerEvent } from 'react';
import type { Crop } from '../ocr/preprocess';

export function CropBox({ src, onChange }: { src: string; onChange: (c: Crop | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<Crop | null>(null);

  const point = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  return (
    <div
      ref={ref}
      className="photo"
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        setStart(point(e));
        setRect(null);
      }}
      onPointerMove={(e) => {
        if (!start) return;
        const p = point(e);
        setRect({ x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) });
      }}
      onPointerUp={() => {
        setStart(null);
        onChange(rect && rect.w > 0.03 && rect.h > 0.02 ? rect : null);
      }}
      data-testid="crop-area"
    >
      <img src={src} alt="" />
      {rect && <div className="cropbox" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }} />}
    </div>
  );
}
```

`src/screens/Scan.tsx`:
```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Layout } from '../components/Layout';
import { CropBox } from '../components/CropBox';
import { pendingScan } from '../lib/pendingScan';
import { runScan, type ScanResult } from '../ocr/scan';
import type { Crop } from '../ocr/preprocess';
import { logEvent } from '../telemetry/events';

export function Scan() {
  const { t, check } = useApp();
  const navigate = useNavigate();
  const fileRef = useRef<File | null>(pendingScan.take());
  const url = useMemo(() => (fileRef.current ? URL.createObjectURL(fileRef.current) : ''), []);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'reading' | 'none' | 'crop' | 'failed'>('reading');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);

  async function finish(r: ScanResult) {
    const row = await check(r.input, r.thumb);
    navigate(`/result/${row.id}`, { replace: true });
  }

  useEffect(() => {
    const file = fileRef.current;
    if (!file) {
      navigate('/', { replace: true });
      return;
    }
    let cancelled = false;
    runScan(file, { onProgress: setProgress })
      .then(async (r) => {
        if (cancelled) return;
        setResult(r);
        void logEvent('ocr_done', { ms: r.ms, pass: r.pass, foundNrn: r.input.nrnCandidates.length > 0, conf: Math.round(r.confidence) });
        if (r.input.nrnCandidates.length) await finish(r);
        else setPhase('none');
      })
      .catch((e: Error) => {
        if (cancelled) return;
        void logEvent('ocr_failed', { error: e.message.slice(0, 60) });
        setPhase('failed');
      });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function readCrop() {
    if (!crop || !fileRef.current) return;
    setPhase('reading');
    void logEvent('crop_used', {});
    try {
      const r = await runScan(fileRef.current, { crop, previousText: result?.text ?? '', onProgress: setProgress });
      setResult(r);
      if (r.input.nrnCandidates.length) await finish(r);
      else setPhase('none');
    } catch {
      setPhase('failed');
    }
  }

  return (
    <Layout>
      {phase === 'crop' ? (
        <>
          <p>{t('scan_crop_help')}</p>
          <CropBox src={url} onChange={setCrop} />
          <button type="button" className="btn btn-primary" disabled={!crop} onClick={readCrop}>{t('scan_crop_done')}</button>
        </>
      ) : (
        <div className="photo"><img src={url} alt="" /></div>
      )}
      {phase === 'reading' && (
        <>
          <span className="label">{t('scan_reading')}</span>
          <div className="progress" data-testid="ocr-progress"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <p className="small muted">{t('scan_private')}</p>
        </>
      )}
      {(phase === 'none' || phase === 'failed') && (
        <>
          <p className="error" role="alert">{phase === 'none' ? t('scan_none') : t('scan_failed')}</p>
          {phase === 'none' && <button type="button" className="btn btn-outline" onClick={() => setPhase('crop')}>{t('scan_crop')}</button>}
          <button type="button" className="btn btn-plain" onClick={() => navigate('/type', { state: { read: result?.input.nrnCandidates[0] ?? null, text: result?.text ?? '' } })}>
            {t('scan_type')}
          </button>
        </>
      )}
    </Layout>
  );
}
```

Modify `src/screens/TypeNumber.tsx`:
- import `useLocation` from `react-router-dom`;
- `const state = (useLocation().state ?? {}) as { read?: string | null; text?: string };`
- in `submit`, after `manualInput` succeeds and before `check`:
```tsx
if (state.read && state.read !== input.nrnCandidates[0]) void logEvent('nrn_corrected', { read: state.read, corrected: input.nrnCandidates[0] });
```

Modify `src/screens/Result.tsx`: inside the `actions` stack, before the Done link, add:
```tsx
{row.input.source === 'ocr' && (
  <Link to="/type" state={{ read: row.verdict.nrn, text: row.input.text }} className="btn btn-plain">{t('scan_type')}</Link>
)}
```

Modify `src/App.tsx`: import `Scan` and add `<Route path="/scan" element={<Scan />} />`.

- [ ] **Step 4: E2E photo upload** `tests/e2e/scan.spec.ts`

```ts
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('photo of carton 1 reads on the device and shows green', async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  await page.getByTestId('photo-input').setInputFiles('tests/fixtures/labels/1.png');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'green', { timeout: 90_000 });
  await expect(page.getByRole('heading', { name: 'Artheget EZ' })).toBeVisible();
});

test('photo of carton 2 is amber', async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  await page.getByTestId('photo-input').setInputFiles('tests/fixtures/labels/2.png');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'amber', { timeout: 90_000 });
});
```

- [ ] **Step 5: Run checks**

Run: `npm run typecheck && npm test && npm run test:ocr && npm run e2e`
Expected: all PASS. If the browser OCR cannot load the worker or core, open DevTools on `npm run build:e2e && npm run preview:e2e` and check the network panel for 404s under `/tesseract/`. Fix the paths in `engine.ts` (corePath must be the directory URL ending in `/`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: on-device OCR with crop fallback and scan screen"
```

---

### Task 18: Voice clips (ElevenLabs) and player

**Files:**
- Create: `scripts/make-voice.ts`, `src/voice/forVerdict.ts`, `src/voice/player.ts`, `src/components/ListenButton.tsx`
- Modify: `src/screens/Result.tsx`, `src/screens/Home.tsx`, `src/screens/Welcome.tsx`, `src/screens/Report.tsx`
- Create (generated, committed): `public/voice/{en,ha,pcm}/*.mp3`
- Test: `tests/unit/voice.test.ts`

**Interfaces:**
- Consumes: `CLIPS`, `CLIP_KEYS`, `ClipKey`, `voiceLangFor` (Task 13); `Verdict`, `Lang`.
- Produces: `clipForVerdict(v: Verdict): ClipKey`; `clipUrl(key: ClipKey, lang: 'en' | 'ha' | 'pcm'): string`; `playClip(key: ClipKey, lang: Lang, audioFactory?: () => HTMLAudioElement): Promise<boolean>`; `ListenButton` props `{ clip: ClipKey; label?: string; autoPlay?: boolean }`.

- [ ] **Step 1: Write the failing test** `tests/unit/voice.test.ts`

```ts
import { clipForVerdict } from '../../src/voice/forVerdict';
import { clipUrl, playClip } from '../../src/voice/player';
import type { Verdict } from '../../src/core/types';

const v = (level: Verdict['level'], reasons: Verdict['reasons']) => ({ level, reasons }) as Verdict;

test.each([
  [v('green', ['registered']), 'v_green'],
  [v('green', ['registered', 'name_unconfirmed']), 'v_green_unconfirmed'],
  [v('amber', ['registered', 'name_mismatch']), 'v_amber_mismatch'],
  [v('amber', ['registered', 'alert_product']), 'v_amber_alert'],
  [v('amber', ['registered', 'community_flag']), 'v_amber_community'],
  [v('amber', ['registered', 'reg_lapsed']), 'v_amber_lapsed'],
  [v('red', ['not_in_register']), 'v_red_notfound'],
  [v('red', ['not_in_register', 'on_alert']), 'v_red_alert'],
  [v('red', ['registered', 'pack_expired']), 'v_red_expired'],
  [v('unknown', ['no_number_found']), 'v_unknown'],
])('clip for %o is %s', (verdict, clip) => {
  expect(clipForVerdict(verdict)).toBe(clip);
});

test('clip urls are under /voice', () => {
  expect(clipUrl('v_green', 'ha')).toBe('/voice/ha/v_green.mp3');
});

test('player falls back to English, then gives up quietly', async () => {
  const tried: string[] = [];
  const factory = () => {
    const a = { src: '', play: () => (tried.push(a.src), a.src.includes('/en/') ? Promise.resolve() : Promise.reject(new Error('404'))) };
    return a as unknown as HTMLAudioElement;
  };
  expect(await playClip('v_green', 'ha', factory)).toBe(true);
  expect(tried).toEqual(['/voice/ha/v_green.mp3', '/voice/en/v_green.mp3']);
  const none = () => ({ src: '', play: () => Promise.reject(new Error('x')) }) as unknown as HTMLAudioElement;
  expect(await playClip('v_green', 'ha', none)).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/voice.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/voice/forVerdict.ts`:
```ts
import type { Verdict } from '../core/types';
import type { ClipKey } from './clips';

export function clipForVerdict(v: Verdict): ClipKey {
  const has = (r: Verdict['reasons'][number]) => v.reasons.includes(r);
  if (v.level === 'red') {
    if (has('batch_on_alert') || has('on_alert')) return 'v_red_alert';
    if (has('pack_expired')) return 'v_red_expired';
    return 'v_red_notfound';
  }
  if (v.level === 'amber') {
    if (has('name_mismatch') || has('strength_mismatch')) return 'v_amber_mismatch';
    if (has('alert_product')) return 'v_amber_alert';
    if (has('community_flag')) return 'v_amber_community';
    return 'v_amber_lapsed';
  }
  if (v.level === 'green') return has('name_unconfirmed') ? 'v_green_unconfirmed' : 'v_green';
  return 'v_unknown';
}
```

`src/voice/player.ts`:
```ts
import type { Lang } from '../core/types';
import { voiceLangFor, type ClipKey, type VoiceLang } from './clips';

export function clipUrl(key: ClipKey, lang: VoiceLang): string {
  return `${import.meta.env.BASE_URL ?? '/'}voice/${lang}/${key}.mp3`;
}

let shared: HTMLAudioElement | null = null;

export async function playClip(key: ClipKey, lang: Lang, audioFactory?: () => HTMLAudioElement): Promise<boolean> {
  const order: VoiceLang[] = voiceLangFor(lang) === 'en' ? ['en'] : [voiceLangFor(lang), 'en'];
  for (const l of order) {
    const audio = audioFactory ? audioFactory() : (shared ??= new Audio());
    audio.src = clipUrl(key, l);
    try {
      await audio.play();
      return true;
    } catch {
      /* try the next language */
    }
  }
  return false;
}
```

`src/components/ListenButton.tsx`:
```tsx
import { useEffect } from 'react';
import { useApp } from '../state/AppContext';
import { playClip } from '../voice/player';
import type { ClipKey } from '../voice/clips';
import { logEvent } from '../telemetry/events';

export function ListenButton({ clip, label, autoPlay = false }: { clip: ClipKey; label?: string; autoPlay?: boolean }) {
  const { t, settings } = useApp();
  const play = async () => {
    const ok = await playClip(clip, settings.lang);
    void logEvent('voice_played', { key: clip, lang: settings.lang, ok });
  };
  useEffect(() => {
    if (autoPlay) void playClip(clip, settings.lang);
  }, [autoPlay, clip, settings.lang]);
  return (
    <button type="button" className="btn btn-outline" onClick={play} data-testid="listen">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 10v4h4l5 4V6L8 10z" />
        <path d="M16 9a4 4 0 0 1 0 6" />
      </svg>
      {label ?? t('listen')}
    </button>
  );
}
```

Wire it in:
- `src/screens/Result.tsx`: import `ListenButton` and `clipForVerdict`. Make `<ListenButton clip={clipForVerdict(row.verdict)} autoPlay />` the first child of the actions stack.
- `src/screens/Home.tsx`: after the "Type NAFDAC number" link, add `<ListenButton clip="howto" label={t('home_listen')} />`.
- `src/screens/Welcome.tsx`: in `pick(lang)`, call `void playClip('welcome', lang);` first (import `playClip`).
- `src/screens/Report.tsx`: in the saved view, add `<ListenButton clip="report_saved" autoPlay />` under the heading.

`scripts/make-voice.ts`:
```ts
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { env, sleep } from './lib/env';
import { CLIPS, CLIP_KEYS, type VoiceLang } from '../src/voice/clips';

const key = env('ELEVENLABS_API_KEY');
if (!key) {
  console.error('ELEVENLABS_API_KEY not set: the app will run text-only. Add the key to .env and rerun `npm run voice`.');
  process.exit(2);
}
const force = process.argv.includes('--force');
const model = env('ELEVENLABS_MODEL') ?? 'eleven_v3';
const voiceFor = (l: VoiceLang) => env(`ELEVENLABS_VOICE_ID_${l.toUpperCase()}`) ?? env('ELEVENLABS_VOICE_ID') ?? 'JBFqnCBsd6RMkjVDRZzb';

async function tts(text: string, lang: VoiceLang): Promise<ArrayBuffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceFor(lang)}?output_format=mp3_44100_64`;
  const attempt = async (body: Record<string, unknown>) =>
    fetch(url, { method: 'POST', headers: { 'xi-api-key': key!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify(body) });
  let res = await attempt({ text, model_id: model, ...(lang === 'ha' ? { language_code: 'ha' } : {}) });
  if (res.status >= 400 && res.status < 500 && lang === 'ha') res = await attempt({ text, model_id: model });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.arrayBuffer();
}

let made = 0;
for (const lang of ['en', 'ha', 'pcm'] as VoiceLang[]) {
  mkdirSync(`public/voice/${lang}`, { recursive: true });
  for (const k of CLIP_KEYS) {
    const path = `public/voice/${lang}/${k}.mp3`;
    if (existsSync(path) && !force) continue;
    writeFileSync(path, Buffer.from(await tts(CLIPS[k][lang], lang)));
    made++;
    console.log(`voice ${path}`);
    await sleep(300);
  }
}
console.log(`voice clips generated: ${made}`);
```

```bash
npm pkg set scripts.voice="tsx scripts/make-voice.ts"
```

- [ ] **Step 4: Run tests, then generate the clips**

Run: `npx vitest run tests/unit/voice.test.ts && npm run typecheck`
Expected: PASS.

Then run `npm run voice`.
- With `ELEVENLABS_API_KEY`: 42 mp3 files (about 1–2 MB total). Listen to `public/voice/ha/v_red_notfound.mp3` with `afplay` to sanity-check that it is audible Hausa.
- Exit code 2 (no key): the app falls back to text. Mark the index entry `BLOCKED: ELEVENLABS_API_KEY for voice clips (code done)`. The user can run `npm run voice` later.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: pre-rendered Hausa, English and Pidgin voice verdicts with fallback player"
```

---

### Task 19: PWA (service worker, manifest, icons) + offline E2E + phase gate

**Files:**
- Create: `scripts/make-icons.ts`, `public/icons/*.png` (generated), `tests/e2e/offline.spec.ts`, `tests/e2e/smoke.spec.ts`
- Modify: `vite.config.ts`, `playwright.config.ts`

**Interfaces:**
- Consumes: everything so far.
- Produces: a service worker that precaches the app shell, `packs/*.json`, `tesseract/**`, `voice/**` and fonts; the web manifest; icons; the `webkit-smoke` Playwright project.

- [ ] **Step 1: Icons**

```bash
npm i -D vite-plugin-pwa
```

`scripts/make-icons.ts`:
```ts
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
```

```bash
npm pkg set scripts.icons="tsx scripts/make-icons.ts"
npm run icons
```

- [ ] **Step 2: Configure the PWA** (replace `vite.config.ts`)

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pwa = VitePWA({
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  includeAssets: ['icons/*.png'],
  manifest: {
    name: 'DawaCheck',
    short_name: 'DawaCheck',
    description: 'Check a medicine against the NAFDAC register with no internet.',
    theme_color: '#0B6E4F',
    background_color: '#F6F9F7',
    display: 'standalone',
    start_url: './',
    scope: './',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,png,svg,woff,woff2,json,mp3,wasm,gz}'],
    maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
    navigateFallback: 'index.html',
    cleanupOutdatedCaches: true,
  },
});

export default defineConfig({
  plugins: process.env.VITEST ? [react()] : [react(), pwa],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/scripts/**/*.test.ts'],
  },
});
```

Add `"vite-plugin-pwa/client"` to `tsconfig.json` `types` only if TypeScript complains about `virtual:pwa-register`. It should not, because `injectRegister: 'auto'` needs no import.

Run: `npm run build` and confirm that `dist/sw.js` and `dist/manifest.webmanifest` exist. Check that the build log's precache entry list includes `packs/register.json`, `tesseract/lang/eng.traineddata.gz` and the voice files. If total precache is above 25 MB, drop the non-SIMD core from `copy-ocr-assets.ts` only if it is a duplicate format.

- [ ] **Step 3: Offline and WebKit E2E**

`tests/e2e/offline.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { onboard, typeNumber } from './helpers';

test('works with no network after the first load, and queues a report', async ({ page, context }) => {
  test.setTimeout(120_000);
  await onboard(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 30_000 }).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('status-pill')).toContainText('No internet');
  await typeNumber(page, 'A4-6238');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'green');

  await typeNumber(page, 'A4-99231');
  await page.getByTestId('report-link').click();
  await page.getByRole('button', { name: 'Save report' }).click();
  await expect(page.getByText(/Reports waiting: 1/)).toBeVisible();
  await context.setOffline(false);
});
```

`tests/e2e/smoke.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { onboard, typeNumber } from './helpers';

test('smoke: onboard and a typed check', async ({ page }) => {
  await onboard(page);
  await typeNumber(page, 'A4-6238');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-level', 'green');
});
```

In `playwright.config.ts`, replace `projects` with:
```ts
projects: [
  { name: 'chromium', use: { ...devices['Pixel 7'] } },
  { name: 'webkit-smoke', use: { ...devices['iPhone 14'] }, testMatch: /smoke\.spec\.ts/ },
],
```

```bash
npx playwright install webkit
```

- [ ] **Step 4: Phase gate**

Run: `npm run verify && npm run test:ocr`
Expected: all PASS (chromium specs plus webkit smoke).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: installable offline PWA with precached data, OCR and voice"
```
