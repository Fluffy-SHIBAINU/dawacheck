# DawaCheck build loop

Start it from a Claude Code session opened in this folder, with the model set to Opus 5.5:

```
/loop Follow docs/LOOP.md
```

## Each iteration

0. Run `npm run -s check:env` (it prints only set or MISSING). If a key that a `BLOCKED` task waits for is now set, do that task's remaining steps first (Task 18: `npm run voice`; Task 24: the Supabase steps in its BLOCKED note; Task 4 rerun: `npm run data:alerts`), then remove its `BLOCKED` note when done. Never print key values.
1. Read `CLAUDE.md` and the plan index `docs/superpowers/plans/2026-10-03-dawacheck.md` (Global Constraints and Task Index). Read the spec section a task cites when you need detail.
2. Pick the first Task Index entry that is unchecked and not marked `BLOCKED`. Open its phase file and read only that task's section. Find it with `grep -n "^### Task" <phase file>`.
   - If that phase file's first line still contains `(writing)`, the plan for it is not finished yet. Do nothing else this iteration and schedule the next wakeup in 300 seconds.
3. Implement the task exactly as written, test-first, step by step. Tick each step's checkbox in the phase file as you finish it.
4. Run the task's verification commands. Fix until green. Never weaken, skip or delete a test to make it pass. Fix the code instead. If a plan value is provably wrong (for example a library API changed), fix the plan text and record why in `docs/progress.md`.
5. If a step needs something only the user can provide (API key, login, device), finish every other step, mark the index entry `BLOCKED: <exact thing needed>`, and move on next iteration.
6. Commit with `git add -A && git commit -m "<type>: <summary>"`, tick the task in the Task Index, and append one line to `docs/progress.md`: `- HH:MM · Task N · done|blocked · notes`.
7. Phase-end tasks (10, 15, 19, 23) must end with `npm run verify` green. That includes e2e once Playwright exists.
8. Do one task per iteration. When tasks are small and the deadline is close, two or three tasks per iteration are fine, with one commit per task. Then schedule the next wakeup in 60 seconds.
9. `BLOCKED` tasks are skipped, never waited on. Keep going with the next unchecked task in any later phase.
10. When every task is ticked or `BLOCKED` and it is before 22:00 EDT, do a review pass: read `git log -5 -p` and the screens those commits touched, and look for real defects (crash paths, copy that breaks the Global Constraints, missing translations, untested branches, offline breakage). Add each real defect as a new task at the end of the last phase file (`### Task N: Fix ...`, failing test first) and in the Task Index, then continue. If the review finds nothing real, or it is 22:00 EDT or later, print the BLOCKED list with what the user must do, then stop the loop.

## Deploy

- After a task that changes the app, when `npm run verify && npm run test:ocr` pass, run `npm run deploy`. Then open https://dawacheck-smoky.vercel.app in the built-in browser pane, load it twice (the service worker swaps in the new build on the second load) and confirm the change is live. Note the result in `docs/progress.md`.
- Never deploy with a red gate. If a deploy breaks the live app, roll production back with `npx --yes vercel@latest rollback` run inside `.vercel-deploy/dawacheck` (the folder `npm run deploy` links to the Vercel project), then fix forward.

## Freeze

- From 22:30 EDT: start no new tasks. Only fix regressions in the live app. At 23:30 EDT, print the final status and the BLOCKED list, then stop the loop.

## Guardrails

- Never print or commit secrets. `.env` stays gitignored.
- Tests never call paid APIs. Scripts that do (`data:alerts`, `voice`) run at most once per task unless the task says otherwise.
- Do not edit the spec, or other tasks' text, except to tick checkboxes or fix a provably wrong value (see step 4).
- If the same failure survives 3 attempts, write the error and your best hypothesis in `docs/progress.md`, mark the task `BLOCKED: needs human look`, and move on.
