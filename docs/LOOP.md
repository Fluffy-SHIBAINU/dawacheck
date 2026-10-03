# DawaCheck build loop

Start it from a Claude Code session opened in this folder, with the model set to Opus 5.5:

```
/loop Follow docs/LOOP.md
```

## Each iteration

1. Read `CLAUDE.md` and the plan index `docs/superpowers/plans/2026-10-03-dawacheck.md` (Global Constraints and Task Index). Read the spec section a task cites when you need detail.
2. Pick the first Task Index entry that is unchecked and not marked `BLOCKED`. Open its phase file and read only that task's section. Find it with `grep -n "^### Task" <phase file>`.
   - If that phase file's first line still contains `(writing)`, the plan for it is not finished yet. Do nothing else this iteration and schedule the next wakeup in 300 seconds.
3. Implement the task exactly as written, test-first, step by step. Tick each step's checkbox in the phase file as you finish it.
4. Run the task's verification commands. Fix until green. Never weaken, skip or delete a test to make it pass. Fix the code instead. If a plan value is provably wrong (for example a library API changed), fix the plan text and record why in `docs/progress.md`.
5. If a step needs something only the user can provide (API key, login, device), finish every other step, mark the index entry `BLOCKED: <exact thing needed>`, and move on next iteration.
6. Commit with `git add -A && git commit -m "<type>: <summary>"`, tick the task in the Task Index, and append one line to `docs/progress.md`: `- HH:MM · Task N · done|blocked · notes`.
7. Phase-end tasks (10, 15, 19, 23) must end with `npm run verify` green. That includes e2e once Playwright exists.
8. Do one task per iteration. When tasks are small and the deadline is close, two or three tasks per iteration are fine, with one commit per task. Then schedule the next wakeup in 60 seconds.
9. When every task is ticked or `BLOCKED`, print the BLOCKED list with what the user must do, then stop the loop.

## Guardrails

- Never print or commit secrets. `.env` stays gitignored.
- Tests never call paid APIs. Scripts that do (`data:alerts`, `voice`) run at most once per task unless the task says otherwise.
- Do not edit the spec, or other tasks' text, except to tick checkboxes or fix a provably wrong value (see step 4).
- If the same failure survives 3 attempts, write the error and your best hypothesis in `docs/progress.md`, mark the task `BLOCKED: needs human look`, and move on.
