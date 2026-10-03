# Phase 7: Polish backlog (no API keys needed)

> Part of `docs/superpowers/plans/2026-10-03-dawacheck.md`. Read its Global Constraints first. Every task here works without any API key. Tasks are ordered by value for the submission (video, live app, repo). Each task that changes the app ends with the gates and a deploy (`docs/LOOP.md`, "Deploy").

Conventions for this phase:
- Unit tests use Vitest globals (`test`, `expect`, `vi`) like the existing tests.
- New UI strings go in `src/i18n/en.ts`, `pcm.ts` and `ha.ts` (values below). Yoruba and Igbo get them in Task 33. `translate()` falls back to English until then.
- Never log free text (search queries included) in events.
- Copy rules still apply: no "safe", "genuine" or "authentic"; no dosing advice; codes use class `code`.

---

### Task 26: Speak verdicts on the phone when no recorded clips exist

ElevenLabs clips are blocked on a key. iPhones and Android phones ship offline English voices, so English and Pidgin verdicts can be spoken today. Hausa, Yoruba and Igbo have no reliable system voice, so they stay text-only until clips exist.

**Files:**
- Create: `src/voice/speech.ts`, `tests/unit/speech.test.ts`
- Modify: `src/components/ListenButton.tsx`, `src/i18n/en.ts`, `pcm.ts`, `ha.ts`, `tests/unit/voice.test.ts` (ListenButton fallback test)

**Interfaces:**
- Consumes: `playClip(key, lang)` (`src/voice/player.ts`), `CLIPS`, `voiceLangFor` (`src/voice/clips.ts`)
- Produces: `pickVoice(voices: SpeechSynthesisVoice[], lang: Lang): SpeechSynthesisVoice | null`, `speak(text: string, lang: Lang, synth?: SynthLike, Utterance?: UtteranceCtor): Promise<boolean>`

- [x] **Step 1: Write the failing tests** `tests/unit/speech.test.ts`

```ts
import { pickVoice, speak } from '../../src/voice/speech';

const voice = (lang: string, localService = true, name = lang) => ({ lang, localService, name, default: false, voiceURI: name }) as SpeechSynthesisVoice;

class FakeUtterance {
  text: string; voice: SpeechSynthesisVoice | null = null; lang = ''; rate = 1;
  onend: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor(text: string) { this.text = text; }
}

function fakeSynth(voices: SpeechSynthesisVoice[], outcome: 'end' | 'error' = 'end') {
  const spoken: FakeUtterance[] = [];
  return {
    spoken,
    getVoices: () => voices,
    cancel: vi.fn(),
    speak: (u: FakeUtterance) => { spoken.push(u); queueMicrotask(() => (outcome === 'end' ? u.onend?.() : u.onerror?.())); },
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  };
}

test('prefers a local Nigerian English voice, then British, then US', () => {
  expect(pickVoice([voice('en-US'), voice('en-GB'), voice('en-NG')], 'en')?.lang).toBe('en-NG');
  expect(pickVoice([voice('en-US'), voice('en-GB')], 'pcm')?.lang).toBe('en-GB');
  expect(pickVoice([voice('en_US')], 'en')?.lang).toBe('en_US');
});

test('ignores network voices and has no voice for Hausa, Yoruba or Igbo', () => {
  expect(pickVoice([voice('en-NG', false)], 'en')).toBeNull();
  for (const l of ['ha', 'yo', 'ig'] as const) expect(pickVoice([voice('en-US')], l)).toBeNull();
});

test('speak resolves true when speech ends and uses the picked voice', async () => {
  const s = fakeSynth([voice('en-US')]);
  await expect(speak('Registered with NAFDAC', 'en', s as never, FakeUtterance as never)).resolves.toBe(true);
  expect(s.spoken[0].text).toBe('Registered with NAFDAC');
  expect(s.spoken[0].voice?.lang).toBe('en-US');
});

test('speak resolves false on error, for Hausa, and when speech is unsupported', async () => {
  await expect(speak('x', 'en', fakeSynth([voice('en-US')], 'error') as never, FakeUtterance as never)).resolves.toBe(false);
  const s = fakeSynth([voice('en-US')]);
  await expect(speak('x', 'ha', s as never, FakeUtterance as never)).resolves.toBe(false);
  expect(s.spoken).toHaveLength(0);
  await expect(speak('x', 'en', undefined, undefined)).resolves.toBe(false);
});
```

- [x] **Step 2: Run** `npx vitest run tests/unit/speech.test.ts`. Expected: FAIL (module not found).

- [x] **Step 3: Implement** `src/voice/speech.ts`

```ts
import type { Lang } from '../core/types';

export interface SynthLike {
  getVoices(): SpeechSynthesisVoice[];
  speak(u: SpeechSynthesisUtterance): void;
  cancel(): void;
  addEventListener?(type: 'voiceschanged', cb: () => void): void;
  removeEventListener?(type: 'voiceschanged', cb: () => void): void;
}
type UtteranceCtor = new (text: string) => SpeechSynthesisUtterance;

const PREFERRED = ['en-ng', 'en-gb', 'en-us'];

export function pickVoice(voices: SpeechSynthesisVoice[], lang: Lang): SpeechSynthesisVoice | null {
  if (lang !== 'en' && lang !== 'pcm') return null;
  const local = voices.filter((v) => v.localService && v.lang.toLowerCase().replace('_', '-').startsWith('en'));
  for (const p of PREFERRED) {
    const v = local.find((x) => x.lang.toLowerCase().replace('_', '-') === p);
    if (v) return v;
  }
  return local[0] ?? null;
}

/** iOS fills the voice list a moment after load. Wait up to 1 s for it. */
function voices(synth: SynthLike): Promise<SpeechSynthesisVoice[]> {
  const now = synth.getVoices();
  if (now.length || !synth.addEventListener) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => { synth.removeEventListener?.('voiceschanged', done); resolve(synth.getVoices()); };
    synth.addEventListener!('voiceschanged', done);
    setTimeout(done, 1000);
  });
}

export async function speak(
  text: string,
  lang: Lang,
  synth: SynthLike | undefined = globalThis.speechSynthesis,
  Utterance: UtteranceCtor | undefined = globalThis.SpeechSynthesisUtterance,
): Promise<boolean> {
  if (!synth || !Utterance) return false;
  const voice = pickVoice(await voices(synth), lang);
  if (!voice) return false;
  return new Promise((resolve) => {
    const u = new Utterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.95;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    synth.cancel();
    synth.speak(u);
  });
}
```

- [x] **Step 4: Run** the test again. Expected: PASS.

- [x] **Step 5: Wire ListenButton.** On click: `const ok = await playClip(clip, lang)`; if `!ok`, `const spoke = await speak(CLIPS[clip][voiceLangFor(lang)], lang)`; if neither worked, show `<span className="small muted" role="status" data-testid="voice-unavailable">{t('voice_unavailable')}</span>` under the button. Log `voice_played` with `{ key, lang, ok, fallback: spoke }`. Leave `autoPlay` on clips only (browsers block speech without a tap). New keys:
  - `voice_unavailable`: en "Voice is not available on this phone. Read the text above." · pcm "Voice no dey for this phone. Read the writing for top." · ha "Babu murya a wannan wayar. Karanta rubutun da ke sama."

- [x] **Step 6: ListenButton test** in `tests/unit/ui/listen.test.tsx`: `vi.mock('../../../src/voice/player', () => ({ playClip: vi.fn(async () => false) }))` and `vi.mock('../../../src/voice/speech', () => ({ speak: vi.fn(async () => true) }))`; render `<ListenButton clip="v_green" />` inside `AppProvider` (loader as in `tests/unit/ui/report.test.tsx`, language English), click "Listen", expect `speak` called with `CLIPS.v_green.en` and `'en'`, and no `voice-unavailable`. Second case: `speak` resolves false, expect `voice-unavailable` visible.

- [x] **Step 7: Verify and ship.** `npm run verify && npm run test:ocr`, then deploy (LOOP.md). Commit `feat: speak English and Pidgin verdicts with the phone's own voice when clips are missing`.

---

### Task 27: Dashboard shows labelled example data when the backend is off

Production has sync off until Supabase keys exist, so `/#/dashboard` is empty. The video needs the regulator view, so show clearly labelled example data instead of an empty page.

**Files:**
- Create: `src/demo/dashboardExample.ts`, `tests/unit/dashboardExample.test.tsx`
- Modify: `src/screens/Dashboard.tsx`

**Interfaces:**
- Consumes: `syncConfig()` (`src/sync/config.ts`), the `Activity/ByState/ByReason/Unknown/Flag` shapes in `Dashboard.tsx` (export them)
- Produces: `EXAMPLE_DASHBOARD: { a: Activity; s: ByState[]; r: ByReason[]; u: Unknown[]; f: Flag[] }`

- [ ] **Step 1: Failing tests** in `tests/unit/dashboardExample.test.tsx`:
  - `vi.mock('../../src/sync/config', ...)` so `syncConfig()` returns `{ mode: 'off', ... }` and `vi.mock('../../src/sync/api', () => ({ getView: vi.fn() }))`. Render `<MemoryRouter><Dashboard /></MemoryRouter>`. Expect `screen.getByTestId('example-notice')` to contain "example data", the pill to contain "Example data", the checks KPI to show `EXAMPLE_DASHBOARD.a.checks`, and `getView` not called.
  - Every NRN in `EXAMPLE_DASHBOARD.u` and `EXAMPLE_DASHBOARD.f` is absent from `public/packs/register.json` (read it with `node:fs`; build a `Set` of `products[].nrn`). This guards against showing a real product as reported.

- [ ] **Step 2: Run** them. Expected: FAIL.

- [ ] **Step 3: Implement.** `src/demo/dashboardExample.ts` copies the numbers that `scripts/mock-supabase.ts` seeds for the dashboard (same fictional NRNs, the ones shown in `deck/img/06-dashboard.png`). In `Dashboard.tsx`: when `cfg.mode === 'off'`, skip fetching, set data to `EXAMPLE_DASHBOARD`, and render above the grid `<p className="card small" data-testid="example-notice">Live reports need the DawaCheck backend. This page shows example data.</p>`. The pill reads `Last 7 days · Example data` for both `mock` and `off`.

- [ ] **Step 4: Run** tests. Expected: PASS.

- [ ] **Step 5: Verify and ship.** Gates, deploy, then open `https://dawacheck-smoky.vercel.app/#/dashboard` in the browser pane and confirm the notice shows. Commit `feat: labelled example data on the dashboard when the backend is off`.

---

### Task 28: Keep offline data on the phone and help iPhone users install

Browsers can evict the 16.7 MB offline data under storage pressure. `navigator.storage.persist()` asks them not to. iPhones have no install prompt, so users need a hint to use "Add to Home Screen".

**Files:**
- Create: `src/lib/install.ts`, `tests/unit/install.test.ts`
- Modify: `src/state/AppContext.tsx`, `src/screens/Home.tsx`, `src/screens/Settings.tsx`, `src/i18n/en.ts`, `pcm.ts`, `ha.ts`, `tests/e2e/smoke.spec.ts`, `tests/e2e/mvp.spec.ts`

**Interfaces:**
- Produces: `isIos(ua: string, maxTouchPoints: number): boolean`, `isStandalone(w?: Window): boolean`, `requestPersistence(storage?): Promise<'granted' | 'denied' | 'unsupported'>`, `INSTALL_HINT_KEY = 'dc_install_hint_dismissed'`; `AppApi.storagePersisted: 'granted' | 'denied' | 'unsupported' | null`

- [ ] **Step 1: Failing tests** `tests/unit/install.test.ts`

```ts
import { isIos, isStandalone, requestPersistence } from '../../src/lib/install';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

test('detects iPhone and iPadOS, not Android or a Mac', () => {
  expect(isIos(IPHONE, 5)).toBe(true);
  expect(isIos(IPAD_DESKTOP, 5)).toBe(true);
  expect(isIos(IPAD_DESKTOP, 0)).toBe(false);
  expect(isIos(ANDROID, 5)).toBe(false);
});

test('standalone from display-mode or navigator.standalone', () => {
  const w = (matches: boolean, standalone?: boolean) => ({ matchMedia: () => ({ matches }), navigator: { standalone } }) as unknown as Window;
  expect(isStandalone(w(true))).toBe(true);
  expect(isStandalone(w(false, true))).toBe(true);
  expect(isStandalone(w(false))).toBe(false);
});

test('persistence: already kept, granted, denied, unsupported', async () => {
  const persist = vi.fn(async () => true);
  expect(await requestPersistence({ persisted: async () => true, persist })).toBe('granted');
  expect(persist).not.toHaveBeenCalled();
  expect(await requestPersistence({ persisted: async () => false, persist: async () => true })).toBe('granted');
  expect(await requestPersistence({ persisted: async () => false, persist: async () => false })).toBe('denied');
  expect(await requestPersistence(null)).toBe('unsupported');
});
```

- [ ] **Step 2: Run.** Expected: FAIL.

- [ ] **Step 3: Implement** `src/lib/install.ts`

```ts
export const INSTALL_HINT_KEY = 'dc_install_hint_dismissed';

export function isIos(ua: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && maxTouchPoints > 1;
}

export function isStandalone(w: Window = window): boolean {
  const nav = w.navigator as Navigator & { standalone?: boolean };
  return w.matchMedia?.('(display-mode: standalone)').matches === true || nav?.standalone === true;
}

type Persist = Pick<StorageManager, 'persist' | 'persisted'>;

export async function requestPersistence(storage: Persist | null | undefined = globalThis.navigator?.storage): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!storage?.persist || !storage.persisted) return 'unsupported';
  try {
    if (await storage.persisted()) return 'granted';
    return (await storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}
```

- [ ] **Step 4: Run.** Expected: PASS.

- [ ] **Step 5: Wire it.**
  - `AppContext`: once packs are ready, call `requestPersistence()` once and keep the result in `storagePersisted`.
  - `Settings`: a row `t('storage_title')` showing `t('storage_kept')` when granted, else `t('storage_maybe')`.
  - `Home`: when `isIos(navigator.userAgent, navigator.maxTouchPoints) && !isStandalone()` and `localStorage[INSTALL_HINT_KEY] !== '1'` (wrap storage access in try/catch), show `<div className="card small" data-testid="install-hint">` with `t('install_ios')` and a button `t('dismiss')` that sets the key and hides the card.
  - New keys:
    - `install_ios`: en "Install DawaCheck: tap Share, then Add to Home Screen. It then works with no internet." · pcm "Install DawaCheck: press Share, then Add to Home Screen. E go work without internet." · ha "Don saka DawaCheck: danna Share, sannan Add to Home Screen. Daga nan zai yi aiki ba tare da intanet ba."
    - `dismiss`: en "Close" · pcm "Close am" · ha "Rufe"
    - `storage_title`: en "Offline data" · pcm "Offline data" · ha "Bayanan da ke wayar"
    - `storage_kept`: en "Kept on this phone." · pcm "E go stay for this phone." · ha "An ajiye su a wannan wayar."
    - `storage_maybe`: en "The browser may clear it if the phone runs low on space. Install the app to keep it." · pcm "Browser fit clear am if phone space no reach. Install the app make e stay." · ha "Mai bincike zai iya share su idan wayar ta cika. Saka manhajar don a ajiye su."

- [ ] **Step 6: E2E.** `tests/e2e/smoke.spec.ts` (webkit, iPhone 14): after onboarding, `install-hint` is visible; click "Close"; it is hidden; reload; still hidden. `tests/e2e/mvp.spec.ts` first test (Chromium, Pixel 7): `await expect(page.getByTestId('install-hint')).toHaveCount(0)`.

- [ ] **Step 7: Verify and ship.** Commit `feat: keep offline data and show an iPhone install hint`.

---

### Task 29: Find a medicine by name, offline

When the number on the box is unreadable, users can search the register by brand, ingredient or a partial NAFDAC number and compare the box with what NAFDAC registered.

**Files:**
- Create: `src/core/search.ts`, `tests/unit/core/search.test.ts`, `src/screens/FindByName.tsx`, `src/screens/ProductDetail.tsx`, `tests/e2e/find.spec.ts`
- Modify: `src/App.tsx` (routes `/find` and `/product/:nrn`), `src/screens/Home.tsx`, `src/screens/Result.tsx`, `src/i18n/en.ts`, `pcm.ts`, `ha.ts`

**Interfaces:**
- Consumes: `RegisterIndex` (`src/core/registerIndex.ts`), `normalizeText` (`src/core/text.ts`)
- Produces: `searchRegister(idx: RegisterIndex, query: string, limit = 20): Product[]`

Rules:
- Normalize query and fields with `normalizeText`, uppercase, split on `/[^A-Z0-9]+/`, drop empties. A query with fewer than 3 letters or digits returns `[]`.
- Name match: every query token is a prefix of a token of `name` (2 points each) or of `ingredient` (1 point each). Any token that matches neither excludes the product.
- NRN match: when the compact query (letters and digits only) starts with an optional A/B/C and then a digit, a product whose NRN without the hyphen starts with it scores 3.
- Rank: score (high first), then `status === 'Active'` first, then name A to Z, then NRN. Apply `limit` last.
- Build per-product token lists once per `RegisterIndex` (memoize in a `WeakMap`).

- [ ] **Step 1: Failing tests** `tests/unit/core/search.test.ts`

```ts
import { buildRegisterIndex } from '../../../src/core/registerIndex';
import { searchRegister } from '../../../src/core/search';
import { REGISTER, product } from '../../helpers/fixtures';

const idx = buildRegisterIndex(REGISTER);
const names = (q: string, i = idx) => searchRegister(i, q).map((p) => p.name);

test('brand prefix in any case', () => {
  expect(names('arthe')).toEqual(['Artheget EZ']);
  expect(names('ARTHEGET ez')).toEqual(['Artheget EZ']);
});

test('needs at least 3 letters or digits', () => {
  expect(names('ar')).toEqual([]);
  expect(names('  - ')).toEqual([]);
});

test('every word must match', () => {
  expect(names('coflu syr')).toEqual(['Coflu Syrup']);
  expect(names('coflu')).toEqual(['Coflu Syrup', 'Coflu Tablets']);
  expect(names('coflu forte')).toEqual([]);
});

test('ingredient matches count', () => {
  expect(names('artemether')).toEqual(['Artheget EZ']);
  expect(names('albendazole')).toEqual(['Zentel Plus']);
});

test('active products come before inactive ones', () => {
  const i = buildRegisterIndex({ ...REGISTER, products: [...REGISTER.products, product({ nrn: 'B4-9999', name: 'Oldcillin Forte', ingredient: 'Amoxicillin' })] });
  expect(names('oldc', i)).toEqual(['Oldcillin Forte', 'Oldcillin']);
});

test('NAFDAC number prefix, with or without the hyphen', () => {
  expect(searchRegister(idx, 'A4-62').map((p) => p.nrn)).toEqual(['A4-6238', 'A4-6298']);
  expect(searchRegister(idx, 'a46238').map((p) => p.nrn)).toEqual(['A4-6238']);
});

test('limit', () => {
  expect(searchRegister(idx, 'coflu', 1)).toHaveLength(1);
});
```

- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `src/core/search.ts` to the rules above. Keep it pure (no DOM, no Dexie).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Screens.**
  - `FindByName` (`/find`, reads `?q=` with `useSearchParams` as the initial value): `<input type="search" data-testid="find-input" autoFocus>` with placeholder `t('find_placeholder')`; under 3 characters show `t('find_hint')`; no results show `t('find_none')`; otherwise `t('find_count', { n })` and a list of links to `/product/<nrn>`, each with the name, strength and form, the NRN in `<span className="code">`, and `t('status_active')` or `t('status_inactive')`.
  - `ProductDetail` (`/product/:nrn`): every product under that NRN with name as `<h2>`, strength, form, ingredient, applicant, NAFDAC description, pack size, registration expiry (`code`), status, then `t('product_note')`. Reuse existing field-label keys from `VerdictView` where they exist.
  - Home: `<Link to="/find" className="btn btn-outline">{t('home_find')}</Link>` under "Type the number".
  - Result: for `unknown` verdicts and `not_in_register`, add `<Link to={'/find?q=' + encodeURIComponent(name)}>{t('result_find')}</Link>` when the scan or typed input has a product name; otherwise link to `/find`.
  - New keys:
    - `home_find`: en "Find a medicine by name" · pcm "Find medicine by name" · ha "Nemo magani da suna"
    - `find_title`: en "Find by name" · pcm "Find by name" · ha "Nemo da suna"
    - `find_placeholder`: en "Medicine name or NAFDAC number" · pcm "Medicine name or NAFDAC number" · ha "Sunan magani ko lambar NAFDAC"
    - `find_hint`: en "Type at least 3 letters." · pcm "Type at least 3 letters." · ha "Rubuta aƙalla haruffa 3."
    - `find_none`: en "No registered medicine matches." · pcm "No registered medicine match am." · ha "Babu maganin da aka yi wa rajista da ya yi daidai."
    - `find_count`: en "{n} found" · pcm "{n} dey" · ha "An samu {n}"
    - `status_active`: en "Active" · pcm "Active" · ha "Mai aiki"
    - `status_inactive`: en "Not active" · pcm "No active" · ha "Ba ya aiki"
    - `product_note`: en "This is what NAFDAC registered. Compare it with your box. DawaCheck cannot test what is inside." · pcm "Na wetin NAFDAC register be dis. Compare am with your box. DawaCheck no fit test wetin dey inside." · ha "Wannan shi ne abin da NAFDAC ta yi wa rajista. Kwatanta shi da kwalinka. DawaCheck ba ta iya gwada abin da ke ciki ba."
    - `result_find`: en "Find this medicine by name" · pcm "Find this medicine by name" · ha "Nemo wannan magani da suna"
- [ ] **Step 6: E2E** `tests/e2e/find.spec.ts`

```ts
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('find a medicine by name and read what NAFDAC registered', async ({ page }) => {
  await onboard(page);
  await page.getByRole('link', { name: 'Find a medicine by name' }).click();
  await page.getByTestId('find-input').fill('artheget');
  await page.getByRole('link', { name: /Artheget EZ/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Artheget EZ' }).first()).toBeVisible();
  await expect(page.getByText('A4-6238').first()).toBeVisible();
  await expect(page.getByText('This is what NAFDAC registered.', { exact: false })).toBeVisible();
});
```

- [ ] **Step 7: Verify and ship.** Commit `feat: find a medicine by name offline`.

---

### Task 30: NAFDAC alerts list, offline

Vendors and health workers can browse and search all NAFDAC alerts stored on the phone, and the red alert verdict links to its alert.

**Files:**
- Create: `src/core/alertSearch.ts`, `tests/unit/core/alertSearch.test.ts`, `src/screens/Alerts.tsx`, `src/screens/AlertDetail.tsx`, `tests/e2e/alerts.spec.ts`
- Modify: `src/App.tsx` (routes `/alerts` and `/alerts/:id`), `src/screens/Home.tsx`, `src/screens/Result.tsx`, `src/i18n/en.ts`, `pcm.ts`, `ha.ts`

**Interfaces:**
- Consumes: `Alert` (`src/core/types.ts`), `normalizeText`
- Produces: `filterAlerts(alerts: Alert[], query: string): Alert[]`

Rules: sort by `date` descending, then `id` descending. A query under 2 characters returns all alerts. Otherwise every query token must be a substring of the normalized haystack: title, summary, and every product's brand, ingredient, manufacturer and batches.

- [ ] **Step 1: Failing tests** `tests/unit/core/alertSearch.test.ts`

```ts
import { filterAlerts } from '../../../src/core/alertSearch';
import { ALERTS } from '../../helpers/fixtures';

const ids = (q: string) => filterAlerts(ALERTS, q).map((a) => a.id);

test('newest first when there is no query', () => {
  expect(ids('')).toEqual(['042/2026', '036/2026', '035/2026']);
});

test('matches title, brand, batch and manufacturer, any case', () => {
  expect(ids('menofix')).toEqual(['035/2026']);
  expect(ids('fx123')).toEqual(['036/2026']);
  expect(ids('bppl artemether')).toEqual(['042/2026']);
  expect(ids('astrazeneca')).toEqual(['036/2026']);
});

test('no match', () => {
  expect(ids('zzzz')).toEqual([]);
});
```
(If `ALERTS` has more entries than these three, filter the expected lists to the fixture's actual ids and dates.)

- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `src/core/alertSearch.ts` (pure).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Screens.**
  - `Alerts` (`/alerts`): heading `t('alerts_title')`, `<input type="search" data-testid="alerts-input">` with placeholder `t('alerts_search')`, then a list of links to `/alerts/<encodeURIComponent(id)>`, each with the date (`code`), `t('alert_kind_<kind>')`, the title, and batches (`code`). Empty: `t('alerts_none')`.
  - `AlertDetail` (`/alerts/:id`, `decodeURIComponent`): title as `<h2>`, date, kind, summary, a table of products (brand, strength, manufacturer, batches in `code`), and `<a href={alert.url} target="_blank" rel="noopener noreferrer">{t('alert_open')}</a>`.
  - Home: `<Link to="/alerts" className="btn btn-outline">{t('home_alerts', { n: packs?.alerts.alerts.length ?? 0 })}</Link>`.
  - Result: when the verdict has `alert`, add `<Link to={'/alerts/' + encodeURIComponent(v.alert.id)}>{t('alert_read')}</Link>`.
  - New keys:
    - `home_alerts`: en "NAFDAC alerts ({n})" · pcm "NAFDAC alerts ({n})" · ha "Sanarwar NAFDAC ({n})"
    - `alerts_title`: en "NAFDAC alerts" · pcm "NAFDAC alerts" · ha "Sanarwar NAFDAC"
    - `alerts_search`: en "Search by medicine, batch or company" · pcm "Search by medicine, batch or company" · ha "Bincika da sunan magani, batch ko kamfani"
    - `alerts_none`: en "No alert matches." · pcm "No alert match am." · ha "Babu sanarwar da ta yi daidai."
    - `alert_open`: en "Open on nafdac.gov.ng (needs internet)" · pcm "Open for nafdac.gov.ng (you go need internet)" · ha "Buɗe a nafdac.gov.ng (yana buƙatar intanet)"
    - `alert_read`: en "Read the NAFDAC alert" · pcm "Read the NAFDAC alert" · ha "Karanta sanarwar NAFDAC"
    - `alert_kind_counterfeit`: en "Counterfeit" · pcm "Fake" · ha "Na jabu"
    - `alert_kind_substandard`: en "Substandard" · pcm "No reach standard" · ha "Mara inganci"
    - `alert_kind_recall`: en "Recall" · pcm "Recall" · ha "Janyewa"
    - `alert_kind_unregistered`: en "Not registered" · pcm "No register" · ha "Ba a yi rajista ba"
    - `alert_kind_watchlist`: en "Warning" · pcm "Warning" · ha "Gargaɗi"
    - `alert_kind_other`: en "Notice" · pcm "Notice" · ha "Sanarwa"
- [ ] **Step 6: E2E** `tests/e2e/alerts.spec.ts`

```ts
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

test('browse and search NAFDAC alerts offline', async ({ page, context }) => {
  await onboard(page);
  await page.getByRole('link', { name: /NAFDAC alerts \(\d+\)/ }).click();
  await context.setOffline(true);
  await page.getByTestId('alerts-input').fill('menofix');
  await page.getByRole('link', { name: /Menofix/i }).first().click();
  await expect(page.getByRole('heading', { name: /Menofix/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /nafdac\.gov\.ng/ })).toBeVisible();
  await context.setOffline(false);
});
```
If no real alert in `public/packs/alerts.json` mentions Menofix, pick one that exists (`grep -o '"title":"[^"]*"' public/packs/alerts.json | head`), update this test, and note it in `docs/progress.md`.

- [ ] **Step 7: Verify and ship.** Commit `feat: browse and search NAFDAC alerts offline`.

---

### Task 31: Accessibility pass with an automated axe check

**Files:**
- Create: `tests/e2e/a11y.spec.ts`
- Modify: `package.json` (devDependency `@axe-core/playwright`), `src/state/AppContext.tsx`, `src/screens/Result.tsx` or `src/components/VerdictView.tsx`, `src/styles/app.css`, `tests/unit/i18n.test.ts`

- [ ] **Step 1:** `npm i -D @axe-core/playwright`.
- [ ] **Step 2: Failing unit test** (in `tests/unit/i18n.test.ts` or a new UI test): render `AppProvider` with a test loader, change the language through the context API to `ha`, and expect `document.documentElement.lang` to be `'ha'`.
- [ ] **Step 3: Failing E2E** `tests/e2e/a11y.spec.ts` (Chromium only):

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { onboard, typeNumber } from './helpers';

test.skip(({ browserName }) => browserName !== 'chromium', 'axe runs once, on Chromium');

async function noSeriousViolations(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${where}: ${v.id} (${v.nodes.length})`)).toEqual([]);
}

test('main screens have no serious accessibility violations', async ({ page }) => {
  await page.goto('/');
  await noSeriousViolations(page, 'welcome');
  await onboard(page);
  for (const path of ['/', '/type', '/history', '/settings', '/find', '/alerts']) {
    await page.goto('/#' + path);
    await page.waitForLoadState('networkidle');
    await noSeriousViolations(page, path);
  }
  await typeNumber(page, 'A4-6238');
  await noSeriousViolations(page, 'result green');
  await typeNumber(page, 'A4-99231');
  await noSeriousViolations(page, 'result red');
});
```

- [ ] **Step 4: Fix** until both pass:
  - `AppContext`: `useEffect(() => { document.documentElement.lang = settings.lang; }, [settings.lang])`.
  - The verdict container gets `role="status"`; the verdict title gets `tabIndex={-1}` and focus on mount.
  - Buttons, nav links, the language pill and list links are at least 48 px tall (`min-height: 48px` in `app.css`).
  - Fix every serious or critical axe finding (labels, contrast, landmark names). Use only `tokens.css` colors.
- [ ] **Step 5: Verify and ship.** Commit `fix: accessibility pass (lang attribute, focus, target sizes, axe clean)`.

---

### Task 32: OCR tries other angles when a photo is sideways

**Files:**
- Create: `src/ocr/retry.ts`, `tests/unit/ocrRetry.test.ts`
- Modify: `src/ocr/scan.ts`, `src/ocr/preprocess.ts`, `src/screens/Scan.tsx`, `scripts/make-fixtures.ts`, `tests/e2e/scan.spec.ts`, `src/i18n/en.ts`, `pcm.ts`, `ha.ts`

**Interfaces:**
- Produces: `recognizeWithRotation(recognize: (deg: Rotation) => Promise<string>, hasNrn: (text: string) => boolean): Promise<{ text: string; rotation: Rotation }>` with `type Rotation = 0 | 90 | 180 | 270`; `rotatedSize(w: number, h: number, deg: Rotation): { w: number; h: number }`

- [ ] **Step 1: Failing tests** `tests/unit/ocrRetry.test.ts`

```ts
import { recognizeWithRotation } from '../../src/ocr/retry';
import { rotatedSize } from '../../src/ocr/preprocess';

const has = (t: string) => t.includes('A4-6238');

test('stops after the first pass when it finds a number', async () => {
  const rec = vi.fn(async () => 'NAFDAC REG NO A4-6238');
  expect(await recognizeWithRotation(rec, has)).toEqual({ text: 'NAFDAC REG NO A4-6238', rotation: 0 });
  expect(rec).toHaveBeenCalledTimes(1);
});

test('tries 90 then 270 then 180 degrees', async () => {
  const seen: number[] = [];
  const rec = async (deg: number) => { seen.push(deg); return deg === 270 ? 'A4-6238' : 'noise'; };
  expect(await recognizeWithRotation(rec as never, has)).toEqual({ text: 'A4-6238', rotation: 270 });
  expect(seen).toEqual([0, 90, 270]);
});

test('returns the upright text when no angle finds a number', async () => {
  const rec = async (deg: number) => `pass ${deg}`;
  expect(await recognizeWithRotation(rec as never, has)).toEqual({ text: 'pass 0', rotation: 0 });
});

test('rotatedSize swaps width and height for quarter turns', () => {
  expect(rotatedSize(400, 300, 90)).toEqual({ w: 300, h: 400 });
  expect(rotatedSize(400, 300, 180)).toEqual({ w: 400, h: 300 });
});
```
(If `preprocess.ts` imports browser-only APIs at module load, put `rotatedSize` in `src/ocr/retry.ts` and re-export it from `preprocess.ts`.)

- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `src/ocr/retry.ts` (order `[0, 90, 270, 180]`, stop at the first text where `hasNrn` is true, else return pass 0) and `rotatedSize` plus a canvas `rotateCanvas(src, deg)` in `preprocess.ts`. In `scan.ts`, run recognition through `recognizeWithRotation` with `hasNrn = (t) => findNrnCandidates(t).length > 0`, rotating the preprocessed canvas for each angle. Report progress `t('scan_rotate')` when it moves past pass 0.
  - `scan_rotate`: en "Trying another angle…" · pcm "We dey try another side…" · ha "Ana gwada wani gefe…"
- [ ] **Step 4: Fixture and E2E.** `scripts/make-fixtures.ts` also writes `tests/fixtures/labels/1-rot90.png` (label 1 rotated 90° clockwise, for example via a CSS `transform: rotate(90deg)` wrapper in the page it screenshots). Run `npm run fixtures`. In `tests/e2e/scan.spec.ts` add a test that uploads `1-rot90.png` through `photo-input` and expects the same verdict level as label 1. Allow 60 s for this test.
- [ ] **Step 5: Verify and ship.** `npm run verify && npm run test:ocr`. Commit `feat: OCR retries sideways photos`.

---

### Task 33: Finish the Yoruba and Igbo drafts and guard placeholders

**Files:**
- Modify: `src/i18n/yo.ts`, `src/i18n/ig.ts`, `tests/unit/i18n.test.ts`

- [ ] **Step 1: Failing test** in `tests/unit/i18n.test.ts`

```ts
import { en } from '../../src/i18n/en';
import { ha } from '../../src/i18n/ha';
import { pcm } from '../../src/i18n/pcm';
import { yo } from '../../src/i18n/yo';
import { ig } from '../../src/i18n/ig';

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test.each([['ha', ha], ['pcm', pcm], ['yo', yo], ['ig', ig]] as const)('%s has every key with the same placeholders', (lang, m) => {
  for (const k of Object.keys(en) as (keyof typeof en)[]) {
    const s = (m as Partial<Record<keyof typeof en, string>>)[k];
    expect(s, `${lang}.${k}`).toBeTruthy();
    expect(vars(s!), `${lang}.${k}`).toEqual(vars(en[k]));
  }
});
```

- [ ] **Step 2: Run.** Expected: FAIL for `yo` and `ig` (and for `ha` or `pcm` if an earlier task missed a key: fix those too).
- [ ] **Step 3: Translate** every missing key into Yoruba (with tone marks) and Igbo (with dots), keeping meaning plain and short, keeping `{placeholders}`, keeping copy rules (no word meaning "safe", "genuine" or "authentic"; the green title means "Registered with NAFDAC"). They stay marked as drafts in `LANGS`.
- [ ] **Step 4: Run.** Expected: PASS. Then `npm run verify` and deploy. Commit `feat: complete Yoruba and Igbo draft translations`.

---

### Task 34: Docs for judges (README, pitch, video script, deck)

**Files:**
- Modify: `README.md`, `docs/pitch.md`, `docs/video-script.md`; the deck artifact https://claude.ai/artifact/VFmE5yFdgihQEJL9oXrimJ (slides `how` and `data`)

- [ ] **Step 1: README.**
  - A row of 4 screenshots near the top (`deck/img/01-home-hausa.png`, `02-green.png`, `03-amber.png`, `04-red-pidgin.png`, each `width="200"`).
  - A Mermaid diagram: phone (camera, OCR, parse, verdict engine, IndexedDB packs, report queue) to sync (Supabase REST, views) to packs (Storage, manifest) back to phone.
  - "What works today" table: works with no keys (offline checks, OCR, find by name, alerts list, report queue, English and Pidgin speech on the phone, example dashboard) versus needs keys (ElevenLabs Hausa clips, live sync and dashboard, Claude alert extraction, BrightData fetching).
  - Update the feature list for Tasks 26 to 32.
- [ ] **Step 2: Quickstart check.** In the scratchpad: `git clone /Users/grey/Desktop/dev/hacknation qs && cd qs && npm ci && npm run build`. Fix README steps until this works from a clean clone (note any step that needs network).
- [ ] **Step 3: Pitch and video script.** Add find by name and the alerts list to `docs/pitch.md` slide 4. In `docs/video-script.md` 0:35, Hausa audio plays only once clips exist; otherwise show Listen in English or Pidgin.
- [ ] **Step 4: Deck.** Follow the Slides type's "Revising a deck" rules: `read` `project/slides/how.html` and `project/slides/data.html` from the artifact, edit them in one scratchpad root, publish only those two files. `how`: the band text becomes "Every step before the upload works in airplane mode, including find by name and the NAFDAC alert list." `data`: the voice card becomes "Spoken verdicts: the phone's own voice for English and Pidgin today; ElevenLabs Hausa clips once generated." Do not verify the deck visually.
- [ ] **Step 5:** `npm run verify`. Commit `docs: judges' README, pitch and deck updates`.

---

### Task 35: Rate limits against report spam

Device ids are generated on the phone, so one person can fake several phones. Cap what one device can insert per day, server-side.

**Files:**
- Modify: `supabase/schema.sql`, `scripts/mock-supabase.ts`, `src/sync/sync.ts` (treat 429 as "try later"), tests for the mock and sync, `README.md` (Limitations)

- [ ] **Step 1: Failing tests.** Mock server: the 21st report from the same `device_id` within 24 h gets HTTP 429; reports from another device still succeed. Sync: a 429 on reports leaves them queued, records `lastSync.ok = false` with reason `rate_limited`, and does not throw.
- [ ] **Step 2: Implement** the mock limit and the sync handling. Run tests. Expected: PASS.
- [ ] **Step 3: SQL.** In `schema.sql`, a `before insert` trigger on `reports` raising an exception when the device already has 20 reports in the last 24 h, and one on `events` at 2,000 per day. Validate against local Postgres in the scratchpad: `initdb -D <scratch>/pg && pg_ctl -D <scratch>/pg -o "-p 54329" -l <scratch>/pg.log start`; create the stub roles and schemas the file expects (`anon`, `authenticated`, `service_role`, schema `storage` with a `buckets` table) before `psql -p 54329 -d postgres -f supabase/schema.sql`; insert 21 reports for one device and confirm the 21st fails; `pg_ctl -D <scratch>/pg stop`. If the file cannot run outside Supabase, validate only the new trigger SQL and note it in `docs/progress.md`.
- [ ] **Step 4:** README "Limitations": device ids are not identities; limits slow spam but do not stop a determined attacker; flags need several devices and NAFDAC review. `npm run verify`. Commit `feat: per-device rate limits for reports and events`.
