# DawaCheck

Offline medicine checker (installable web app) for the World Bank "Small AI for Development" hackathon, Health track. Deadline: 2026-10-03 23:59 EDT.

Read first:
- Spec: `docs/superpowers/specs/2026-10-03-dawacheck-design.md`
- Plan index and global constraints: `docs/superpowers/plans/2026-10-03-dawacheck.md`
- Loop instructions: `docs/LOOP.md`
- Visual design: https://claude.ai/artifact/Q392hGkC2QW5h8SNR8HHpv

## Commands

- `npm run dev` · `build` · `preview` · `typecheck` · `test` · `test:ocr` · `e2e` · `verify`
- `npm run data:register` · `data:alerts` · `data:manifest` · `voice` · `icons` · `fixtures` · `mock` · `publish-packs` · `gaps` · `deploy`

(Scripts are added task by task. Check `package.json` for what exists.)

## Rules

- Verdict logic lives in `src/core` and stays pure: no DOM, no fetch, no Dexie. Write the test first.
- The app must work offline after first load. Verdicts never depend on a CDN or remote API.
- Only `VITE_*` variables reach the client bundle. Never commit `.env`. Never print secret values.
- Tests never call paid or remote APIs.
- UI copy never uses "safe", "genuine" or "authentic". The green title is "Registered with NAFDAC". No dosing advice.
- Codes (NRN, batch, dates) render with class `code`.
- Commit after each plan task with a conventional message. Log each task in `docs/progress.md`.
- If a library API differs from the plan, adapt minimally and note it in `docs/progress.md`.
