# Workflow rollout

## First transition

- [x] Read the actual Git/GitHub state and research Matt Pocock's workflow.
- [x] Preserve current tracked changes, untracked files and Git history in an ignored local checkpoint.
- [x] Make `priority.md` the canonical food-analysis priority list.
- [x] Prepare issue/PR templates, agent instructions and CI in a separate worktree.
- [ ] Run the workflow checks on the exact proposed commit and open a draft workflow PR.
- [ ] Merge the workflow PR after checks and review.
- [ ] Configure the `main` rule to require PRs and **Quality**, preventing force pushes/deletion. Keep mandatory external approvals at zero while working solo.
- [ ] Recover the existing FatSecret/vision/evaluation work into coherent reviewed PRs. Preserve the source branch and local checkpoint until the recovery is verified.
- [ ] Resolve existing full-app lint findings, then make full lint blocking.

Inspection on 2026-10-29: GitHub `main` and `feature/MOB-2-latest-2026-10-08` both point to `357f98f`; two older feature branches also exist. No open issues, open PRs, `.github` directory on `main`, or repository rulesets were returned. Branches report `protected: false`. Avoid deleting old branches while checking whether their work is incorporated.

The local checkpoint is `.cleanup-backups/workflow-2026-10-29/`: `history.bundle`, `working-tree.patch`, a separate staged patch, original untracked files and a manifest. Ignored environment files, dependencies and evaluation caches stay in their existing locations. The checkpoint is local and excluded from Git. It protects the transition but is not an off-device backup.

## Initial GitHub backlog

Create tasks with the supplied issue form. Keep this as the rollout checklist; once tasks are published, their issue state is authoritative.

| Order | Outcome | Acceptance |
|---|---|---|
| First | Recover current application/backend work | Inventory existing changes, preserve dependencies, scan staged files for credentials/generated artifacts, and land coherent PRs with relevant checks. Record deployed function versions separately. |
| Next | Fix count/dish-aware portion warnings | Three eggs do not get a one-egg warning; soup is classified before its chicken ingredient; quantities remain unchanged. |
| Next | Investigate missed visible ingredients | Establish omission/false-addition annotations, compare an improved single pass with at most one selective check, and retain only a measured improvement. |
| Next | Improve recipe fit | Separate successful lookup from recipe suitability; retain explicit assumptions for soup, casserole, spreads and sauces. |
| Next | Retry failed ingredients from results | Use saved context, preserve healthy matches and user edits, and make no vision call. |
| Release gate | Remove existing lint debt | Full-app lint passes without broad rule suppression, then becomes blocking. |

The warning fix can land as a small independent task while product priorities remain in `priority.md`. New measured meals are needed for a true accuracy benchmark; the ten existing images remain regression examples.

## Deliberate later additions

GitHub Projects, additional reviewers, protected deployment environments, release tagging, and unattended agent loops can be introduced when needed. Begin with the issue/branch/PR/check/review loop and keep deployment explicit. Do not mistake a local configuration file or a suggested setting for a setting already active on GitHub.

## References

- [Repository contribution workflow](../../CONTRIBUTING.md)
- [GitHub branch rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Required status checks](https://docs.github.com/en/pull-requests/reference/status-checks)
