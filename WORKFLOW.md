# Solo Workflow for `piBoom`

This is a lightweight solo workflow for running parallel tasks with minimal process overhead.

## Goals

- Keep `main` releasable.
- Isolate risky changes while staying fast.
- Support "multi-agent" style work without team-level ceremony.

## Repository Baseline

- Runtime: Node.js (`>=18`)
- Main dev server: `npm run dev`
- Test commands:
  - Fast local tests: `npm test`
  - CI-style tests: `npm run ci`
- Build command (when needed): `npm run build`

## Branch and Worktree Model (Solo)

Use at most two active worktrees most of the time:

- `feature/<task>`: where you actively implement
- `integration/smoke`: optional validation branch for full checks before merge

Keep branch names short and parseable:

- `feature/<domain>-<intent>`
- `backend/<intent>` (only when touching shared backend contracts)

Examples:

- `feature/finance-parser-hardening`
- `feature/nature-bootstrap-cleanup`
- `backend/disaster-refresh-schema`

## Standard Loop

1. Create a task worktree from `main`:
   - `git worktree add ../wt-task -b feature/<task> main`
2. Implement in the task worktree.
3. Sync with latest `main` before final verification:
   - `git fetch origin`
   - `git rebase origin/main` (or merge if you prefer)
4. Run fast checks:
   - `npm test`
5. Run stronger checks before merge:
   - `npm run ci`
6. If change affects packaging/build output, run:
   - `npm run build`
7. Merge to `main` only when green.

## When to Use a Backend Branch

Create `backend/<intent>` only if a change is shared across multiple domain flows (for example finance + nature + disasters).

Rule of thumb:

- If the change only affects one user-facing area, stay in `feature/<task>`.
- If the API/schema/contract changes for multiple areas, split to `backend/<intent>` and validate downstream callers in the same cycle.

## Contract Safety Rules

- Prefer additive contract changes first (new fields/endpoints over breaking renames/removals).
- If breaking change is unavoidable, update all affected call sites before merge.
- Keep migrations/scripted data updates (`scripts/*`) in the same branch as the contract change.

## Suggested Command Snippets

Create new task worktree:

`git worktree add ../wt-finance-fix -b feature/finance-fix main`

Or use the helper script for consistent naming:

`.\scripts\new-task.ps1 -Task "parser hardening" -Domain "finance"`

List active worktrees:

`git worktree list`

Remove a finished worktree:

`git worktree remove ../wt-finance-fix`

Prune stale worktree metadata:

`git worktree prune`

## Definition of Done (Solo)

Before merging to `main`:

- `npm test` passes
- `npm run ci` passes
- Any required build step passes (`npm run build`, if relevant)
- No known contract mismatches left between backend and domain flows
- Commit history is understandable (small, scoped commits preferred)

## Optional Weekly Cleanup

- Delete merged local branches.
- Prune stale worktrees.
- Reconfirm `main` runs with:
  - `npm run dev`
  - `npm run ci`

This keeps your solo loop fast while still giving you safe isolation for parallel tasking.
