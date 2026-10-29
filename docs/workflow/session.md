# Current session handoff

This file carries only the current handoff. GitHub Issues own task scope/status; `priority.md` owns food-analysis ordering. Check live Git status and the issue before relying on this note.

## Active work

- Task: [workflow setup, issue #2](https://github.com/avellir/Cal-Ai/issues/2).
- Branch: `chore/development-workflow`, in the separate worktree `C:/Temp/cal-ai-workflow-20261029`.
- PR: [draft #3](https://github.com/avellir/Cal-Ai/pull/3), targeting `main`.
- Latest decision: use local verification; GitHub Actions is deferred. Its workflow file is removed from the proposal. The GitHub billing lock is not a prerequisite for this local process.
- State: implementation is verified and published to PR #3; review/merge remains the next decision. Resume that decision rather than recreating the setup.
- Implemented: priorities, issue/PR templates, contribution/agent instructions, `npm run verify`, and this startup/handoff routine. A Project board and unattended agent loop are not configured.

## Preserve current application work

The original folder `C:/Cal-Ai-feature-MOB-2` remains on `feature/MOB-2-latest-2026-10-08`, with newer FatSecret/vision changes that are not committed to GitHub. It also contains working copies of the workflow files. The workflow PR starts from the older GitHub main and does not include those application changes.

Keep the original folder and `.cleanup-backups/workflow-2026-10-29/` checkpoint intact while completing [recovery issue #4](https://github.com/avellir/Cal-Ai/issues/4). Do not assume the GitHub workflow branch contains the latest running app.

## Verification

Completed local verification on 2026-10-29:

| Workspace | Jest | TypeScript | Changed-file lint | iOS export | Full-lint audit |
|---|---:|---|---|---|---|
| Current application folder | 329/329, 33 suites | Passed | Passed | Passed | 58 errors, 4 warnings |
| Isolated workflow branch | 189/189, 21 suites | Passed | Passed | Passed | 58 errors, 4 warnings |

Both final reports have `success: true` for required checks and `sourceChangedDuringRun: false`; the existing full-lint debt is explicitly `audit_failed`. Jest now discovers only the real root test folder, excluding archived backup copies.

Run `npm run verify -- --base origin/main` in the workspace being evaluated. Read `.cleanup-backups/local-checks/latest.json` there for the actual checked branch/commit/source fingerprint, per-check results and log paths. These are separate source snapshots; the workflow PR does not contain the newer application integration. No device QA, live provider request, meal write or production deployment was performed for this workflow change.

## Next actions

1. Review and merge PR #3 once its local verification and review are complete; merging is still a separate action.
2. Recover the current application/backend work through issue #4 into coherent, verified PRs.
3. Create a GitHub Project with Backlog, Ready, Working, Waiting, In review and Done, plus priority/owner and linked PRs. This board remains to be set up.
4. Take one ready issue per task branch; use the existing branch if work is unfinished. Keep broader food-analysis work in `priority.md` until selected.
5. Track existing lint cleanup in [issue #5](https://github.com/avellir/Cal-Ai/issues/5). Preserve the distinction between required checks and the current full-lint audit.

At the next session boundary, replace stale progress here with the actual issue/branch/PR, verification results, remaining work and immediate next action. Record unfinished work explicitly rather than marking it done.
