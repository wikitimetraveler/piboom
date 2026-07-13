---
name: regression-tester
description: Runs Jest CI, fixes the first failure with minimal diffs, and reports pass or blocked status per DevConnect Labs DevOps rules. Use when the user asks to run tests or CI, fix failing tests, keep the build green, debug regressions, or says npm test, npm run ci, or red build.
---

# Regression tester (piBoom / DevConnect Labs)

## Authority

Use [`AGENTS.md`](../../../AGENTS.md) (DevOps Agent Mission, Hard Blockers, Preferred Fix Order, Command Defaults) as the source of truth. This skill summarizes the loop; do not contradict `AGENTS.md`.

## Default workflow

1. Run the command the user gave; if none, run `npm run ci` from the repo root.
2. Capture the **first** failing test file and message (or first build/runtime error).
3. Fix with the **smallest** change that addresses that failure only—no drive-by refactors.
4. Re-run the **same** command. Repeat until green or blocked.

## Fix order (preferred)

1. Fix a **production code** bug if the test is correct.
2. Fix the **test** only if the test expectation is wrong.
3. Add **mocks or fixtures** for external APIs (ICE, FEMA, NASA, OAuth, etc.).
4. Add clear **validation errors** where inputs are invalid.

Do not disable tests, delete assertions, or weaken coverage to make CI pass unless the user explicitly asks.

## Disaster-domain tests (mock externals)

When fixing disaster / FIRMS / spatial / triage failures, prefer these suites and keep FEMA/NASA/USGS mocked:

| Suite | Covers |
|-------|--------|
| `tests/unit/disaster-risk-score.test.js` | Ops triage + flood zone table |
| `tests/unit/disasters-firms-quality.test.js` | FIRMS gates, Haversine guards, union-find cluster |
| `tests/unit/disaster-impact-graph-spatial.test.js` | Graph NEAR per-disaster seed query |
| `tests/unit/disaster-spatial.service.test.js` | PostGIS `/near` path |
| `tests/unit/disasters.controller.test.js` | HTTP / refresh auth |

Do not “fix” triage semantics by labeling scores as probabilities in assertions or fixtures.

## Hard blockers

Stop and report **BLOCKED** when `AGENTS.md` says so: missing env vars, credentials, DB unavailable, network-only deps unreachable, missing fixtures, install not run, or build cannot execute. Propose the smallest next step (e.g. `.env.example`, mock service).

## Commands (defaults)

| Action | Command |
|--------|---------|
| Install | `npm ci` |
| Unit tests | `npm test` |
| CI | `npm run ci` |
| Finance tests | `npm run test:finance` |

## Report format

After a loop, summarize:

- Command executed
- First failure (file + message)
- Files changed
- Final status: **PASS** or **BLOCKED**

## Anti-patterns

- Large refactors while fixing one failure
- Changing unrelated domains (Encompass vs music vs nature) in the same “CI fix” PR unless required by the failure
- Running `npm run install-pi-deps` or `npm run pi` unless the user asked (`AGENTS.md`)
