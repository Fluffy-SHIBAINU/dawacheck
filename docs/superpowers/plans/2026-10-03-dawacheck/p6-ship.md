# Phase 6: Ship

Read the plan index Global Constraints first. Spec reference: §17 (deployment), §18 (privacy), §20 (risks). Submission needs a **video, a slide deck and the repo**.

---

### Task 24: Production config, Supabase hookup, Vercel deploy, iPhone checklist

**Files:**
- Create: `scripts/check-env.ts`, `scripts/check-backend.ts`, `docs/iphone-checklist.md`
- Modify: `package.json` scripts, `docs/progress.md`

**Interfaces:**
- Consumes: everything.
- Produces: `npm run check:env` (prints which keys are set, never their values), `npm run check:backend` (live Supabase smoke test), `npm run deploy`, a production https URL recorded in `docs/progress.md` and README.

Steps that only the user can do are marked **USER**. Do every other step. If a USER step is missing, mark the task `BLOCKED: <step>` and continue with Task 25.

- [x] **Step 1: Environment check script**

`scripts/check-env.ts`:
```ts
import { env } from './lib/env';

const keys = ['ANTHROPIC_API_KEY', 'ELEVENLABS_API_KEY', 'BRIGHTDATA_API_KEY', 'BRIGHTDATA_ZONE', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SYNC_MODE'];
for (const k of keys) console.log(`${k.padEnd(28)} ${env(k) ? 'set' : 'MISSING'}${k === 'VITE_SYNC_MODE' ? ` (${env(k) ?? 'off'})` : ''}`);
```

```bash
npm pkg set scripts.check:env="tsx scripts/check-env.ts"
npm run check:env
```

- [ ] **Step 2: USER: Supabase project**

Tell the user exactly this (print it in the iteration output and in `docs/progress.md`):
1. Create a free project at supabase.com.
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, then click **Run**.
3. In **Project Settings → API**, copy the Project URL, the `anon` key and the `service_role` key into `.env` as `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Set `VITE_SYNC_MODE=supabase`.

Continue only when `npm run check:env` shows all three Supabase values set.

- [ ] **Step 3: Backend smoke test**

`scripts/check-backend.ts`:
```ts
import { env } from './lib/env';

const url = env('VITE_SUPABASE_URL');
const anon = env('VITE_SUPABASE_ANON_KEY');
if (!url || !anon) {
  console.error('Supabase not configured in .env');
  process.exit(2);
}
const h = { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
const ev = { id: crypto.randomUUID(), device_id: '00000000-0000-4000-8000-000000000000', ts: new Date().toISOString(), type: 'app_open', props: { smoke: true } };
const ins = await fetch(`${url}/rest/v1/events`, { method: 'POST', headers: h, body: JSON.stringify(ev) });
console.log(`insert event: ${ins.status}`);
const flags = await fetch(`${url}/rest/v1/community_flags?select=*`, { headers: h });
console.log(`read community_flags: ${flags.status}`);
const raw = await fetch(`${url}/rest/v1/events?select=*&limit=1`, { headers: h });
console.log(`read raw events (must be empty or denied): ${raw.status} ${(await raw.text()).slice(0, 40)}`);
if (ins.status !== 201 || flags.status !== 200) process.exit(1);
console.log('backend OK');
```

```bash
npm pkg set scripts.check:backend="tsx scripts/check-backend.ts"
npm run check:backend
```
Expected: `insert event: 201`, `read community_flags: 200`, raw events `200 []` (RLS hides rows), then `backend OK`.

- [ ] **Step 4: Demo data hold-back and publish (run once)**

Confirm `docs/progress.md` has no "holdback done" line, then:
```bash
npm run holdback -- --n=12
npm test
npm run publish-packs -- --dir=data/packs
echo "- $(date +%H:%M) · holdback done (bundled pack 12 products behind; full pack published)" >> docs/progress.md
```
Expected: tests still pass (the register test needs more than 8,000 products), and 3 files are published. Phones built from this bundle will show "Register updated: 8,9xx → 8,9xx products" on their first online sync.

- [x] **Step 5: USER: Vercel login, then deploy**

USER (once): `npx vercel login`.

```bash
npm pkg set scripts.deploy="npm run build && npx vercel deploy dist --prod --yes"
npm run deploy
```
Record the production URL printed by Vercel in `docs/progress.md`. Verify:
```bash
curl -sI <URL> | head -1
curl -s <URL>/packs/manifest.json | head -c 200
```
Expected: `HTTP/2 200` and the manifest JSON.

- [x] **Step 6: Write `docs/iphone-checklist.md`** (USER performs it; you write it)

```markdown
# iPhone demo checklist

1. On the iPhone, open the production URL in **Safari** (not Chrome) while online.
2. Wait about 30 seconds on the home screen. The app downloads the register, OCR model and voices for offline use.
3. Tap **Share → Add to Home Screen → Add**. Open DawaCheck from the home screen icon.
4. Turn on **Airplane Mode**. Force-quit and reopen the app. It must open with the status "No internet".
5. On the laptop, open `<URL>/#/demo-packs`. Photograph carton 1 with the iPhone: expect green, then tap **Listen** and hear Hausa.
6. Carton 2: amber (box does not match number). Tap **Report this box**, then **Save report**: expect "Reports waiting: 1".
7. Carton 3 (not in register): red. Carton 5 (NAFDAC alert): red. Switch the language to Pidgin in Settings to show the red verdict in Pidgin.
8. Turn Airplane Mode **off**. The app syncs on its own, or tap Settings → Sync now: "Sent 1 reports…" and "Register updated…".
9. On the laptop, open `<URL>/#/dashboard`: the report appears under its state.
10. If a photo does not read, use "Number unclear? Draw a box around it", or type the number.
```

- [x] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: production backend checks, demo pack publishing and deploy script"
```

---

### Task 25: README, pitch deck content, deck file, video script

**Files:**
- Create: `scripts/sizes.ts`, `README.md`, `docs/pitch.md`, `docs/video-script.md`, `deck/DawaCheck.pptx`
- Modify: `docs/progress.md`

**Interfaces:**
- Consumes: everything.
- Produces: the submission documents. `npm run sizes` prints the offline footprint used in the pitch.

- [ ] **Step 1: Measure the footprint**

`scripts/sizes.ts`:
```ts
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function total(dir: string, filter: (p: string) => boolean = () => true): number {
  let sum = 0;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) sum += total(p, filter);
    else if (filter(p)) sum += st.size;
  }
  return sum;
}
const mb = (b: number) => `${(b / 1e6).toFixed(1)} MB`;
console.log(`whole offline app (dist): ${mb(total('dist'))}`);
console.log(`register pack: ${mb(statSync('dist/packs/register.json').size)}`);
console.log(`alerts pack: ${mb(statSync('dist/packs/alerts.json').size)}`);
console.log(`OCR engine + English model: ${mb(total('dist/tesseract'))}`);
console.log(`voice clips: ${mb(total('dist/voice'))}`);
console.log(`app code: ${mb(total('dist/assets', (p) => p.endsWith('.js') || p.endsWith('.css')))}`);
```

```bash
npm pkg set scripts.sizes="tsx scripts/sizes.ts"
npm run build && npm run sizes
```
Use these real numbers in README and pitch. Never invent them.

- [ ] **Step 2: Write `README.md`**

Use exactly these sections, filling the bracketed values with real measured data:

```markdown
# DawaCheck

Check a medicine against Nigeria's NAFDAC register with no internet. Photograph the box, and the phone reads the NAFDAC number, checks it against the full register and NAFDAC's public alerts, and says the verdict in Hausa, English or Pidgin.

World Bank "Small AI for Development" hackathon, Health track.
Live app: <production URL> · Design: https://claude.ai/artifact/Q392hGkC2QW5h8SNR8HHpv

## Why
- About 1 in 10 medical products in low- and middle-income countries is substandard or falsified (WHO).
- Up to 169,000 child pneumonia deaths a year are attributed to bad antibiotics in WHO-commissioned models.
- 75% of rural Nigerians first go to a patent medicine vendor, a shop without a pharmacist.
- 2.2 billion people are offline (ITU 2025).

## What it does
1. Photo or typed NAFDAC number, read on the phone (Tesseract OCR, [size]).
2. Checked against the NAFDAC Greenbook register ([count] products, [size]) and [n] NAFDAC public alerts, stored on the phone.
3. Verdict: **Registered with NAFDAC** (green), **Check carefully** (amber: copied number, wrong strength, lapsed registration, NAFDAC warning, community reports), **Do not take this medicine** (red: not registered, on an alert, expired).
4. Spoken in Hausa, English or Pidgin. Screen text in 5 languages (Yoruba and Igbo are drafts).
5. Reports and opt-in usage events wait on the phone and sync when any connection appears.
6. Learning: reports from many phones become community flags, user corrections tune the number reader, and new register and alert packs download automatically.

## Small AI in numbers
[paste `npm run sizes` output]. It runs in airplane mode on an iPhone or a low-cost Android phone. Verdicts need no GPU, cloud or API.

## Architecture
(mermaid diagram from the spec §4, as a ```mermaid block)

## Run it
npm install · npm run dev · npm test · npm run e2e · npm run verify
Data: npm run data (register, alerts, manifest) · npm run voice · npm run fixtures
Backend: paste supabase/schema.sql into Supabase, fill .env (see .env.example), npm run publish-packs, npm run deploy

## Data sources
- NAFDAC Greenbook (public register JSON), fetched [date].
- NAFDAC public alerts (WordPress REST API). Pages fetched through BrightData Web Unlocker, with facts extracted by Claude (claude-haiku-4-5).
- Voices: ElevenLabs (eleven_v3), pre-rendered at build time.

## Privacy and safety
No names, phone numbers or GPS. The user chooses their state. Usage sharing is opt-in. The device ID is random. Designed to fit Nigeria's Data Protection Act 2023.
DawaCheck checks NAFDAC records and what is printed on the box. It cannot test what is inside. If in doubt, do not take it and ask a health worker.

## Limits and next steps
- Registration checks catch unregistered, expired, recalled and mismatched boxes. A perfect copy with a real number needs community reports and lab follow-up.
- Translations need native-speaker review (Hausa, Pidgin, Yoruba, Igbo).
- Next: native Android app, Kenya PPB and Ghana FDA registers, a NAFDAC SMS shortcode, pharmacist-reviewed "how to take" cards.
```

- [ ] **Step 3: Write `docs/pitch.md`** (10 slides; this is the deck source)

```markdown
# DawaCheck pitch (10 slides)

1. **DawaCheck: check a medicine with no internet.** World Bank Small AI for Development · Health. Photo of the iPhone showing a green verdict.
2. **The problem.** 1 in 10 medical products in LMICs is substandard or falsified (WHO). Up to 169,000 child pneumonia deaths a year are linked to bad antibiotics. 75% of rural Nigerians first go to a medicine shop with no pharmacist. 2.2 billion people are offline.
3. **Who it is for.** Amina (caregiver, Kano, Hausa), Musa (medicine vendor, Zaria), Ngozi (community health worker, Enugu), and the NAFDAC pharmacovigilance desk.
4. **How it works.** Photo → number read on the phone → full NAFDAC register and alerts stored on the phone → green / amber / red → spoken in Hausa, English or Pidgin → report waits offline → sync and learn.
5. **Three verdicts.** Screenshots: green (Artheget EZ), amber (copied number, wrong strength), red (not in the register / NAFDAC alert).
6. **Small AI in numbers.** [sizes from npm run sizes]. Airplane mode on an iPhone and on a low-cost Android. No GPU, no cloud, no per-check cost.
7. **It learns when it connects.** Community flags (3 reports from 2 phones), OCR corrections, coverage gaps for NAFDAC, fresher packs. Opt-in, no personal data, designed for NDPA 2023.
8. **Real data.** NAFDAC Greenbook ([count] products). NAFDAC public alerts ([n]) via BrightData and Claude extraction. ElevenLabs Hausa voice. Supabase sync.
9. **Path to scale.** Pilot with patent medicine vendor associations and CHW programmes in Kano. NAFDAC data partnership. The same pack format serves Kenya PPB and Ghana FDA. Native Android. SMS shortcode for reports.
10. **Ask.** Introductions to NAFDAC and two state health ministries. A 3-month pilot with 50 vendors. Native-speaker reviewers for Hausa, Yoruba and Igbo.
```

- [ ] **Step 4: Build the deck file**

Invoke the `anthropic-skills:pptx` skill and create `deck/DawaCheck.pptx` from `docs/pitch.md`: 10 slides, 16:9, palette `#0B6E4F` / `#F6F9F7` / `#10201A` with verdict colors `#1D8752`, `#9A6300`, `#BF3129`. Use screenshots captured with Playwright from `#/demo-packs` and from the result screens for cartons 1–3 (`page.screenshot` at device `iPhone 14`), saved to `deck/img/`. If the skill is unavailable, mark this step `BLOCKED: deck file` and keep `docs/pitch.md` as the source. The main session can build the deck instead.

- [ ] **Step 5: Write `docs/video-script.md`**

```markdown
# DawaCheck demo video (3:00)

Record the iPhone screen (Control Centre → Screen Recording) plus a laptop screen recording. Stitch them in any editor. Voiceover lines are below each shot.

| Time | Shot | Voiceover |
|---|---|---|
| 0:00 | Title card, then a photo of a medicine shop | "One in ten medicines in low and middle income countries is fake or substandard. In rural Nigeria, three in four people buy medicine from a shop with no pharmacist, often with no internet." |
| 0:20 | iPhone: Airplane Mode on, open DawaCheck from the home screen | "DawaCheck works with no internet. Everything it needs is already on the phone." |
| 0:35 | Photograph carton 1 on the laptop screen → green → tap Listen (Hausa plays) | "It reads the NAFDAC number on the phone, checks the full NAFDAC register, and says the answer in Hausa." |
| 1:05 | Carton 2 → amber → Report → Save → "Reports waiting: 1" | "This box copies a real number but has a different name and strength. DawaCheck catches it and saves a report, even offline." |
| 1:30 | Settings → Pidgin; carton 5 → red NAFDAC alert in Pidgin | "Products named in NAFDAC alerts are red, in Pidgin, Hausa or English." |
| 1:50 | Airplane Mode off → Home shows the sync summary | "When any connection appears, reports go up and fresh data comes down: new products, new alerts, and flags from other users." |
| 2:15 | Laptop: dashboard shows the report under Kano | "NAFDAC sees where reports cluster, with no personal data." |
| 2:35 | Slide: Small AI numbers | "[N] MB in total, no GPU and no cloud for a verdict. Next: a pilot with medicine vendors in Kano, then Kenya and Ghana." |
| 2:55 | End card: URL and repo | "DawaCheck. Check before you take." |
```

- [ ] **Step 6: Final gate and commit**

```bash
npm run verify && npm run test:ocr
git add -A
git commit -m "docs: README, pitch deck, video script"
```
Append the final status to `docs/progress.md`, including every remaining `BLOCKED` item with the exact user action. Then stop the loop.
