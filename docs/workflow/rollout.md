# Workflow rollout

## Current decision

Use local verification. GitHub Actions is deferred at the user's request, and its workflow file has been removed from [PR #3](https://github.com/avellir/Cal-Ai/pull/3). The earlier account billing lock does not block this process. Required hosted status checks are not part of the current setup.

Check execution follows [the user's testing schedule](../../CONTRIBUTING.md#testing-schedule): explicit requests or a clear end-of-day cue only. Session boundaries, commits and PR merges do not automatically run checks.

## Transition checklist

- [x] Research Matt Pocock's workflow and inspect the actual Git/GitHub state.
- [x] Preserve existing tracked edits, untracked files and history in an ignored local checkpoint.
- [x] Keep the food-analysis priorities in root `priority.md`.
- [x] Add issue/PR templates and short contribution/agent instructions on a dedicated branch.
- [x] Replace hosted CI with the executable `npm run verify -- --base origin/main`.
- [x] Add a single [session handoff](session.md) and instructions for resuming it in a new Codex task.
- [x] Record current app and isolated workflow-branch verification separately. See the current handoff and PR evidence.
- [ ] Review and merge the locally verified workflow PR.
- [ ] [Recover existing application/backend work, issue #4](https://github.com/avellir/Cal-Ai/issues/4), into coherent reviewed PRs.
- [ ] Create the GitHub Project board and add existing issues: Backlog, Ready, Working, Waiting, In review and Done, with priority/owner and linked PRs.
- [ ] Configure `main` to require PRs and prevent force pushes/deletion; mandatory external approvals remain zero while working solo. Local evidence is reviewed rather than enforced by a hosted check.
- [ ] [Clear existing full-app lint findings, issue #5](https://github.com/avellir/Cal-Ai/issues/5), then make full lint a required local check.

## What the local command does

It runs TypeScript, all Jest tests, changed-file ESLint, a separate full-app lint audit, and an iOS JavaScript/assets export. Each result is recorded even when another check fails. Required failures return a failing exit code. Full-lint debt is explicitly reported as `audit_failed`, not passed. The export disables dotenv and makes no live nutrition/vision requests or deployments.

The ignored report `.cleanup-backups/local-checks/latest.json` identifies the checked branch, commit, base, uncommitted state and source fingerprint. It is invalid if source changes during the run. The PR should contain a short human-readable result summary, including any remaining audit errors and unperformed device/live checks.

## Existing work and backup

Initial inspection on 2026-10-29 found `main` and `feature/MOB-2-latest-2026-10-08` at `357f98f` with newer application changes in the working folder. The workflow branch starts from that GitHub base. It must not be mistaken for the latest working application.

The original workspace remains on its original feature branch. Its checkpoint is `.cleanup-backups/workflow-2026-10-29/`, containing `history.bundle`, tracked/staged patches, original untracked files and a manifest. Ignored credentials, dependencies and evaluation caches remain in place. The local checkpoint is excluded from Git and is not an off-device backup. Keep it until recovery issue #4 is verified.

## Normal sessions after the transition

1. Open a fresh Codex task in the repository and say: "Continue Cal AI from the saved handoff."
2. Codex reads `AGENTS.md`, the current handoff and linked issue; it resumes unfinished work or selects one ready issue.
3. Codex uses one branch per task, implements a complete small outcome, and prepares commits/PR evidence. It runs local verification only when requested or during the authorized end-of-day test session.
4. At a session boundary, Codex saves the next action and unfinished work in the handoff and updates the task/PR when authorized. A new chat resumes from these records.
5. Review, merge and deployment are separate decisions. After merge, the next task starts from updated `main`.

This is a local check runner plus a documented agent routine, not an unattended agent service. Larger features get a parent spec and small complete tickets; a small fix can use one issue directly.

## Later

Hosted CI, additional reviewers, protected deployment environments and unattended loops can be added when useful. The current ten food photos remain regression examples; independent weighed meals are still needed for an accuracy benchmark.

## References

- [Contribution workflow](../../CONTRIBUTING.md)
- [Current handoff](session.md)
- [Matt Pocock research and primary sources](matt-pocock-research.md)
