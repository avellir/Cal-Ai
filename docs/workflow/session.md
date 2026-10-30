# Current session handoff

GitHub Issues own execution status; priority.md owns ordering. Check live Git
status and the issue before resuming. Updated 30 October 2026.

## Active work

- Issue: [#6](https://github.com/avellir/Cal-Ai/issues/6), context-aware portion
  warnings and stable photo evaluation baseline.
- Branch: feat/improve-food-analysis; fixed base is
  2a3a38a7d5e6e130b43caa60eadf3b55254bd28f (origin/main at PR preparation).
- Draft PR: [#7](https://github.com/avellir/Cal-Ai/pull/7), targeting main and
  closing issue #6. Session implementation is committed/pushed as 8f83cf6;
  the final follow-up records this PR link. No merge/deployment requested.

## Implemented

- Renamed ten original WebP photos to immutable meal_001.webp through
  meal_010.webp, preserving bytes. Index retains original names and SHA-256 hashes.
- Added one photo annotation record per image, five metric definitions, S1-S4
  failure codes, experiment protocols, weighed-meal templates and collection rules.
  No measured meals exist; unknown grams/calorie accuracy remain unscored.
- Checker classifies prepared/whole dishes before ingredient keywords, retains
  consumed-portion confirmation, and uses independent visible counts/fractions.
  Unknown counts are explicit; no count is inferred from the grams under review.
- Herbs/microgreens have no minimum-serving warning, with an upper bound retained.
  Meatballs and scoops use per-item rules; new unit bounds are provisional.
- Updated canonical pipeline context and added a saved-input S3 replay script.
  The runner does not yet automatically score the photo-record schema or measured
  meals. Original evaluator/cache artifacts and local references remain ignored.
- Recorded author and separate same-model version-masked warning reviews. The
  author labeled 4 of 9 judged warnings false alarms, with four others indeterminate.
  The separate reviewer gave 7 useful / 2 false alarms / 4 indeterminate on the
  first revised 13-warning set. These are subjective counts, not stable rates.
- Saved [recognition and collection plan](food-analysis-improvement-plan.md):
  scoreable baseline, one single-pass prompt improvement, explicitly requested
  comparison, seven development/three holdout measured meals, and stage diagnostics.

## Actual verification

- Last focused source state: final session checker, pipeline caller and tests
  now in commit 8f83cf6, before documentation-only updates; Node 24.21.0.
- npm test -- --runInBand --runTestsByPath __tests__/portionValidation.test.ts __tests__/foodAnalysisConsistency.test.ts:
  79/79 tests passed in two suites.
- node scripts/replay-food-portion-check.cjs: ten image hashes matched the saved
  manifest/index; 44 original estimates matched unique raw detections. Zero
  quantity changes, 10 warnings across 6 photos. Relative to the first revision:
  9 texts unchanged, 1 reworded, 3 removed, none added.
- Source hashes/per-component evidence: ignored local artifact
  food_images/evaluation/portion-check/2026-10-29T23-40-23-185Z/results.json.
  Committed narrative: food_images/PORTION_CHECK_RESULTS_2026-10-30.md.
  Raw evaluation inputs/outputs are not available from a fresh checkout.
- Checks not rerun for PR creation, per requested testing schedule. Full Jest,
  typecheck, lint, builds/exports and device QA were not run for this session's
  final source. Historical full lint debt (58 errors/4 warnings, 29 October) is
  tracked by [#5](https://github.com/avellir/Cal-Ai/issues/5), not remeasured here.
- No fresh vision/nutrition requests, meals saved, migration or deployment.

## Remaining and next action

- Review draft PR #7 for issue #6 and preserve recorded verification limits.
- Next implementation slice: make photo annotations scoreable with explicit match/
  reviewer evidence and a frozen recognition baseline. Create its own issue after
  this slice is integrated; do not imply ingredient recognition is fixed yet.
- User can collect measured meals now. No independent holdout exists; do not tune
  against reserved outputs or claim calorie/gram accuracy.
- Numerical dish-level bounds and calibrated unit ranges remain future work.
- Prior publication is already on main at 2a3a38a; recovery review/deployment
  parity issue [#4](https://github.com/avellir/Cal-Ai/issues/4) remains open separately.
