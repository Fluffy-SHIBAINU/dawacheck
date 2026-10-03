# DawaCheck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. When driven by `/loop`, follow `docs/LOOP.md`: one task per iteration, in index order.

**Goal:** Build DawaCheck, an installable offline web app that photographs a medicine box, reads the NAFDAC number on the phone, checks it against the NAFDAC register and alerts, speaks the verdict in Hausa or English, queues reports, and syncs and learns when online.

**Architecture:** Vite + React PWA. All verdict logic is pure TypeScript in `src/core` (table-tested). Data packs (register, alerts) are JSON precached by a service worker and mirrored into IndexedDB (Dexie). OCR runs in a self-hosted Tesseract.js worker. Sync is plain `fetch` against Supabase REST and Storage (a local mock server stands in for tests). "Learning" is server-side aggregation views plus pack publishing.

**Tech Stack:** TypeScript (strict), React, react-router-dom (HashRouter), Dexie, tesseract.js, vite-plugin-pwa, Vitest, Testing Library, fake-indexeddb, Playwright, tsx, @anthropic-ai/sdk (build-time only), ElevenLabs REST (build-time only), BrightData Unlocker REST (build-time only), Supabase (Postgres + Storage).

**Spec:** `docs/superpowers/specs/2026-10-03-dawacheck-design.md` (read it before starting any task). Visual design: https://claude.ai/artifact/Q392hGkC2QW5h8SNR8HHpv

## Global Constraints

- Deadline: everything demo-ready by 2026-10-03 22:30 EDT. Submission is at 23:59.
- Node 20 (installed: v20.19.0). npm. ES modules (`"type": "module"`).
- TypeScript `strict: true`. `npm run typecheck` must pass at the end of every task.
- The app must work with **no network** after first load. Never add a runtime dependency on a CDN or remote API for verdicts.
- The client bundle may contain only `VITE_*` variables. `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `BRIGHTDATA_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are read only by `scripts/*`. Never commit `.env`.
- Tests never call paid or remote APIs. Use fixtures, the mock server and mocked `fetch`.
- Copy rules: never use the words "safe", "genuine" or "authentic" in UI text. Green verdict title is exactly "Registered with NAFDAC". About text is exactly: "DawaCheck checks NAFDAC records and what is printed on the box. It cannot test what is inside. If in doubt, do not take it and ask a health worker."
- No dosing advice anywhere.
- Codes (NRN, batch, dates) render with class `code` (IBM Plex Mono).
- Colors and fonts come only from `src/styles/tokens.css` variables.
- NRN normal form: uppercase, `PREFIX-NUMBER`, regex `^([ABC]?\d{1,2})-(\d{4,6}[A-Z]?)$`.
- Dates in data are ISO `YYYY-MM-DD`. Pack versions are `YYYY-MM-DD` with an optional `-N` suffix.
- Events never contain free text, photos or coordinates. Usage events upload only when consent is on (default off).
- Sync base URL comes from `VITE_SUPABASE_URL`. `VITE_SYNC_MODE` is `supabase`, `mock` or `off`.
- Mock server port: `54321`. E2E preview port: `4173`.
- Commit after every task with a conventional message (`feat:`, `fix:`, `test:`, `chore:`, `docs:`).

## File Map

```
package.json, tsconfig.json, vite.config.ts, vitest.ocr.config.ts, playwright.config.ts, index.html
.env.example (template), .env (user, gitignored), .env.e2e (committed, mock values)
CLAUDE.md, README.md, docs/LOOP.md, docs/progress.md, docs/pitch.md, docs/video-script.md
supabase/schema.sql                          backend tables, policies, views, bucket
scripts/
  lib/env.ts                                 loads .env for scripts
  lib/normalizeRegister.ts                   Greenbook row -> Product (pure)
  lib/alerts.ts                              alert id/title/html helpers + fallback extraction (pure)
  lib/extractAlert.ts                        Claude tool-call extraction
  lib/brightdata.ts                          BrightData Unlocker fetch
  lib/aggregate.ts                           JS mirror of SQL views (mock + tests)
  fetch-register.ts, fetch-alerts.ts, build-manifest.ts
  copy-ocr-assets.ts, make-voice.ts, make-icons.ts, make-fixtures.ts
  mock-supabase.ts, publish-packs.ts, gaps.ts
src/
  main.tsx, App.tsx
  styles/tokens.css, styles/app.css
  core/types.ts, core/text.ts, core/sha.ts, core/manifest.ts, core/states.ts, core/sms.ts
  core/parse/nrn.ts, parse/expiry.ts, parse/batch.ts, parse/strength.ts, parse/name.ts, parse/index.ts
  core/registerIndex.ts, core/confusion.ts, core/alerts.ts, core/verdict.ts
  data/db.ts, data/meta.ts, data/packs.ts, data/checks.ts, data/reports.ts
  telemetry/events.ts
  i18n/index.ts, i18n/en.ts, i18n/ha.ts, i18n/pcm.ts, i18n/yo.ts, i18n/ig.ts
  voice/clips.ts, voice/player.ts, voice/forVerdict.ts
  ocr/engine.ts, ocr/preprocess.ts, ocr/scan.ts
  sync/config.ts, sync/http.ts, sync/sync.ts, sync/api.ts
  state/AppContext.tsx
  lib/pendingScan.ts, lib/time.ts
  demo/cartons.ts
  components/StatusPill.tsx, VerdictView.tsx, ListenButton.tsx, CropBox.tsx, Layout.tsx
  screens/Welcome.tsx, Home.tsx, TypeNumber.tsx, Scan.tsx, Result.tsx, Report.tsx, History.tsx, Settings.tsx, Dashboard.tsx, DemoPacks.tsx
public/packs/{register,alerts,manifest}.json, public/voice/{en,ha,pcm}/*.mp3, public/icons/*.png, public/tesseract/* (generated, gitignored)
tests/
  setup.ts
  helpers/fixtures.ts                        small synthetic register/alerts for unit tests
  unit/**.test.ts(x), scripts/**.test.ts, ocr/fixtures.test.ts, e2e/*.spec.ts
  fixtures/labels/{1..5}.png + expected.json (generated)
```

## Task Index

Work strictly in this order. A task is done when every checkbox in its section is ticked and its verification passed. Mark a task `BLOCKED: <reason>` only when it needs something from the user. Do all the other parts first.

**Phase 1: Setup and data** (`2026-10-03-dawacheck/p1-setup-data.md`)
- [x] Task 1: Scaffold the app, tooling, styles and smoke test
- [x] Task 2: Core types and text utilities
- [x] Task 3: Register normalization and `data:register` (real NAFDAC data)
- [x] Task 4: Alerts fetch and extraction, `data:alerts` (WP API, BrightData, Claude)
- [x] Task 5: sha256, manifest builder and version compare

**Phase 2: Verdict engine** (`2026-10-03-dawacheck/p2-engine.md`)
- [x] Task 6: NRN candidates from OCR text
- [x] Task 7: Expiry, batch, strength and name parsers
- [x] Task 8: `parseScan`, register index and confusion variants
- [x] Task 9: Alert matching
- [x] Task 10: `decide()` verdict engine (decision table) + phase gate

**Phase 3: Storage and screens** (`2026-10-03-dawacheck/p3-app.md`)
- [x] Task 11: Dexie database, settings and pack loading
- [ ] Task 12: Checks, reports, events, states and SMS helpers
- [ ] Task 13: i18n (5 languages) and voice clip texts
- [ ] Task 14: App shell, onboarding, Home, Type number, Result (MVP) + first E2E
- [ ] Task 15: Report, History, Settings screens + phase gate (**MVP checkpoint**)

**Phase 4: OCR, voice, offline** (`2026-10-03-dawacheck/p4-ocr-voice-pwa.md`)
- [ ] Task 16: Demo cartons page and OCR fixture images
- [ ] Task 17: On-device OCR and the Scan screen
- [ ] Task 18: Voice clips (ElevenLabs) and player
- [ ] Task 19: PWA (service worker, manifest, icons) + offline E2E + phase gate

**Phase 5: Sync, learning, dashboard** (`2026-10-03-dawacheck/p5-sync-learning.md`)
- [ ] Task 20: Supabase schema, aggregation mirror and mock server
- [ ] Task 21: Sync client, triggers and sync UI
- [ ] Task 22: Learning loop E2E, `publish-packs` and `gaps`
- [ ] Task 23: Regulator dashboard + phase gate

**Phase 6: Ship** (`2026-10-03-dawacheck/p6-ship.md`)
- [ ] Task 24: Production config, Supabase hookup, Vercel deploy, iPhone checklist
- [ ] Task 25: README, pitch deck content, deck file, video script

## User-provided inputs (tasks that need them)

| Needed | Used in | Without it |
|---|---|---|
| `ANTHROPIC_API_KEY` in `.env` | Task 4 | Fallback extraction from titles (less detail, still works) |
| `BRIGHTDATA_API_KEY`, `BRIGHTDATA_ZONE` | Task 4 (`--via=brightdata`) | WP API direct fetch |
| `ELEVENLABS_API_KEY` (+ optional `ELEVENLABS_VOICE_ID`) | Task 18 | Text-only verdicts (player falls back silently) |
| Supabase project: run `supabase/schema.sql`, set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Task 24 | Mock server only (local demo) |
| `npx vercel login` | Task 24 | No https URL for iPhone install |
| iPhone hands-on check | Task 24 | Not verified on device |
