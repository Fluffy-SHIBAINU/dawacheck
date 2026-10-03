# DawaCheck: Design Spec

- **Date:** 2026-10-03
- **Status:** Ready for review (hackathon scope)
- **Visual design:** https://claude.ai/artifact/Q392hGkC2QW5h8SNR8HHpv (screens, workflow, system and learning diagrams)
- **Event:** World Bank "Small AI for Development" hackathon, Health track. Submission due 2026-10-03 23:59 local time (EDT). Deliverables: demo video, slide deck, repo.

---

## 1. Problem and goal

One in ten medical products in low- and middle-income countries is substandard or falsified (WHO). In Nigeria, 75% of rural people go first to a Patent and Proprietary Medicine Vendor (PPMV): a shop with no pharmacist. Antimalarials and antibiotics are the most common purchases. Connectivity and doctors are scarce in exactly these places.

**Goal:** a phone app that, with **no internet**, takes a photo of a medicine box (or a typed number) and says whether:

1. NAFDAC registered the product (the NAFDAC Registration Number, "NRN", is printed on every pack),
2. the box matches its registration (name, strength, registration still active, pack not expired),
3. NAFDAC has issued a public alert about it,
4. other users have reported it (community flags learned in the cloud),

then speaks the verdict in Hausa or English (Pidgin on trial), lets the user report the box, and syncs and learns whenever a connection appears.

**Hackathon product:** an installable **web app (PWA)** that runs fully offline on iPhone (demo device) and Android. A native Android app is future work.

## 2. Users and languages

| Persona | Language | Device | Need |
|---|---|---|---|
| Caregiver (Amina, Kano) | Hausa, reads a little | Shared Android, rarely has data | Spoken yes/no before giving medicine to a child |
| PPMV owner (Musa, Zaria) | Hausa, some English | Android, weak 2G | Check stock from markets and wholesalers |
| Community health worker (Ngozi, Enugu) | Igbo, Pidgin, English | Android, data on market days | Check household medicines, file reports |
| NAFDAC pharmacovigilance desk | English | Laptop, online | Aggregated reports by state, reason and unknown numbers |

| Language | Code | Screen text v1 | Voice v1 |
|---|---|---|---|
| English | `en` | yes | ElevenLabs |
| Hausa | `ha` | yes (draft, native review wanted) | ElevenLabs (`eleven_v3` supports Hausa) |
| Nigerian Pidgin | `pcm` | yes (draft) | trial: English voice reading Pidgin text |
| Yoruba | `yo` | draft, labelled "Draft translation" | later |
| Igbo | `ig` | draft, labelled "Draft translation" | later |

**Low-literacy rules:** every verdict has a color, an icon, a short title and a voice clip. Codes (NRN, batch, dates) always render in a monospace font, exactly as printed. Tap targets are at least 48px.

## 3. Scope

### In scope (tonight)
- PWA, installable, fully offline after first load (service worker precache)
- Photo capture via `<input type="file" accept="image/*" capture="environment">`, on-device OCR (Tesseract.js, self-hosted)
- Draw-a-box crop fallback; typed NRN fallback
- Verdict engine (green / amber / red / unknown) over: register pack, alerts pack, community flags, OCR-correction table
- 5 languages of UI text; Hausa and English (plus Pidgin trial) voice clips pre-rendered with ElevenLabs
- Local storage: check history, report queue, interaction event log, settings, packs
- Opt-in consent for uploading usage events; reports always need an explicit user action
- Sync with Supabase when online: upload reports and events; download community flags, OCR corrections, newer packs
- "Learning" = server-side aggregation (SQL views) plus pack publishing (see §11)
- Regulator dashboard (online only)
- Demo packs page (printable/scannable cartons) and fixture PNGs for OCR tests
- Build-time scripts: register fetch (Greenbook JSON), alerts fetch (NAFDAC WP REST API, BrightData fallback) and extraction (Claude), voice generation (ElevenLabs), fixture generation, pack publishing

### Out of scope (later)
- Native Android/iOS app, ML Kit OCR
- SMS gateway or shortcode bot (v1 only has a "Send by SMS" deep link that opens the phone's SMS app)
- Pill/pack image recognition
- Dosing or "how to take" advice (safety; needs pharmacist review)
- Other countries' registers (pack format is country-agnostic, so adding them later is a data task)

## 4. Architecture

```
Phone (offline)                                   Cloud (when connected)
┌──────────────────────────────────────┐          ┌────────────────────────────────┐
│ React UI (HashRouter)                │          │ Vercel static host: app build  │
│  ├─ OCR worker (tesseract.js WASM)   │          │ Supabase                       │
│  ├─ Parsers (nrn/expiry/batch/str.)  │  sync    │  ├─ tables: reports, events    │
│  ├─ Verdict engine (pure functions)  │ ───────▶ │  ├─ views: community_flags,    │
│  ├─ Voice player (mp3 clips)         │ ◀─────── │  │   nrn_corrections, dash_*   │
│  ├─ Dexie (IndexedDB) store          │          │  └─ storage bucket `packs`     │
│  └─ Service worker (Workbox precache)│          │     (manifest + pack JSON)     │
└──────────────────────────────────────┘          └────────────────────────────────┘
Build time: Greenbook JSON ─┐  NAFDAC WP API / BrightData ─┐  ElevenLabs ─┐
                            ▼                              ▼              ▼
                 public/packs/register.json   public/packs/alerts.json   public/voice/*
```

**Stack:** Vite + React + TypeScript (strict), `react-router-dom` with `HashRouter`, `dexie`, `tesseract.js` v5+, `vite-plugin-pwa` (Workbox `generateSW`), plain CSS with design tokens (palette from the design page: accent `#0B6E4F`, ok `#1D8752`, warn `#9A6300` on `#FBEFD6`, bad `#BF3129`, ink `#10201A`, bg `#F6F9F7`; fonts Archivo for display, Atkinson Hyperlegible for body, IBM Plex Mono for codes, all self-hosted via `@fontsource/*` so they work offline). Tests: Vitest, @testing-library/react, fake-indexeddb, Playwright. Scripts run with `tsx`.

**Why HashRouter:** static hosting with no rewrite rules, and offline navigation works without a navigate-fallback.

## 5. Source data (verified 2026-10-03)

### 5.1 NAFDAC Greenbook (register)
- Endpoint: `GET https://greenbook.nafdac.gov.ng/?draw=1&start={n}&length=1000&search_ingredient=` with headers `X-Requested-With: XMLHttpRequest`, `Accept: application/json`. 9 pages, 1s apart.
- 8,938 records. 8,667 unique NRNs; 258 NRNs map to more than one record (pack/strength variants), so lookups return **arrays**.
- `status`: `Active` 6,180, `Inactive` 2,758. 2,702 have `expiry_date` (registration validity) before 2026-10-03.
- Categories: Drugs 7,451, Medical devices 1,107, Vaccines and Biologics 151, Herbals and Nutraceuticals 125, Veterinary 93, N/A 11. Keep all.
- NRN prefixes: `A4` 2,787, `B4` 2,020, `C4` 916, `04` 915, `A11` 909, `A3` 699, `03` 403, `A6` 235, then rare `A7 A10 A9 A1 07 00`. Number part has 4–6 digits, sometimes with a trailing letter (`A1-4924L`). Rare dirty values: spaces or en dashes around the hyphen (`04 – 1486`), `4/1/9086`, `NA`, `Not available yet`, empty.
- Useful raw fields: `product_name` (strip `#` and `*`), `ingredient_name`, `strength` (e.g. `80 mg; 480 mg`), `form_name`, `route_name`, `applicant_name`, `category_name`, `expiry_date`, `status`, `product_description` (physical look, e.g. "Yellow colored, oblong shaped tablet plain on both sides"), `pack_size` (HTML entities, e.g. `&#039;`), `atc`, `NAFDAC`.
- Compact JSON size is about 4.4 MB raw, 0.92 MB gzipped. Acceptable.

### 5.2 NAFDAC public alerts
- WordPress REST: `GET https://nafdac.gov.ng/wp-json/wp/v2/posts?search=Public%20Alert&per_page=100&page={p}&after=2025-01-01T00:00:00&_fields=id,date,link,title,content` (verified to return JSON).
- Titles look like `Public Alert No. 042/2026-Alert on the Seizure of Suspected Substandard and Falsified BPPL Artemether/Lumefantrine 80mg/480mg`.
- Fallback fetch: BrightData Web Unlocker `POST https://api.brightdata.com/request` with `Authorization: Bearer $BRIGHTDATA_API_KEY` and body `{"zone": "$BRIGHTDATA_ZONE", "url": "<page>", "format": "raw"}`.
- Extraction: Claude (`claude-haiku-4-5-20251001`) with a forced tool call returning the `Alert` schema (§6.2). Each extraction is cached in `data/alerts-cache/{wpId}.json`.

## 6. Data packs (offline knowledge)

All packs are JSON in `public/packs/`, precached by the service worker, and versioned by date string `YYYY-MM-DD` (plus `-N` suffix for same-day republishes).

### 6.1 `register.json`
```ts
interface RegisterPack { version: string; source: "NAFDAC Greenbook"; fetchedAt: string /* ISO */; products: Product[] }
interface Product {
  nrn: string;          // normalized, e.g. "A4-6238"
  nrnRaw: string;       // as published
  name: string;         // "Artheget EZ"
  ingredient: string;   // "Artemether + Lumefantrine" (raw ingredient_name)
  strength: string;     // "80 mg; 480 mg"
  form: string; route: string; applicant: string; category: string;
  regExpiry: string | null;  // "2026-12-01"
  status: "Active" | "Inactive" | string;
  description: string;  // physical description, may be ""
  packSize: string;     // entities decoded
  atc: string | null;
}
```

### 6.2 `alerts.json`
```ts
interface AlertsPack { version: string; fetchedAt: string; alerts: Alert[] }
interface Alert {
  id: string;            // "042/2026"
  wpId: number; url: string; date: string /* YYYY-MM-DD */; title: string;
  kind: "counterfeit" | "substandard" | "recall" | "unregistered" | "watchlist" | "other";
  products: AlertProduct[];
  summary: string;       // ≤ 280 chars, plain English
  appliesToNigeria: boolean; // false for foreign-only recalls NAFDAC relays
}
interface AlertProduct {
  brand: string | null;  // "BPPL Artemether/Lumefantrine" | "Forxiga"
  ingredient: string | null; strength: string | null; manufacturer: string | null;
  nrn: string | null;    // normalized if stated
  batches: string[];     // uppercase, as stated
}
```

### 6.3 `manifest.json` (bundled copy in `public/packs/`, live copy in Supabase Storage `packs/manifest.json`)
```ts
interface Manifest {
  schema: 1; generatedAt: string;
  packs: Record<"register" | "alerts", { version: string; file: string; sha256: string; count: number; bytes: number }>;
  thresholds: { nameMatch: number /*0.8*/; nameMismatch: number /*0.5*/; flagWatchReports: 3; flagWatchDevices: 2; flagWarnReports: 5; flagWarnDevices: 3 };
}
```

### 6.4 Learned data (downloaded at sync, stored in Dexie `packs` table)
- `flags`: rows from view `community_flags`: `{ nrn, reports, devices, states: string[], level: "watch" | "warning", last_report_at }`
- `corrections`: rows from view `nrn_corrections`: `{ read, corrected, n }`. The client derives a character confusion table from same-length pairs (e.g. `O→0: 12`).

## 7. Scan pipeline

1. **Capture:** file input (camera on phones, upload on desktop). Keep the original `File` in memory only.
2. **Preprocess** (`src/ocr/preprocess.ts`, canvas): scale so the longest side is ≤ 1600 px; grayscale; contrast stretch (2nd–98th percentile). Variant B is Otsu binarized. Make a thumbnail (≤ 480 px JPEG, quality 0.6) for history and optional reports.
3. **OCR** (`src/ocr/engine.ts`): a single lazily created Tesseract worker with self-hosted `workerPath`, `corePath` (directory with all core variants) and `langPath` (`eng.traineddata.gz`, fast model). Pass 1: variant A, PSM 11 (sparse text). If no NRN candidate is found, run pass 2 on variant B. 20 s timeout per pass. Returns `{ text, words: {text, conf, bbox}[], ms }`.
4. **Crop mode:** the user drags a rectangle. Crop the original, upscale ×2, PSM 7, whitelist `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/ `.
5. **Parse** (`src/core/parse/*`, pure functions):
   - `normalizeText`: uppercase; map `– — − ‐` to `-`; collapse whitespace around `-`.
   - `findNrnCandidates(text)`: regex `/\b([ABC]?[0-9OIL]{1,2})\s?-\s?([0-9OISBL]{4,6}[A-Z]?)\b/g` on normalized text. Map confusable letters to digits inside the digit groups (`O→0, I→1, L→1, S→5, B→8`) except a legitimate leading `A/B/C` prefix letter. Score up candidates on the same or next line as `NAFDAC`, `REG`, `NRN` or `REG. NO`. Return unique normalized candidates ordered by score.
   - `findExpiry(text)`: only after the keywords `EXP`, `EXPIRY`, `EXP. DATE`, `USE BEFORE` or `BEST BEFORE`. Formats `MM/YY`, `MM/YYYY`, `MM-YYYY`, `MMM YYYY`, `MMM-YY`, `YYYY-MM`. Returns `{ month, year }` (year < 100 means +2000). A date after `MFG`/`MFD` is never taken as expiry.
   - `findBatch(text)`: after `BATCH`, `LOT`, `B.NO`, `BN` or `BATCH NO`; token `[A-Z0-9-]{3,15}`.
   - `findStrengths(text)`: `/(\d+(?:\.\d+)?)\s?(MG|MCG|µG|G|ML|IU|%)/g` gives `{ value, unit }[]`. Also `80/480 MG` gives two values with unit MG.
   - `nameTokens(text)`: alphabetic tokens of length ≥ 4, minus a stoplist (TABLETS, TABLET, CAPSULES, NAFDAC, BATCH, EXPIRY, MANUFACTURED, KEEP, STORE, REACH, CHILDREN, EACH, CONTAINS, ORAL, USE, BEFORE, DATE, LIMITED, PHARMA, PHARMACEUTICAL, INDUSTRIES, NIGERIA; add words as fixture tests require).
   - Register `description` values often start with the form on its own line (`"Tablet\r\nYellow colored, oblong..."`). Collapse all whitespace to single spaces when normalizing.

## 8. Verdict engine (`src/core/verdict.ts`, pure, table-tested)

```ts
type Level = "green" | "amber" | "red" | "unknown";
type Reason =
  | "registered" | "name_unconfirmed"
  | "reg_lapsed" | "name_mismatch" | "strength_mismatch" | "alert_product" | "community_flag" | "corrected_number"
  | "not_in_register" | "on_alert" | "batch_on_alert" | "pack_expired"
  | "no_number_found" | "ambiguous_number";
interface ScanInput { source: "ocr" | "manual"; nrnCandidates: string[]; text: string; strengths: {value:number;unit:string}[]; batch: string | null; expiry: {month:number;year:number} | null }
interface Verdict { level: Level; reasons: Reason[]; nrn: string | null; product: Product | null; products: Product[]; alert: Alert | null; flag: CommunityFlag | null; suggestions: Product[]; correctedFrom: string | null }
function decide(input: ScanInput, ctx: { register: RegisterIndex; alerts: Alert[]; flags: Map<string, CommunityFlag>; confusion: ConfusionTable; today: Date; thresholds: Thresholds }): Verdict
```

Rules are evaluated in this order. The final level is the most severe one (red > amber > green). `unknown` applies only when there is no usable number.

1. **No number:** no candidates gives `unknown` + `no_number_found`.
2. **Resolve NRN:** use the first candidate with an exact register hit. Otherwise, for OCR input only, generate confusion and edit-distance-1 variants ranked by the confusion table. One clear winner gives a match + `corrected_number` (amber is not forced; reason shown as info). Several plausible variants give `unknown` + `ambiguous_number` + `suggestions` (max 3). None gives `red` + `not_in_register` (still run alert matching on name tokens).
3. **Pick record:** when the NRN maps to several products, choose the one whose name and strength best match the OCR text; with manual input, choose the first `Active` one.
4. **Alerts:** an alert product matches when its brand fuzzy-matches the OCR name tokens or the chosen product's name (similarity ≥ 0.8), or its `nrn` equals the resolved NRN. **Ingredient-only matches never change the verdict.** They only show an info note "NAFDAC has alerts about some {ingredient} products".
   - Batch on the box ∈ `alert.batches`: `red` + `batch_on_alert`.
   - `kind === "unregistered"` and brand match: `red` + `on_alert`.
   - Other kinds with a brand match: `amber` + `alert_product` (show the alert card with its batch list so the user can compare).
   - Ignore alerts with `appliesToNigeria === false`.
5. **Pack expiry:** if parsed and the last day of that month is before `today`: `red` + `pack_expired`.
6. **Registration:** `status !== "Active"` or `regExpiry < today` gives `amber` + `reg_lapsed`.
7. **Box vs register** (OCR input only):
   - Name: best similarity of any product-name token (≥ 4 chars) against OCR tokens. ≥ `nameMatch` (0.8) counts as a match. A score below `nameMatch` gives `amber` + `name_mismatch` only when the OCR has ≥ 3 name tokens **and** the first *distinctive* box token (one not similar to an ingredient or applicant word) scores below `nameMismatch` (0.5) against the product name. Otherwise the reason is `name_unconfirmed` (info).
   - Fuzzy NRN correction (rule 2) is accepted only when the corrected product's brand words (name tokens minus ingredient words) match the box at ≥ `nameMatch`.
   - Suggestions: typed numbers get up to 3 typo neighbours. Photos only get neighbours whose brand words score ≥ `nameMismatch` against the box. Any alert match clears suggestions.
   - Strength: if the box shows strengths in mg and none of them occur in the registered strength values: `amber` + `strength_mismatch`.
8. **Community flag** on the NRN: `amber` + `community_flag`.
9. Otherwise `green` + `registered`. Manual input always adds `name_unconfirmed` and the screen asks the user to check that the box name equals `product.name`.

**Copy rules:** never say "safe", "genuine" or "authentic". Green says "Registered with NAFDAC". Every amber and red verdict tells the user what to do next. The About screen says: "DawaCheck checks NAFDAC records and what is printed on the box. It cannot test what is inside. If in doubt, do not take it and ask a health worker."

## 9. Screens and routes (HashRouter)

| Route | Screen | Notes |
|---|---|---|
| `#/welcome` | Language picker, then consent | First run only. Each language button plays its welcome clip. Consent: "Share anonymous usage to improve DawaCheck" (default **off**). State picker is optional (37 states + FCT). |
| `#/` | Home | Status pill (online/offline, register date, product count, pending reports). Big "Check medicine" (file input). "Type NAFDAC number". "Listen: how to use". Last 5 checks. |
| `#/scan` | Reading | Photo preview, progress, found chips, "Draw a box around the number", "Type number". |
| `#/result/:checkId` | Verdict | Band (color, icon, title), product card (name, ingredient, strength, form/route, NRN, registration validity), "Check it looks like this" (description + pack size), reasons list, mismatch comparison, alert card, community flag notice, suggestions. Actions: Listen, Report, Done. Autoplay the clip and catch iOS rejection. |
| `#/report/:checkId` | Report | Reason (prefilled from the verdict, editable), state, attach photo (default off), note (≤ 200 chars), Save. Then: "Saved on this phone · N waiting". Plus "Send by SMS now" (`sms:` link, body `DC R {NRN} {REASONCODE} {STATE}`) and NAFDAC hotline `0800-162-3322` shown as text. |
| `#/history` | History | All checks, newest first, colored dots. |
| `#/settings` | Settings | Language, state, usage sharing toggle, pack versions and counts, last sync, pending queue, "Sync now", About and disclaimer, draft-translation note. |
| `#/dashboard` | Regulator view | Online only. KPIs, reports by state, reasons, unknown numbers, community flags. Refreshes every 15 s. Banner "Example data" when `VITE_SYNC_MODE=mock`. |
| `#/demo-packs` | Demo cartons | 5 printable cartons (see §14). `?fixture=N` renders one carton alone for screenshotting. |

## 10. Local storage (Dexie, DB name `dawacheck`, version 1)

```ts
db.version(1).stores({
  packs:   'name',                  // {name:'register'|'alerts'|'flags'|'corrections', version, json, updatedAt}
  checks:  'id, createdAt, level',  // {id, createdAt, source, nrn, level, reasons, productName, ocrText(≤2000), thumb?: Blob, batch, expiry}
  reports: 'id, createdAt, syncedAt', // {id, createdAt, checkId, nrn, productName, reason, verdict, state, note, photoThumb?: string(dataURL ≤ 90k chars), ocrExcerpt(≤500), syncedAt: string|null, attempts}
  events:  'id, ts, syncedAt',      // {id, ts, type, props, lang, appVersion, packVersion, syncedAt}
  meta:    'key'                    // deviceId, lang, state, consent, lastSyncAt, lastSyncError, onboarded
});
```

- **Pack loading:** at start, read `packs.register` from Dexie. If it is missing or older than the bundled manifest, fetch `/packs/register.json` (precached) and store it. Build an in-memory `RegisterIndex` (`Map<nrn, Product[]>` plus a name-token index). Do the same for alerts. Flags and corrections come only from Dexie.
- **Retention:** keep events ≤ 5,000 (delete the oldest synced first) and checks ≤ 500.

## 11. Interaction events, sync and learning

### 11.1 Event types (`src/telemetry/events.ts`)
`app_open`, `lang_selected{lang}`, `consent_changed{value}`, `scan_started{via:'camera'|'upload'}`, `ocr_done{ms,pass,foundNrn,conf}`, `ocr_failed{error}`, `crop_used`, `manual_entry`, `nrn_corrected{read,corrected}`, `suggestion_chosen{nrn}`, `verdict_shown{level,reasons}`, `voice_played{key,lang}`, `report_saved{reason}`, `report_sms_opened`, `sync_ok{reports,events,packs}`, `sync_failed{stage,error}`.
No PII: no free text, no photos, no coordinates. Events are always written locally and uploaded **only if consent is on**.

### 11.2 Sync client (`src/sync/sync.ts`)
- Triggers: app start (after packs load), the `online` event, `visibilitychange` to visible, "Sync now", and every 5 min while online. Single-flight.
- Steps (each isolated; a failure in one step does not stop the others; errors are recorded in `meta`):
  1. `pushReports`: unsynced reports in batches of 50. `POST {SUPABASE_URL}/rest/v1/reports?on_conflict=id` with headers `apikey`, `Authorization: Bearer {anon}`, `Content-Type: application/json`, `Prefer: resolution=ignore-duplicates,return=minimal`. On 2xx, set `syncedAt`. On 409, retry one by one and treat 409 as synced.
  2. `pushEvents`: only if consent; batches of 500, same pattern on `/rest/v1/events`.
  3. `pullFlags`: `GET /rest/v1/community_flags?select=*` replaces `packs.flags`.
  4. `pullCorrections`: `GET /rest/v1/nrn_corrections?select=*` replaces `packs.corrections`.
  5. `pullManifest`: `GET {SUPABASE_URL}/storage/v1/object/public/packs/manifest.json`. For each pack with a newer version, download the file, check its sha256 (WebCrypto) and minimum count (register ≥ 5,000), then replace it in Dexie in one transaction and rebuild the index.
- Retries: per request, up to 3 attempts with 1 s / 2 s / 4 s backoff. Timeout 15 s.
- Summary shown on Home and Settings: "Sent 3 reports and 41 usage events · Register updated 8,938 → 8,950 · 1 new alert · 2 community flags".
- `VITE_SYNC_MODE=mock` points to the mock server (`http://localhost:54321`). With no URL configured, sync is disabled and Settings shows "Sync not configured".

### 11.3 Backend (Supabase): `supabase/schema.sql` (the user pastes it into the SQL editor once)
- Tables `reports` and `events` (columns mirror §10; `received_at default now()`). Check constraints: enum of reason and verdict, length limits (note ≤ 500, ocr_excerpt ≤ 500, photo_thumb ≤ 90,000), state ≤ 3 chars.
- RLS on, with `insert` policies for `anon` only. No anon `select` on raw tables.
- Views (owner rights, aggregates only, `grant select ... to anon`):
  - `community_flags`: last 14 days, `nrn` not null, `count(*) ≥ 3 and count(distinct device_id) ≥ 2`. Level is `warning` at `≥ 5 reports and ≥ 3 devices`, otherwise `watch`. Also returns `states` and `last_report_at`.
  - `nrn_corrections`: events `type='nrn_corrected'`, last 90 days, grouped by `props->>'read'` and `props->>'corrected'`.
  - `dash_activity`, `dash_by_state`, `dash_by_reason`, `dash_unknown_nrns` (reason `not_in_register`, ≥ 2 reports).
- Storage: `insert into storage.buckets (id,name,public) values ('packs','packs',true) on conflict do nothing;`

### 11.4 What "learning" means (be precise in the pitch)
1. **Community flags:** reports from many phones become amber flags on every phone (view `community_flags`).
2. **OCR corrections:** user fixes become a confusion table that reorders fuzzy NRN candidates (view `nrn_corrections` plus `src/core/confusion.ts`).
3. **Coverage gaps:** unknown numbers seen repeatedly are exported for NAFDAC (`npm run gaps`, view `dash_unknown_nrns`).
4. **Fresher knowledge:** new register and alert packs are published to Storage, and phones pull them on the next sync (`npm run publish-packs`).

Nothing trains on the phone. Rules, thresholds and tables update through data.

## 12. Voice (`src/voice/*`)
- Clip keys: `welcome`, `howto`, `v_green`, `v_green_unconfirmed`, `v_amber_mismatch`, `v_amber_lapsed`, `v_amber_alert`, `v_amber_community`, `v_red_notfound`, `v_red_alert`, `v_red_expired`, `v_unknown`, `report_saved`, `sync_done`.
- Languages: `en`, `ha`, `pcm` (`pcm` uses the English voice, labelled "trial").
- `src/voice/clips.ts` holds the source text per language and key, and is also used as on-screen text.
- Files: `public/voice/{lang}/{key}.mp3`, generated by `scripts/make-voice.ts` with ElevenLabs `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_64` (header `xi-api-key`, body `{ text, model_id }`, default model `eleven_v3`).
- Player fallbacks: clip for the language, then the English clip, then on-screen text only. A missing clip never throws.

## 13. Dashboard
Uses the dash views plus `community_flags` through the same fetch helper. Pure presentational components with tested data mappers. It is not precached-critical: it shows "Needs internet" when offline.

## 14. Demo packs (`#/demo-packs`) and OCR fixtures
Five cartons drawn with CSS, each with a small "DEMO PACK" marker:

| # | Carton text | Expected verdict |
|---|---|---|
| 1 | ARTHEGET EZ · Artemether 80 mg + Lumefantrine 480 mg · NAFDAC REG. NO. A4-6238 · BATCH AE2511 · EXP 11/2027 | green (`registered`) |
| 2 | MALAQUICK 20/120 · NAFDAC REG. NO. A4-6238 · BATCH MQ0925 · EXP 09/2027 | amber (`name_mismatch`, `strength_mismatch`) |
| 3 | PARAMAX FORTE 500 mg · NAFDAC REG. NO. A4-99231 (must be verified absent from the register by a test) · EXP 03/2028 | red (`not_in_register`) |
| 4 | ARTHEGET EZ · A4-6238 · BATCH AE2402 · EXP 08/2026 | red (`pack_expired`) |
| 5 | A product named in a real `unregistered` NAFDAC alert from `alerts.json` (picked by the fixtures script) | red (`on_alert`) |

`scripts/make-fixtures.ts` screenshots each carton (Playwright, 1200×800, device scale 2) to `tests/fixtures/labels/{n}.png` and writes `tests/fixtures/labels/expected.json`.

## 15. Build-time scripts (`scripts/`, run with `tsx`, read `.env`)
| Script | npm | Purpose |
|---|---|---|
| `fetch-register.ts` | `data:register` | Greenbook → normalized `public/packs/register.json`; raw cache in `data/raw/` (gitignored); prints counts and invalid NRNs |
| `fetch-alerts.ts` | `data:alerts` | WP API (or `--via=brightdata`) → Claude extraction → `public/packs/alerts.json`; per-alert cache |
| `build-manifest.ts` | `data:manifest` | sha256, count, bytes and version for packs → `public/packs/manifest.json` |
| `make-voice.ts` | `voice` | ElevenLabs clips → `public/voice/` (skips existing unless `--force`) |
| `make-fixtures.ts` | `fixtures` | Demo carton PNGs + expected.json |
| `publish-packs.ts` | `publish-packs` | Upload manifest and packs to Supabase Storage (service key, `x-upsert: true`) |
| `gaps.ts` | `gaps` | Export `dash_unknown_nrns` to `data/coverage-gaps.csv` |
| `mock-supabase.ts` | `mock` | Local mock of the REST and Storage endpoints used by the app, plus `POST /__reset`, `POST /__seed`, `GET /__state` for tests |

## 16. Testing and verification
- **Unit (Vitest):** parsers, NRN candidates and confusion, verdict decision table (cases from real register records plus synthetic), name and strength matching, manifest and sha checks, i18n completeness (every key in every language; `yo`/`ig` flagged draft), voice-clip mapping, SMS body format, sync client against mocked `fetch`, event consent gating, retention.
- **Component (Vitest + RTL + fake-indexeddb):** verdict screen per level, report save flow, home status pill.
- **OCR integration (Vitest, `npm run test:ocr`):** tesseract.js in Node on fixture PNGs. At least 4 of 5 fixtures must yield the expected NRN.
- **E2E (Playwright, Chromium, mock server):** first run; manual green; manual red; image upload to green; offline: after SW control, `context.setOffline(true)`, reload, manual check works, report queued; back online: mock receives the report, a seeded flag turns a verdict amber, a newer mock manifest updates the register count; dashboard renders. **WebKit smoke:** home and manual check.
- **Gate:** `npm run verify` = `typecheck && test && build && e2e`. Every task in the plan ends green on its own checks. The phase-end tasks run `verify`.
- **Manual (user, iPhone):** install via Safari Share → Add to Home Screen, airplane mode, scan demo cartons on the laptop screen, voice plays after tapping Listen.

## 17. Deployment
- `npm run build` (reads `VITE_*` from `.env`), then `npx vercel deploy dist --prod --yes` after the user runs `npx vercel login` once. HashRouter means no rewrites are needed.
- Supabase: the user creates the project, pastes `supabase/schema.sql`, and copies the URL, anon key and service key into `.env`. Then `npm run publish-packs`.

## 18. Privacy, security, safety
- No names, phone numbers or GPS. State is user-chosen. Device ID is a random UUID. Usage upload is opt-in. Reports are sent only after the user taps Save. Photo upload only if "attach photo" is on (thumbnail only). Designed to fit Nigeria's Data Protection Act 2023.
- Client gets only the anon key. Service and API keys exist only in `.env` (gitignored) for scripts.
- Raw tables are not readable by anon. Only aggregate views are.
- Medical-safety copy rules in §8. No dosing advice.

## 19. Environment variables (`.env.example`)
```
# build-time only (never bundled)
ANTHROPIC_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb
ELEVENLABS_MODEL=eleven_v3
BRIGHTDATA_API_KEY=
BRIGHTDATA_ZONE=web_unlocker1
SUPABASE_SERVICE_ROLE_KEY=
# client (inlined at build; safe to expose)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SYNC_MODE=supabase   # supabase | mock | off
```

## 20. Risks and mitigations
| Risk | Mitigation |
|---|---|
| OCR misses the NRN on real packs | Crop mode, typed entry, confusion-aware matching, demo cartons for the video |
| iOS service worker or storage quirks | Test install on iPhone right after P6, HashRouter, keep precache under 15 MB |
| False amber from name mismatch | Conservative thresholds, the `name_unconfirmed` info state, OCR-only rule |
| Translation quality | Draft labels, native review list in README |
| Missing API keys | Every script and step degrades: no voice gives text-only, no Supabase gives mock, no Claude gives cached or hand-written alerts |
| Time | Plan ordered by priority. MVP checkpoint after manual-entry verdicts work |
