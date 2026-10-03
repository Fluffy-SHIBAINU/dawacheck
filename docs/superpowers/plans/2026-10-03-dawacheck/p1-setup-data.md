# Phase 1: Setup and data

Read the plan index (`../2026-10-03-dawacheck.md`) Global Constraints first. Working directory for every command: `/Users/grey/Desktop/dev/hacknation`.

---

### Task 1: Scaffold the app, tooling, styles and smoke test

**Files:**
- Create: `package.json` (via npm), `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `.env.example`, `.env.e2e`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles/tokens.css`, `src/styles/app.css`
- Test: `tests/setup.ts`, `tests/unit/smoke.test.tsx`

**Interfaces:**
- Produces: `export function App(): JSX.Element` from `src/App.tsx` (replaced in Task 14). CSS classes in `app.css` used by every later screen: `.app .topbar .brand .main .nav .btn .btn-primary .btn-outline .btn-plain .btn-danger .btn-hero .pill .dot .dot-green|amber|red|unknown|online|offline .card .list .band .band-green|amber|red|unknown .look .alertcard .notice .reasons .cmp .cmp-box .chips .chip .progress .field .check .queue .error .photo .cropbox .dash-grid .bar .kpis .code .muted .small .stack .row .label .visually-hidden`.

- [x] **Step 1: Initialize git and npm, install dependencies**

```bash
git init -b main
npm init -y
npm pkg set name=dawacheck version=0.1.0 type=module
npm pkg set private=true --json
npm pkg set scripts.dev="vite" scripts.build="tsc --noEmit && vite build" scripts.preview="vite preview --port 4173 --strictPort" scripts.typecheck="tsc --noEmit" scripts.test="vitest run" scripts.test:watch="vitest"
npm i react react-dom react-router-dom dexie @fontsource/archivo @fontsource/atkinson-hyperlegible @fontsource/ibm-plex-mono
npm i -D typescript vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event fake-indexeddb @types/react @types/react-dom @types/node tsx dotenv
```

If npm reports a peer-dependency conflict between `vite` and `@vitejs/plugin-react` or `vitest`, install the newest `vite` major that all three accept (for example `npm i -D vite@6`). Do not use `--force`.

- [x] **Step 2: Write config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "types": ["vite/client", "vitest/globals", "node"]
  },
  "include": ["src", "tests", "scripts", "vite.config.ts", "vitest.ocr.config.ts", "playwright.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/scripts/**/*.test.ts'],
  },
});
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0B6E4F" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="DawaCheck" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <link rel="icon" type="image/png" href="/icons/icon-192.png" />
    <title>DawaCheck</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`.gitignore`:
```
node_modules
dist
dist-e2e
.env
.env.local
data/raw
public/tesseract
test-results
playwright-report
coverage
.DS_Store
```

`.env.example`:
```
# Build-time only (scripts). Never bundled into the app.
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb
ELEVENLABS_MODEL=eleven_v3
BRIGHTDATA_API_KEY=
BRIGHTDATA_ZONE=web_unlocker1
SUPABASE_SERVICE_ROLE_KEY=

# Client (inlined at build time, safe to expose)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SYNC_MODE=off
```

`.env.e2e` (committed; used by `vite build --mode e2e`):
```
VITE_SYNC_MODE=mock
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=test-anon-key
```

Then: `[ -f .env ] || cp .env.example .env` (never overwrite the user's `.env`).

- [x] **Step 3: Write styles, entry and temporary App**

`src/styles/tokens.css`:
```css
:root {
  --bg: #F6F9F7;
  --surface: #FFFFFF;
  --sunk: #EAF0ED;
  --ink: #10201A;
  --muted: #5A6A63;
  --line: #DAE3DE;
  --accent: #0B6E4F;
  --accent-ink: #FFFFFF;
  --accent-soft: #DDEFE7;
  --ok: #1D8752;
  --ok-bg: #E1F3E8;
  --warn: #9A6300;
  --warn-bg: #FBEFD6;
  --bad: #BF3129;
  --bad-bg: #FBE3E0;
  --stamp: #2F45B5;
  --font-display: 'Archivo', 'Arial Narrow', system-ui, sans-serif;
  --font-body: 'Atkinson Hyperlegible', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
  --radius: 14px;
  --tap: 48px;
}
```

`src/styles/app.css`:
```css
* { box-sizing: border-box; }
html, body, #root { height: 100%; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--font-body); font-size: 17px; line-height: 1.45; -webkit-font-smoothing: antialiased; }
button, input, select, textarea { font: inherit; color: inherit; }
.app { max-width: 520px; margin: 0 auto; min-height: 100%; display: flex; flex-direction: column; padding-top: env(safe-area-inset-top); }
.app.wide { max-width: 1100px; }
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--line); background: var(--surface); position: sticky; top: 0; z-index: 5; }
.brand { font-family: var(--font-display); font-weight: 800; font-size: 22px; color: var(--accent); text-decoration: none; }
.main { flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.nav { display: flex; justify-content: space-around; gap: 6px; border-top: 1px solid var(--line); background: var(--surface); padding: 6px 8px calc(6px + env(safe-area-inset-bottom)); position: sticky; bottom: 0; }
.nav a { flex: 1; text-align: center; padding: 10px 4px; color: var(--muted); text-decoration: none; font-weight: 700; font-size: 14px; border-radius: 10px; }
.nav a.active { color: var(--accent); background: var(--accent-soft); }
h1, h2, h3 { font-family: var(--font-display); margin: 0; line-height: 1.1; text-wrap: balance; }
h1 { font-size: 26px; font-weight: 800; }
h2 { font-size: 21px; font-weight: 800; }
h3 { font-size: 17px; font-weight: 700; }
p { margin: 0; }
.muted { color: var(--muted); }
.small { font-size: 14px; }
.code { font-family: var(--font-mono); font-weight: 600; letter-spacing: 0.01em; }
.stack { display: flex; flex-direction: column; gap: 10px; }
.row { display: flex; align-items: center; gap: 10px; }
.label { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; color: var(--muted); }
.btn { min-height: var(--tap); border-radius: 12px; padding: 12px 16px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; font-weight: 700; border: 1.5px solid transparent; cursor: pointer; text-decoration: none; text-align: center; }
.btn:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid var(--stamp); outline-offset: 2px; }
.btn-primary { background: var(--accent); color: var(--accent-ink); }
.btn-outline { background: var(--surface); color: var(--accent); border-color: var(--accent); }
.btn-plain { background: var(--surface); color: var(--ink); border-color: var(--line); }
.btn-danger { background: var(--bad); color: #FFFFFF; }
.btn[disabled] { opacity: 0.5; cursor: not-allowed; }
.btn-hero { flex-direction: column; padding: 22px 16px; border-radius: 18px; gap: 6px; }
.btn-hero strong { font-family: var(--font-display); font-size: 28px; font-weight: 800; }
.btn-hero span { font-weight: 400; opacity: 0.92; }
.btn svg { width: 22px; height: 22px; flex: none; }
.btn-hero svg { width: 40px; height: 40px; }
.visually-hidden { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.pill { align-self: flex-start; display: inline-flex; gap: 6px; align-items: center; font-size: 13px; background: var(--surface); border: 1px solid var(--line); color: var(--muted); border-radius: 999px; padding: 4px 10px; }
.dot { width: 10px; height: 10px; border-radius: 50%; flex: none; display: inline-block; }
.dot-green, .dot-online { background: var(--ok); }
.dot-amber { background: var(--warn); }
.dot-red { background: var(--bad); }
.dot-unknown, .dot-offline { background: var(--muted); }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
.list { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); }
.list > * { padding: 12px 14px; border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 10px; text-decoration: none; color: inherit; }
.list > *:last-child { border-bottom: 0; }
.band { margin: -16px -16px 0; padding: 18px 16px; display: flex; align-items: center; gap: 12px; font-family: var(--font-display); font-weight: 800; font-size: 24px; line-height: 1.1; }
.band svg { width: 34px; height: 34px; flex: none; }
.band-green { background: var(--ok); color: #FFFFFF; }
.band-amber { background: var(--warn-bg); color: var(--warn); border-bottom: 4px solid var(--warn); }
.band-red { background: var(--bad); color: #FFFFFF; }
.band-unknown { background: var(--sunk); color: var(--ink); }
.look { background: var(--ok-bg); border-radius: var(--radius); padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
.alertcard { background: var(--bad-bg); border-radius: var(--radius); padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
.notice { background: var(--warn-bg); color: var(--ink); border-radius: var(--radius); padding: 12px 14px; }
.reasons { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }
.cmp { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cmp > div { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 10px; display: flex; flex-direction: column; gap: 2px; }
.cmp > .cmp-box { border-color: var(--warn); background: var(--warn-bg); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-family: var(--font-mono); font-size: 13px; font-weight: 600; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 4px 8px; }
.progress { height: 8px; background: var(--line); border-radius: 999px; overflow: hidden; }
.progress > i { display: block; height: 100%; background: var(--accent); transition: width 0.2s; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field input[type=text], .field select, .field textarea { min-height: var(--tap); border: 1.5px solid var(--line); border-radius: 12px; padding: 10px 12px; background: var(--surface); }
.field input.code { font-size: 22px; letter-spacing: 0.04em; text-transform: uppercase; }
.check { display: flex; align-items: center; gap: 10px; min-height: var(--tap); }
.check input { width: 22px; height: 22px; accent-color: var(--accent); }
.queue { border: 1.5px dashed var(--accent); border-radius: var(--radius); padding: 12px 14px; background: var(--surface); }
.queue strong { font-family: var(--font-display); font-size: 22px; color: var(--accent); }
.error { color: var(--bad); font-weight: 700; }
.photo { position: relative; border-radius: var(--radius); overflow: hidden; background: #1F2421; touch-action: none; user-select: none; }
.photo img { display: block; width: 100%; height: auto; pointer-events: none; }
.cropbox { position: absolute; border: 3px solid var(--stamp); background: rgba(47, 69, 181, 0.12); pointer-events: none; }
.dash-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
.bar { display: grid; grid-template-columns: 70px 1fr 40px; gap: 8px; align-items: center; font-variant-numeric: tabular-nums; }
.bar > i { height: 10px; border-radius: 4px; background: var(--accent); display: block; }
.kpis { display: flex; gap: 18px; flex-wrap: wrap; }
.kpis b { display: block; font-family: var(--font-display); font-size: 28px; font-weight: 800; font-variant-numeric: tabular-nums; }
@media (min-width: 900px) { .dash-grid { grid-template-columns: repeat(3, 1fr); } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
```

`src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo/800.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/App.tsx` (temporary; Task 14 replaces it):
```tsx
export function App() {
  return (
    <div className="app">
      <header className="topbar"><span className="brand">DawaCheck</span></header>
      <main className="main"><p>Offline medicine checker</p></main>
    </div>
  );
}
```

`tests/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

- [x] **Step 4: Write the smoke test**

`tests/unit/smoke.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { App } from '../../src/App';

test('renders the app name', () => {
  render(<App />);
  expect(screen.getByText('DawaCheck')).toBeInTheDocument();
});
```

- [x] **Step 5: Run checks**

Run: `npm test && npm run typecheck && npm run build`
Expected: 1 test passes, typecheck has no errors, `dist/` is produced.

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold DawaCheck web app with tooling and design tokens"
```

---

### Task 2: Core types and text utilities

**Files:**
- Create: `src/core/types.ts`, `src/core/text.ts`
- Test: `tests/unit/core/text.test.ts`

**Interfaces:**
- Produces (types, used everywhere): `Level`, `Reason`, `RED_REASONS`, `AMBER_REASONS`, `Product`, `RegisterPack`, `AlertKind`, `ALERT_KINDS`, `AlertProduct`, `Alert`, `AlertsPack`, `CommunityFlag`, `Correction`, `Thresholds`, `DEFAULT_THRESHOLDS`, `PackEntry`, `Manifest`, `Strength`, `Expiry`, `ScanInput`, `Verdict`, `ReportReason`, `REPORT_REASONS`.
- Produces (functions): `normalizeText(s: string): string`, `collapseWs(s: string): string`, `decodeEntities(s: string): string`, `levenshtein(a: string, b: string): number`, `similarity(a: string, b: string): number` (0..1).

- [x] **Step 1: Write `src/core/types.ts`**

```ts
export type Level = 'green' | 'amber' | 'red' | 'unknown';

export type Reason =
  | 'registered'
  | 'name_unconfirmed'
  | 'corrected_number'
  | 'reg_lapsed'
  | 'name_mismatch'
  | 'strength_mismatch'
  | 'alert_product'
  | 'community_flag'
  | 'not_in_register'
  | 'on_alert'
  | 'batch_on_alert'
  | 'pack_expired'
  | 'no_number_found'
  | 'ambiguous_number';

export const RED_REASONS: readonly Reason[] = ['not_in_register', 'on_alert', 'batch_on_alert', 'pack_expired'];
export const AMBER_REASONS: readonly Reason[] = ['reg_lapsed', 'name_mismatch', 'strength_mismatch', 'alert_product', 'community_flag'];

export interface Product {
  nrn: string;
  nrnRaw: string;
  name: string;
  ingredient: string;
  strength: string;
  form: string;
  route: string;
  applicant: string;
  category: string;
  regExpiry: string | null;
  status: string;
  description: string;
  packSize: string;
  atc: string | null;
}

export interface RegisterPack {
  version: string;
  source: string;
  fetchedAt: string;
  products: Product[];
}

export type AlertKind = 'counterfeit' | 'substandard' | 'recall' | 'unregistered' | 'watchlist' | 'other';
export const ALERT_KINDS: readonly AlertKind[] = ['counterfeit', 'substandard', 'recall', 'unregistered', 'watchlist', 'other'];

export interface AlertProduct {
  brand: string | null;
  ingredient: string | null;
  strength: string | null;
  manufacturer: string | null;
  nrn: string | null;
  batches: string[];
}

export interface Alert {
  id: string;
  wpId: number;
  url: string;
  date: string;
  title: string;
  kind: AlertKind;
  products: AlertProduct[];
  summary: string;
  appliesToNigeria: boolean;
}

export interface AlertsPack {
  version: string;
  fetchedAt: string;
  alerts: Alert[];
}

export interface CommunityFlag {
  nrn: string;
  reports: number;
  devices: number;
  states: string[];
  level: 'watch' | 'warning';
  last_report_at: string;
}

export interface Correction {
  read: string;
  corrected: string;
  n: number;
}

export interface Thresholds {
  nameMatch: number;
  nameMismatch: number;
  flagWatchReports: number;
  flagWatchDevices: number;
  flagWarnReports: number;
  flagWarnDevices: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  nameMatch: 0.8,
  nameMismatch: 0.5,
  flagWatchReports: 3,
  flagWatchDevices: 2,
  flagWarnReports: 5,
  flagWarnDevices: 3,
};

export interface PackEntry {
  version: string;
  file: string;
  sha256: string;
  count: number;
  bytes: number;
}

export interface Manifest {
  schema: 1;
  generatedAt: string;
  packs: { register: PackEntry; alerts: PackEntry };
  thresholds: Thresholds;
}

export interface Strength {
  value: number;
  unit: string;
}

export interface Expiry {
  month: number;
  year: number;
}

export interface ScanInput {
  source: 'ocr' | 'manual';
  nrnCandidates: string[];
  text: string;
  strengths: Strength[];
  batch: string | null;
  expiry: Expiry | null;
}

export interface Verdict {
  level: Level;
  reasons: Reason[];
  nrn: string | null;
  product: Product | null;
  products: Product[];
  alert: Alert | null;
  flag: CommunityFlag | null;
  suggestions: Product[];
  correctedFrom: string | null;
  ingredientAlertNote: string | null;
  boxName: string | null;
  boxStrengths: Strength[];
  expiry: Expiry | null;
  batch: string | null;
}

export type ReportReason =
  | 'not_in_register'
  | 'name_mismatch'
  | 'strength_mismatch'
  | 'pack_expired'
  | 'reg_lapsed'
  | 'on_alert'
  | 'batch_on_alert'
  | 'alert_product'
  | 'community_flag'
  | 'looks_different'
  | 'other';

export const REPORT_REASONS: readonly ReportReason[] = [
  'not_in_register', 'name_mismatch', 'strength_mismatch', 'pack_expired', 'reg_lapsed',
  'on_alert', 'batch_on_alert', 'alert_product', 'community_flag', 'looks_different', 'other',
];
```

- [x] **Step 2: Write the failing test** `tests/unit/core/text.test.ts`

```ts
import { collapseWs, decodeEntities, levenshtein, normalizeText, similarity } from '../../../src/core/text';

describe('normalizeText', () => {
  it('uppercases, unifies dashes and joins spaced hyphens', () => {
    expect(normalizeText('nafdac reg. no. a4 – 6238')).toBe('NAFDAC REG. NO. A4-6238');
    expect(normalizeText('A4—6238')).toBe('A4-6238');
    expect(normalizeText('line one\r\nline   two')).toBe('LINE ONE\nLINE TWO');
  });
});

describe('collapseWs', () => {
  it('collapses all whitespace including newlines', () => {
    expect(collapseWs('Tablet\r\nYellow   colored ')).toBe('Tablet Yellow colored');
  });
});

describe('decodeEntities', () => {
  it('decodes numeric and named entities', () => {
    expect(decodeEntities('1 x 500&#039;s')).toBe("1 x 500's");
    expect(decodeEntities('A &amp; B &#8211; C')).toBe('A & B – C');
    expect(decodeEntities('&lt;b&gt; &quot;x&quot;')).toBe('<b> "x"');
  });
});

describe('levenshtein and similarity', () => {
  it('computes edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
  });
  it('computes similarity between 0 and 1', () => {
    expect(similarity('ARTHEGET', 'ARTHEGET')).toBe(1);
    expect(similarity('ARTHEGET', 'ARTHEGFT')).toBeCloseTo(0.875, 3);
    expect(similarity('', '')).toBe(1);
    expect(similarity('MALAQUICK', 'ARTHEGET')).toBeLessThan(0.5);
  });
});
```

- [x] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/unit/core/text.test.ts`
Expected: FAIL, cannot resolve `src/core/text`.

- [x] **Step 4: Implement `src/core/text.ts`**

```ts
export function normalizeText(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .toUpperCase()
    .replace(/[‐-―−]/g, '-')
    .replace(/[ \t]*-[ \t]*/g, '-')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n');
}

export function collapseWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}
```

- [x] **Step 5: Run tests and typecheck**

Run: `npx vitest run tests/unit/core/text.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add core domain types and text utilities"
```

---

### Task 3: Register normalization and `data:register` (real NAFDAC data)

**Files:**
- Create: `src/core/parse/nrn.ts` (only `NRN_RE` and `normalizeNrn` now; Task 6 extends it)
- Create: `scripts/lib/env.ts`, `scripts/lib/normalizeRegister.ts`, `scripts/fetch-register.ts`
- Create (generated, committed): `public/packs/register.json`
- Test: `tests/unit/core/nrn-normalize.test.ts`, `tests/scripts/normalizeRegister.test.ts`, `tests/scripts/registerPack.test.ts`

**Interfaces:**
- Consumes: `collapseWs`, `decodeEntities` (Task 2), `Product`, `RegisterPack` (Task 2).
- Produces: `NRN_RE: RegExp`, `normalizeNrn(raw: string | null | undefined): string | null`; `GreenbookRow` type; `normalizeRecord(r: GreenbookRow): Product | null`; `normalizeAll(rows: GreenbookRow[]): { products: Product[]; dropped: string[] }`; `env(name: string): string | undefined`; `sleep(ms: number): Promise<void>`; the file `public/packs/register.json` (`RegisterPack`).

- [x] **Step 1: Write the failing tests**

`tests/unit/core/nrn-normalize.test.ts`:
```ts
import { normalizeNrn } from '../../../src/core/parse/nrn';

test.each([
  ['A4-6238', 'A4-6238'],
  ['a4-100160', 'A4-100160'],
  ['A11-0275', 'A11-0275'],
  ['04 – 1486', '04-1486'],
  ['04- 9502', '04-9502'],
  ['B4-1234', 'B4-1234'],
  ['A1-4924L', 'A1-4924L'],
  [' C4-12345 ', 'C4-12345'],
])('normalizes %s to %s', (raw, expected) => {
  expect(normalizeNrn(raw)).toBe(expected);
});

test.each([['4/1/9086'], ['NA'], ['Not available yet'], [''], ['A11AA'], ['B-7187'], ['04-5112ugo'], [null], [undefined]])(
  'rejects %s',
  (raw) => {
    expect(normalizeNrn(raw as string | null | undefined)).toBeNull();
  },
);
```

`tests/scripts/normalizeRegister.test.ts`:
```ts
import { normalizeAll, normalizeRecord, type GreenbookRow } from '../../scripts/lib/normalizeRegister';

const row: GreenbookRow = {
  NAFDAC: 'A4-6238',
  product_name: 'Artheget EZ##',
  ingredient_name: 'Artemether + Lumefantrine',
  strength: '80 mg; 480 mg',
  form_name: 'Tablet',
  route_name: 'Oral',
  applicant_name: 'Example Pharma Ltd',
  category_name: 'Drugs',
  expiry_date: '2026-12-01',
  status: 'Active',
  product_description: 'Tablet\r\nYellow colored, oblong shaped tablet plain on both sides',
  pack_size: '2 x 3&#039;s (in Alu-Alu blisters)',
  atc: 'P01BF01',
};

test('normalizes a Greenbook row into a Product', () => {
  expect(normalizeRecord(row)).toEqual({
    nrn: 'A4-6238',
    nrnRaw: 'A4-6238',
    name: 'Artheget EZ',
    ingredient: 'Artemether + Lumefantrine',
    strength: '80 mg; 480 mg',
    form: 'Tablet',
    route: 'Oral',
    applicant: 'Example Pharma Ltd',
    category: 'Drugs',
    regExpiry: '2026-12-01',
    status: 'Active',
    description: 'Tablet Yellow colored, oblong shaped tablet plain on both sides',
    packSize: "2 x 3's (in Alu-Alu blisters)",
    atc: 'P01BF01',
  });
});

test('drops rows without a valid NRN and reports them', () => {
  const { products, dropped } = normalizeAll([row, { ...row, NAFDAC: 'NA' }, { ...row, NAFDAC: '04 – 1486' }]);
  expect(products.map((p) => p.nrn)).toEqual(['A4-6238', '04-1486']);
  expect(dropped).toEqual(['NA']);
});

test('handles missing optional fields', () => {
  const p = normalizeRecord({ NAFDAC: 'B4-0001', product_name: 'X*', expiry_date: 'bad' });
  expect(p).not.toBeNull();
  expect(p!.name).toBe('X');
  expect(p!.regExpiry).toBeNull();
  expect(p!.status).toBe('Unknown');
  expect(p!.atc).toBeNull();
});
```

`tests/scripts/registerPack.test.ts` (checks the real generated pack):
```ts
import { readFileSync } from 'node:fs';
import type { RegisterPack } from '../../src/core/types';

test('real register pack has NAFDAC products including A4-6238', () => {
  const pack = JSON.parse(readFileSync('public/packs/register.json', 'utf8')) as RegisterPack;
  expect(pack.source).toBe('NAFDAC Greenbook');
  expect(pack.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(pack.products.length).toBeGreaterThan(8000);
  const p = pack.products.find((x) => x.nrn === 'A4-6238');
  expect(p?.name).toBe('Artheget EZ');
  expect(p?.strength).toBe('80 mg; 480 mg');
  expect(pack.products.some((x) => x.nrn === 'A4-99231')).toBe(false);
  expect(pack.products.some((x) => x.nrn === 'A4-0999')).toBe(false);
});
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/core/nrn-normalize.test.ts tests/scripts/normalizeRegister.test.ts`
Expected: FAIL, modules not found.

- [x] **Step 3: Implement**

`src/core/parse/nrn.ts`:
```ts
export const NRN_RE = /^([ABC]?\d{1,2})-(\d{4,6}[A-Z]?)$/;

export function normalizeNrn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw
    .toUpperCase()
    .trim()
    .replace(/[‐-―−]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, '');
  return NRN_RE.test(s) ? s : null;
}
```

`scripts/lib/env.ts`:
```ts
import { config } from 'dotenv';

config();

export function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

`scripts/lib/normalizeRegister.ts`:
```ts
import type { Product } from '../../src/core/types';
import { collapseWs, decodeEntities } from '../../src/core/text';
import { normalizeNrn } from '../../src/core/parse/nrn';

export interface GreenbookRow {
  NAFDAC?: string | null;
  product_name?: string | null;
  ingredient_name?: string | null;
  strength?: string | null;
  form_name?: string | null;
  route_name?: string | null;
  applicant_name?: string | null;
  category_name?: string | null;
  expiry_date?: string | null;
  status?: string | null;
  product_description?: string | null;
  pack_size?: string | null;
  atc?: string | null;
}

const clean = (s?: string | null): string => collapseWs(decodeEntities(s ?? ''));

export function normalizeRecord(r: GreenbookRow): Product | null {
  const nrn = normalizeNrn(r.NAFDAC);
  if (!nrn) return null;
  return {
    nrn,
    nrnRaw: (r.NAFDAC ?? '').trim(),
    name: collapseWs(clean(r.product_name).replace(/[#*]/g, '')),
    ingredient: clean(r.ingredient_name),
    strength: clean(r.strength),
    form: clean(r.form_name),
    route: clean(r.route_name),
    applicant: clean(r.applicant_name),
    category: clean(r.category_name),
    regExpiry: r.expiry_date && /^\d{4}-\d{2}-\d{2}$/.test(r.expiry_date) ? r.expiry_date : null,
    status: clean(r.status) || 'Unknown',
    description: clean(r.product_description),
    packSize: clean(r.pack_size),
    atc: r.atc ? clean(r.atc) : null,
  };
}

export function normalizeAll(rows: GreenbookRow[]): { products: Product[]; dropped: string[] } {
  const products: Product[] = [];
  const dropped: string[] = [];
  for (const r of rows) {
    const p = normalizeRecord(r);
    if (p) products.push(p);
    else dropped.push(String(r.NAFDAC ?? ''));
  }
  return { products, dropped };
}
```

`scripts/fetch-register.ts`:
```ts
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
```

- [x] **Step 4: Add the script and fetch real data**

```bash
npm pkg set scripts.data:register="tsx scripts/fetch-register.ts"
npm run data:register
```
Expected output ends with `register.json: ~8,9xx products, dropped <20`. If Greenbook is unreachable, retry once after 60 s. If it is still down, note it in `docs/progress.md` and mark the task `BLOCKED: Greenbook unreachable`.

- [x] **Step 5: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS (including `registerPack.test.ts` against the real file).

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: fetch and normalize the NAFDAC register into an offline pack"
```

---

### Task 4: Alerts fetch and extraction, `data:alerts` (WP API, BrightData, Claude)

Before writing `extractAlert.ts`, invoke the `claude-api` skill to confirm current Anthropic SDK usage. (Implemented with `claude-opus-5` plus structured outputs via `messages.parse` and `zodOutputFormat`, per the skill. A forced tool call conflicts with Opus 5's default thinking.)

**Files:**
- Create: `scripts/lib/alerts.ts`, `scripts/lib/brightdata.ts`, `scripts/lib/extractAlert.ts`, `scripts/fetch-alerts.ts`
- Create (generated, committed): `public/packs/alerts.json`, `data/alerts-cache/*.json`
- Test: `tests/scripts/alerts.test.ts`, `tests/scripts/alertsPack.test.ts`

**Interfaces:**
- Consumes: `Alert`, `AlertKind`, `ALERT_KINDS`, `AlertsPack` (Task 2); `normalizeNrn` (Task 3); `decodeEntities` (Task 2); `env`, `sleep` (Task 3).
- Produces: `alertIdFromTitle(title: string): string | null`; `htmlToText(html: string): string`; `kindFromText(t: string): AlertKind`; `brandFromTitle(title: string): string | null`; `appliesToNigeriaFromTitle(title: string): boolean`; `interface AlertMeta { wpId: number; url: string; date: string; title: string }`; `interface ExtractedAlert`; `normalizeAlert(x: ExtractedAlert, m: AlertMeta): Alert`; `fallbackAlertFromTitle(m: AlertMeta): Alert`; `fetchViaBrightData(url: string): Promise<string>`; `extractAlert(text: string, title: string): Promise<ExtractedAlert>`; the file `public/packs/alerts.json` (`AlertsPack`).

- [x] **Step 1: Install the SDK**

```bash
npm i -D @anthropic-ai/sdk
npm pkg set scripts.data:alerts="tsx scripts/fetch-alerts.ts"
```

- [x] **Step 2: Write the failing test** `tests/scripts/alerts.test.ts`

```ts
import {
  alertIdFromTitle,
  appliesToNigeriaFromTitle,
  brandFromTitle,
  fallbackAlertFromTitle,
  htmlToText,
  kindFromText,
  normalizeAlert,
} from '../../scripts/lib/alerts';

const T35 = 'Public Alert No. 035/2026 – Alert on the Marketing and Sale of Unregistered Menofix Composition';
const T36 = 'Public Alert No. 036/2026 Alert on Suspected Counterfeit Products Mimicking Forxiga® (dapagliflozin)';
const T42 = 'Public Alert No. 042/2026-Alert on the Seizure of Suspected Substandard and Falsified BPPL Artemether/Lumefantrine 80mg/480mg';
const T25 = 'Public Alert No. 025/2026 -Alert on the Recall Specific Batches of Antacid (Citro-Soda regular) in South Africa';
const T9 = 'Public Alert No. 09/2026 - Public Reminder of NAFDAC’s Regulatory Directive';

test('alertIdFromTitle pads the number', () => {
  expect(alertIdFromTitle(T35)).toBe('035/2026');
  expect(alertIdFromTitle(T9)).toBe('009/2026');
  expect(alertIdFromTitle('NAFDAC news item')).toBeNull();
});

test('htmlToText strips tags and decodes entities', () => {
  expect(htmlToText('<p>Batch&nbsp;No: <strong>AB123</strong></p><p>Mfg &#8211; 2025</p>')).toBe('Batch No: AB123\nMfg – 2025');
});

test('kindFromText', () => {
  expect(kindFromText(T35)).toBe('unregistered');
  expect(kindFromText(T36)).toBe('counterfeit');
  expect(kindFromText(T42)).toBe('counterfeit');
  expect(kindFromText(T25)).toBe('recall');
  expect(kindFromText('Alert on adulterated syrup')).toBe('substandard');
  expect(kindFromText('Products placed on watchlist')).toBe('watchlist');
  expect(kindFromText('General notice')).toBe('other');
});

test('brandFromTitle strips alert phrasing', () => {
  expect(brandFromTitle(T35)).toBe('Menofix Composition');
  expect(brandFromTitle(T36)).toMatch(/^Forxiga/);
  expect(brandFromTitle(T42)).toBe('BPPL Artemether/Lumefantrine 80mg/480mg');
  expect(brandFromTitle(T25)).toBe('Antacid');
});

test('appliesToNigeriaFromTitle is false for foreign recalls only', () => {
  expect(appliesToNigeriaFromTitle(T25)).toBe(false);
  expect(appliesToNigeriaFromTitle(T35)).toBe(true);
});

test('fallbackAlertFromTitle builds a usable alert', () => {
  const a = fallbackAlertFromTitle({ wpId: 1, url: 'https://x', date: '2026-07-01', title: T35 });
  expect(a).toMatchObject({ id: '035/2026', kind: 'unregistered', appliesToNigeria: true });
  expect(a.products[0]).toEqual({ brand: 'Menofix Composition', ingredient: null, strength: null, manufacturer: null, nrn: null, batches: [] });
});

test('normalizeAlert cleans extracted output', () => {
  const a = normalizeAlert(
    {
      kind: 'counterfeit',
      summary: 'x'.repeat(400),
      appliesToNigeria: true,
      products: [{ brand: ' Forxiga ', ingredient: 'dapagliflozin', strength: '10 mg', manufacturer: null, nrn: 'b4 - 1234', batches: ['ab 12', 'cd34'] }],
    },
    { wpId: 2, url: 'https://y', date: '2026-08-01', title: T36 },
  );
  expect(a.id).toBe('036/2026');
  expect(a.summary.length).toBe(280);
  expect(a.products[0]).toEqual({ brand: 'Forxiga', ingredient: 'dapagliflozin', strength: '10 mg', manufacturer: null, nrn: 'B4-1234', batches: ['AB12', 'CD34'] });
});

test('normalizeAlert falls back to the title brand when no products were extracted', () => {
  const a = normalizeAlert({ kind: 'unregistered', summary: 's', appliesToNigeria: true, products: [] }, { wpId: 3, url: 'u', date: '2026-07-01', title: T35 });
  expect(a.products[0].brand).toBe('Menofix Composition');
});
```

- [x] **Step 3: Run to verify failure**

Run: `npx vitest run tests/scripts/alerts.test.ts`
Expected: FAIL, module not found.

- [x] **Step 4: Implement**

`scripts/lib/alerts.ts`:
```ts
import { ALERT_KINDS, type Alert, type AlertKind } from '../../src/core/types';
import { decodeEntities } from '../../src/core/text';
import { normalizeNrn } from '../../src/core/parse/nrn';

export interface AlertMeta {
  wpId: number;
  url: string;
  date: string;
  title: string;
}

export interface ExtractedAlert {
  kind: AlertKind;
  summary: string;
  appliesToNigeria: boolean;
  products: {
    brand: string | null;
    ingredient: string | null;
    strength: string | null;
    manufacturer: string | null;
    nrn: string | null;
    batches: string[];
  }[];
}

export function alertIdFromTitle(title: string): string | null {
  const m = title.match(/Public\s+Alert\s+No\.?\s*(\d{1,3})\s*\/\s*(\d{4})/i);
  return m ? `${m[1].padStart(3, '0')}/${m[2]}` : null;
}

export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(stripped)
    .replace(/[ \t ]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

export function kindFromText(t: string): AlertKind {
  const s = t.toLowerCase();
  if (/unregistered|not registered/.test(s)) return 'unregistered';
  if (/counterfeit|falsified|fake/.test(s)) return 'counterfeit';
  if (/recall/.test(s)) return 'recall';
  if (/substandard|adulterated|contaminat/.test(s)) return 'substandard';
  if (/watchlist/.test(s)) return 'watchlist';
  return 'other';
}

const LEADING = [
  /^alert on\s+/i,
  /^the\s+/i,
  /^seizure of\s+/i,
  /^marketing and sale of\s+/i,
  /^recall(ed)?\s+(of\s+)?/i,
  /^specific batches of\s+/i,
  /^suspected\s+/i,
  /^substandard and falsified\s+/i,
  /^counterfeit\s+/i,
  /^falsified\s+/i,
  /^substandard\s+/i,
  /^unregistered\s+/i,
  /^adulterated\s+/i,
  /^products mimicking\s+/i,
  /^and\s+/i,
];

export function brandFromTitle(title: string): string | null {
  let s = title.replace(/^.*?Public\s+Alert\s+No\.?\s*\d+\s*\/\s*\d{4}\s*[-–—:]?\s*/i, '').trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of LEADING) {
      if (re.test(s)) {
        s = s.replace(re, '');
        changed = true;
      }
    }
  }
  s = s
    .replace(/\(.*?\)/g, '')
    .replace(/\s+(in|by|from)\s+.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s ? s.slice(0, 80) : null;
}

export function appliesToNigeriaFromTitle(title: string): boolean {
  if (/nigeria/i.test(title)) return true;
  return !/(south africa|pakistan|india|europe|united states|united kingdom|canada|australia)/i.test(title);
}

function titleProduct(title: string) {
  return { brand: brandFromTitle(title), ingredient: null, strength: null, manufacturer: null, nrn: null, batches: [] as string[] };
}

export function fallbackAlertFromTitle(m: AlertMeta): Alert {
  return {
    id: alertIdFromTitle(m.title) ?? `wp-${m.wpId}`,
    wpId: m.wpId,
    url: m.url,
    date: m.date,
    title: m.title,
    kind: kindFromText(m.title),
    products: [titleProduct(m.title)],
    summary: m.title.slice(0, 280),
    appliesToNigeria: appliesToNigeriaFromTitle(m.title),
  };
}

const trimOrNull = (s: string | null | undefined): string | null => (s && s.trim() ? s.trim() : null);

export function normalizeAlert(x: ExtractedAlert, m: AlertMeta): Alert {
  const products = (x.products ?? []).map((p) => ({
    brand: trimOrNull(p.brand),
    ingredient: trimOrNull(p.ingredient),
    strength: trimOrNull(p.strength),
    manufacturer: trimOrNull(p.manufacturer),
    nrn: normalizeNrn(p.nrn),
    batches: (p.batches ?? []).map((b) => b.toUpperCase().replace(/\s+/g, '')).filter(Boolean),
  }));
  return {
    id: alertIdFromTitle(m.title) ?? `wp-${m.wpId}`,
    wpId: m.wpId,
    url: m.url,
    date: m.date,
    title: m.title,
    kind: ALERT_KINDS.includes(x.kind) ? x.kind : 'other',
    products: products.length ? products : [titleProduct(m.title)],
    summary: (x.summary ?? '').slice(0, 280),
    appliesToNigeria: x.appliesToNigeria !== false,
  };
}
```

`scripts/lib/brightdata.ts`:
```ts
import { env } from './env';

export async function fetchViaBrightData(url: string): Promise<string> {
  const key = env('BRIGHTDATA_API_KEY');
  const zone = env('BRIGHTDATA_ZONE') ?? 'web_unlocker1';
  if (!key) throw new Error('BRIGHTDATA_API_KEY not set');
  const res = await fetch('https://api.brightdata.com/request', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ zone, url, format: 'raw' }),
  });
  if (!res.ok) throw new Error(`BrightData HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return await res.text();
}
```

`scripts/lib/extractAlert.ts`:
```ts
import Anthropic from '@anthropic-ai/sdk';
import { ALERT_KINDS } from '../../src/core/types';
import type { ExtractedAlert } from './alerts';

const MODEL = 'claude-haiku-4-5-20251001';

const nullableString = { type: ['string', 'null'] };

const TOOL = {
  name: 'record_alert',
  description: 'Record the structured facts stated in one NAFDAC public alert.',
  input_schema: {
    type: 'object' as const,
    properties: {
      kind: { type: 'string', enum: [...ALERT_KINDS] },
      summary: { type: 'string', description: 'Plain English, at most 280 characters.' },
      appliesToNigeria: {
        type: 'boolean',
        description: 'false only when the alert relays a foreign recall and says the product is not known to be in Nigeria.',
      },
      products: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            brand: nullableString,
            ingredient: nullableString,
            strength: nullableString,
            manufacturer: nullableString,
            nrn: { ...nullableString, description: 'NAFDAC registration number if stated, e.g. A4-1234' },
            batches: { type: 'array', items: { type: 'string' }, description: 'Batch or lot numbers exactly as printed.' },
          },
          required: ['brand', 'ingredient', 'strength', 'manufacturer', 'nrn', 'batches'],
        },
      },
    },
    required: ['kind', 'summary', 'appliesToNigeria', 'products'],
  },
};

let client: Anthropic | null = null;

export async function extractAlert(text: string, title: string): Promise<ExtractedAlert> {
  client ??= new Anthropic();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: TOOL.name },
    messages: [
      {
        role: 'user',
        content: `Extract the facts from this NAFDAC public alert. Use null for anything not stated. Copy batch numbers exactly.\n\nTITLE: ${title}\n\nTEXT:\n${text.slice(0, 12000)}`,
      },
    ],
  });
  const block = msg.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') throw new Error('Claude returned no tool_use block');
  return block.input as ExtractedAlert;
}
```

`scripts/fetch-alerts.ts`:
```ts
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
```

- [x] **Step 5: Run unit tests**

Run: `npx vitest run tests/scripts/alerts.test.ts`
Expected: PASS. If a `brandFromTitle` case fails, adjust `LEADING` (not the expected values).

- [x] **Step 6: Generate the real alerts pack**

Run: `npm run data:alerts`
- With `ANTHROPIC_API_KEY` set: Claude extraction (about 60–120 alerts, under $1).
- Without it: title fallback. Log in `docs/progress.md`: "alerts used title fallback; rerun `npm run data:alerts` after adding ANTHROPIC_API_KEY". Do **not** mark the task blocked.
- To use the BrightData credits as well: when `BRIGHTDATA_API_KEY` is set, delete five cache files and refetch them through BrightData: `ls data/alerts-cache/*.json | head -5 | xargs rm -f && npm run data:alerts -- --via=brightdata --limit=200`. Only uncached alerts go through BrightData.

- [x] **Step 7: Write `tests/scripts/alertsPack.test.ts`**

```ts
import { readFileSync } from 'node:fs';
import type { AlertsPack } from '../../src/core/types';

test('real alerts pack is well formed and includes the Menofix unregistered alert', () => {
  const pack = JSON.parse(readFileSync('public/packs/alerts.json', 'utf8')) as AlertsPack;
  expect(pack.alerts.length).toBeGreaterThanOrEqual(20);
  for (const a of pack.alerts) {
    expect(a.id).toMatch(/^(\d{3}\/\d{4}|wp-\d+)$/);
    expect(a.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(a.products.length).toBeGreaterThan(0);
  }
  const menofix = pack.alerts.find((a) => a.products.some((p) => /menofix/i.test(p.brand ?? '')));
  expect(menofix?.kind).toBe('unregistered');
});
```

Run: `npm test && npm run typecheck`
Expected: PASS. If the Menofix alert is missing because NAFDAC removed it, change the test to the newest `unregistered` alert and update the demo carton 5 brand in Task 16 to that alert's brand. Note the change in `docs/progress.md`.

- [x] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: fetch NAFDAC public alerts and extract them with Claude into an offline pack"
```

---

### Task 5: sha256, manifest builder and version compare

**Files:**
- Create: `src/core/sha.ts`, `src/core/manifest.ts`, `scripts/build-manifest.ts`
- Create (generated, committed): `public/packs/manifest.json`
- Test: `tests/unit/core/sha.test.ts`, `tests/unit/core/manifest.test.ts`

**Interfaces:**
- Consumes: `Manifest`, `PackEntry`, `DEFAULT_THRESHOLDS`, `RegisterPack`, `AlertsPack` (Task 2).
- Produces: `sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string>`; `compareVersions(a: string, b: string): number` (<0, 0, >0); `validateManifest(x: unknown): Manifest` (throws `Error('invalid manifest')`); `public/packs/manifest.json`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/core/sha.test.ts`:
```ts
// @vitest-environment node
import { sha256Hex } from '../../../src/core/sha';

test('sha256 of "abc"', async () => {
  expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('sha256 of bytes equals sha256 of the same string', async () => {
  expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe(await sha256Hex('abc'));
});
```

`tests/unit/core/manifest.test.ts`:
```ts
import { compareVersions, validateManifest } from '../../../src/core/manifest';
import { DEFAULT_THRESHOLDS } from '../../../src/core/types';

test('compareVersions orders dates and numeric suffixes', () => {
  expect(compareVersions('2026-10-03', '2026-10-02')).toBeGreaterThan(0);
  expect(compareVersions('2026-10-03', '2026-10-03')).toBe(0);
  expect(compareVersions('2026-10-03-2', '2026-10-03')).toBeGreaterThan(0);
  expect(compareVersions('2026-10-03-10', '2026-10-03-9')).toBeGreaterThan(0);
  expect(compareVersions('2026-09-30-5', '2026-10-01')).toBeLessThan(0);
});

const entry = { version: '2026-10-03', file: 'register.json', sha256: 'a'.repeat(64), count: 1, bytes: 1 };

test('validateManifest accepts a manifest and fills default thresholds', () => {
  const m = validateManifest({ schema: 1, generatedAt: 'x', packs: { register: entry, alerts: { ...entry, file: 'alerts.json' } } });
  expect(m.thresholds).toEqual(DEFAULT_THRESHOLDS);
});

test('validateManifest rejects bad input', () => {
  expect(() => validateManifest(null)).toThrow('invalid manifest');
  expect(() => validateManifest({ schema: 2 })).toThrow('invalid manifest');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/core/sha.test.ts tests/unit/core/manifest.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/core/sha.ts`:
```ts
export async function sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
```

`src/core/manifest.ts`:
```ts
import { DEFAULT_THRESHOLDS, type Manifest } from './types';

function split(v: string): { date: string; n: number } {
  const m = /^(\d{4}-\d{2}-\d{2})(?:-(\d+))?$/.exec(v);
  return m ? { date: m[1], n: Number(m[2] ?? 0) } : { date: v, n: 0 };
}

export function compareVersions(a: string, b: string): number {
  const pa = split(a);
  const pb = split(b);
  if (pa.date !== pb.date) return pa.date < pb.date ? -1 : 1;
  return pa.n - pb.n;
}

export function validateManifest(x: unknown): Manifest {
  const m = x as Partial<Manifest> | null;
  if (!m || m.schema !== 1 || !m.packs?.register?.sha256 || !m.packs?.alerts?.sha256) throw new Error('invalid manifest');
  return { ...(m as Manifest), thresholds: { ...DEFAULT_THRESHOLDS, ...(m.thresholds ?? {}) } };
}
```

`scripts/build-manifest.ts`:
```ts
import { readFile, writeFile } from 'node:fs/promises';
import { sha256Hex } from '../src/core/sha';
import { DEFAULT_THRESHOLDS, type AlertsPack, type Manifest, type PackEntry, type RegisterPack } from '../src/core/types';

async function entry<T extends { version: string }>(file: string, count: (j: T) => number): Promise<PackEntry> {
  const text = await readFile(`public/packs/${file}`, 'utf8');
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
await writeFile('public/packs/manifest.json', JSON.stringify(manifest, null, 2));
console.log(`manifest.json: register ${manifest.packs.register.count} (${manifest.packs.register.version}), alerts ${manifest.packs.alerts.count}`);
```

- [ ] **Step 4: Add scripts, generate, test**

```bash
npm pkg set scripts.data:manifest="tsx scripts/build-manifest.ts" scripts.data="npm run data:register && npm run data:alerts && npm run data:manifest"
npm run data:manifest
npm test && npm run typecheck
```
Expected: manifest written, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add pack manifest with sha256 and version ordering"
```
