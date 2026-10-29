# Matt Pocock's AI coding workflow: research notes

Checked 2026-10-29 against first-party articles, the published skills source, and Pocock's recorded workshop. The latest published release checked was [v1.3.2](https://github.com/mattpocock/skills/releases/tag/v1.3.2). These notes distinguish his instructions from the suggested Cal AI adaptation below.

## What his workflow actually prescribes

- **Resolve decisions before implementation.** His current coding entry point, `grill-with-docs`, combines the interview technique in `grilling` with `domain-modeling`. His skills are deliberately small and editable rather than an opaque process framework. [Current skill](https://github.com/mattpocock/skills/blob/v1.3.2/skills/engineering/grill-with-docs/SKILL.md), [repository introduction](https://github.com/mattpocock/skills#skills-for-real-engineers).
- **A spec records the destination and decisions.** `to-spec` synthesizes existing understanding rather than reopening the interview. It records the problem, solution, user stories, implementation decisions, testing decisions, and exclusions, including agreed test boundaries. Current guidance explicitly permits skipping both spec and tickets when the change fits one session. [Spec documentation](https://github.com/mattpocock/skills/blob/v1.3.2/docs/engineering/to-spec.md), [spec source](https://github.com/mattpocock/skills/blob/v1.3.2/skills/engineering/to-spec/SKILL.md).
- **Split larger work into independently verifiable vertical slices.** `to-tickets` produces a narrow complete behavior through the layers involved, sized for one fresh context window. Tickets declare blockers. The skill presents the proposed breakdown for a granularity/dependency discussion before publishing to the configured tracker; it supports either a real tracker or local Markdown. It does not require GitHub for every project. [Ticket source](https://github.com/mattpocock/skills/blob/v1.3.2/skills/engineering/to-tickets/SKILL.md).
- **Implement one bounded piece with feedback.** `implement` fetches the named ticket, uses `tdd` where possible, runs typechecking and focused tests during development, runs the full suite at the end, requests review, and commits to the current branch. Current TDD tests behavior at agreed public boundaries, one failing test and minimal implementation at a time; its source now assigns refactoring to review. [Implementation source](https://github.com/mattpocock/skills/blob/v1.3.2/skills/engineering/implement/SKILL.md), [TDD source](https://github.com/mattpocock/skills/blob/v1.3.2/skills/engineering/tdd/SKILL.md).
- **Review against both standards and requirements.** `code-review` compares committed changes with a fixed Git reference and uses separate reviewers for repository standards and the originating issue/spec. The two verdicts remain distinct. Its scope does not replace all bug hunting. [Review documentation](https://github.com/mattpocock/skills/blob/v1.3.2/docs/engineering/code-review.md).
- **Keep human QA.** In the workshop, Pocock recommends fresh-context automated review before human QA, then manually exercises the feature and finds a missing database table. He acknowledges the tension between unattended loops and small, self-contained PRs rather than prescribing one universal solution. [Workshop at 1:05:24](https://www.youtube.com/watch?v=-QFHIoCo-Ko&t=3924s), [manual QA at 1:11:16](https://www.youtube.com/watch?v=-QFHIoCo-Ko&t=4276s), [PR discussion at 59:27](https://www.youtube.com/watch?v=-QFHIoCo-Ko&t=3567s), [publisher's video/transcript](https://ai.engineer/talks/-QFHIoCo-Ko-ai-coding-workflow).

## Current names versus older videos and articles

The [April article](https://www.aihero.dev/skills-post) still describes `domain-model -> to-prd -> to-issues -> tdd`; the workshop shows `write-a-prd` and `prd-to-issues`. Use the installed version's source to resolve names, rather than combining commands from different periods. [Workshop source](https://www.youtube.com/watch?v=-QFHIoCo-Ko&t=1900s).

| Older name or convention | Current source |
| --- | --- |
| `to-prd` | Renamed `to-spec` in v1.1 |
| `to-plan`, `to-issues` | Combined into `to-tickets` in v1.1 |
| `CONTEXT.md`, `CONTEXT-MAP.md` | `GLOSSARY.md`, `GLOSSARY-MAP.md` in v1.3 |
| Standalone `qa` skill | Retired; responsibilities absorbed by `triage` and `to-tickets` |

Sources: [v1.1/v1.2 changelog](https://github.com/mattpocock/skills/blob/v1.3.2/CHANGELOG.md), [Pocock's v1.3 announcement](https://www.aihero.dev/skills/skills-changelog-v13-implement-spec-pr-retro-and-glossary-md). `grill-me` still exists; `grilling` is the reusable interview skill, and `grill-with-docs` is the coding wrapper. [Wrapper source](https://github.com/mattpocock/skills/blob/v1.3.2/skills/engineering/grill-with-docs/SKILL.md).

## Branches and PRs: the important distinction

`implement` does **not** create a branch or open a PR: it commits on the current branch. Its documentation also identifies a review-order problem: review against `HEAD` cannot see uncommitted work. It recommends committing first, then reviewing from the branch base in a fresh session. [Implementation documentation](https://www.aihero.dev/skills-implement).

`pr` only defines the PR body: Summary, Evidence, and Merge Danger (reversibility and blast radius). It does not push, publish, merge, or split a large diff. `implement-spec` is a separate, heavier orchestration option: worktree implementers land onto one integration branch; PR creation depends on tracker conventions or an explicit request. [PR documentation](https://github.com/mattpocock/skills/blob/v1.3.2/docs/engineering/pr.md), [v1.3 announcement](https://www.aihero.dev/skills/skills-changelog-v13-implement-spec-pr-retro-and-glossary-md).

## Suggested Cal AI adaptation, not Pocock's exact rules

For this solo Expo/React Native + Supabase app, start with a manual loop:

1. Use one issue for one demonstrable outcome, with acceptance criteria, exclusions, dependencies, and validation. Write a parent spec only when the work needs multiple sessions or slices.
2. Create one branch from the intended base per issue and one PR per issue. Branch naming, issue labels, and merge style are local repository conventions, not claims about his prescribed workflow.
3. Implement the slice across the required route, service, store, and database boundaries. For example, a retry action should reach the real analysis service and visibly recover from a failure; a separate UI-only ticket that cannot demonstrate recovery is a weaker slice.
4. Run focused behavior tests during development, then the existing Jest suite, lint, and typecheck before review. Use tests for meaningful service/store behavior and error paths; use device/simulator QA and screenshots for visual or native behavior.
5. Commit, review the committed diff against the fixed branch base and the issue, resolve findings, then manually exercise acceptance criteria. Include Supabase migration/RLS checks and environment notes when those areas change.
6. Put concise change, validation evidence, and material risk in the PR. Human review and QA decide readiness to merge. Close the issue through the merged PR, keeping unfinished work visible.

Adopt deterministic AFK loops, multiple worktrees, or whole-spec orchestration only after this small loop is reliable. No extra planning framework is required to get the useful parts: clear decisions, small complete slices, fast feedback, independent review, and human QA.
