# Food recognition improvements and measured-meal collection

Status: proposed execution plan, 30 October 2026. Work is on
`feat/improve-food-analysis`; dataset/checker groundwork is tracked in
[issue #6](https://github.com/avellir/Cal-Ai/issues/6) and its session PR.
This plan authorizes no provider runs, deployment or release by itself. Create
linked execution issues for the slices when implementation starts; these slices
are not GitHub execution-status records.

## Outcome and current evidence

Reduce demonstrated visible-ingredient omissions while collecting enough measured
meals to separate recognition, quantity and nutrition-reference errors. The
repeated cucumber omission is a confirmed recognition case. Soup/casserole recipe
fit is a separate reference/uncertainty problem, not proof of a weight error.

The ten existing photos are the tuning set. None has measured component weights
or reference calories. Current S3 diagnostics preserve all 44 quantities; warning
improvements cannot establish calorie accuracy. Last focused checks: 79 tests
passed in two suites. Broader verification has not been requested or rerun.

## Track A: fix visible recognition errors (agent)

### A1. Freeze and score the recognition baseline

- Preserve stable IDs, original bytes and image hashes. Snapshot photo annotations,
  model/deployment/prompt versions and source revision with every comparison.
- Record explicit expected-item matches and evidence in a per-run review artifact.
  Accept equivalent broad food names; mark ambiguous cases indeterminate. Never
  infer ingredient detection solely from a whole-dish name.
- Score visible-item recall, false-item rate, background leakage and uncertainty
  handling using `food_images/METRICS.md`; retain numerators and denominators.
  Actual calorie errors remain unscored on this set.
- Distinguish historical saved results from a fresh baseline. Independent review
  should use shuffled predictions with variant metadata hidden. Keep reviewer
  provenance and disagreements rather than turning them into consensus by fiat.

Done when every photo has a traceable assessment, uncertain/excluded labels stay
separate, and incomplete/unjudged cases are visible. Do this before changing vision.

### A2. Improve the existing single-pass vision prompt

- Inspect how the combined vision output and canonical conversion describe
  component-based dishes, then make one focused prompt change: check the visible
  meal systematically for distinct components before returning the result.
- Require visual evidence for each food, preserve visible counts/fractions and
  scope, and keep hidden fats, fillings and recipe identities explicitly uncertain.
- Preserve whole-dish representation for soups, stews and covered casseroles;
  avoid forcing speculative ingredients beneath toppings into the visible list.
- Use general scene/food rules. No photo IDs, filenames, benchmark-specific foods,
  expected weights or answer lists in production prompts.

Done when the candidate can be compared to the fixed baseline, while retaining
canonical `AdvancedAnalysisResult`, valid units and existing correction flows.

### A3. Compare quality before adding a second vision call

On an explicitly requested live evaluation, compare baseline and candidate on the
same originals using pinned model settings. Start with one fresh run per variant
on all ten photos. Preselect the salad omission case and two other challenging
scenes by complexity/scope before viewing candidate results, and repeat each
twice more per variant: 32 vision
requests in total. This is a proposed request budget, not a run already made.
Nutrition calls are separate and unnecessary for the initial recognition score.
Use a non-production evaluation path with the actual candidate prompt, record
deployed version parity, and do not describe a local edit as a deployed experiment.

Acceptance on the development sample:

- Fewer visible omissions overall; cucumber recovered in all three planned runs
  for its scene. Inspect differences per photo, not just an aggregate fraction.
- No increase in confirmed unsupported additions or excluded objects included;
  unresolved adjudications prevent claiming that comparison passed.
- No duplicate food quantities or whole-dish-plus-internal-ingredient double count.
- Explicit uncertainties remain uncertainties. Report regressions and raw counts,
  plus latency and actual request counts. The small sample is not a stable accuracy
  estimate, and all runs belong to the development set.

If single-pass changes still leave repeated omissions, create a separate slice
for at most one selective completeness check on complex component-based meals.
Compare its gain, latency and request cost against the best single-pass version.
Trigger by scene complexity/scope rather than confidence alone; preserve the first
result if the check fails. Predeclare comparison criteria before running it. Do
not add the extra call by default without evidence and an explicit rollout decision.

## Track B: collect measured meals (user, with agent data preparation)

### B1. Collect ten independent meals

Use `food_images/weighed/README.md` and the blank weighed-meal template. Start with
ordinary meals: separable protein/grain/vegetables, counted items, a dressed salad,
and meals with measured added fat. Add a soup/stew or casserole only when the
recipe yield and served fraction can be documented. Vary portions and plate size;
do not reproduce only the existing ten compositions.

For each meal, the user weighs edible components, records raw/cooked state and
consumed cooking fat, and photographs the assembled portion immediately before
eating. The agent records stable IDs, photo hashes and fixed USDA SR Legacy April
2018 food IDs/energy values, then calculates reference calories. Verify reference
state and consumed scope before marking a record complete. Unknown fat retention
or leftovers stay explicit and can make a meal unscorable.

### B2. Reserve three meals before inspecting predictions

Assign seven meals to development and three to holdout in a separate split
manifest, stratifying broadly across food classes where possible. All photos of
the same meal/recipe batch stay in the same split. Freeze reference records and
hashes before running the app. Independent labeling can occur before evaluation,
but keep holdout outputs and answers out of implementation/prompt tuning.

Keep the original ten unweighed photos as development examples. No existing photo
becomes a holdout by renaming it. If holdout results guide another change, retire
that holdout into development and collect new independent meals for the next read.

Done when ten independent meal records are complete with source/measurement
provenance and a recorded seven/three split. Three holdout meals provide an early
check only; collect more before strong generalization or accuracy claims.

## Join the tracks: diagnose and choose the next investment

### C1. Implement and run the two stage-isolation evaluations

Implementation can proceed while meals are being collected. Build evaluation-only
support for the measured-record format and weighed subset; do not feed answer
weights or identities into the normal full-photo run.

1. Correct measured foods/preparation/grams -> existing nutrition lookup/scaling.
   Record selected reference IDs and per-component errors against fixed-source
   calories. Differences can include database composition mismatch.
2. Full photo pipeline -> measured component grams and meal calories. Capture S3
   before/after inputs in the same run and record count/dish/warning context.

Use `food_images/EXPERIMENTS.md` for matching, missing-data and stage-attribution
rules. Full-meal totals with unresolved ingredients are unscored, not zeros or
complete predictions. Compare the same eligible meal IDs and show exclusions.

On the seven development meals, report MAPE, signed percentage bias, absolute kcal
error and eligible counts. Retain component gram diagnostics and the five primary
metrics; do not create a combined score. Use S1-S4 failure evidence to decide
whether to invest next in detection, quantity estimation or recipe/reference fit.

### C2. Freeze the candidate, then evaluate the holdout once

Lock prompts, rules and references before opening holdout outputs. Report each
held-out meal and the small-sample summaries, including failures. Make no fixes
against those three meals while calling them independent evaluation. Obtain an
explicit release decision separately from any merge or Supabase deployment.

## Implementation order and next action

1. A1: recognition scoring/review artifact and frozen development baseline.
2. A2: one single-pass completeness improvement. B1/B2 collection proceeds while
   agent work continues; no measured-meal dependency for fixing clear omissions.
3. A3: requested paired fresh recognition evaluation and a keep/revise decision.
4. C1: measured-data evaluator and stage diagnostics once records are available.
5. C2: frozen candidate holdout evaluation; choose the next work from observed errors.

Create one execution issue per complete slice, with acceptance criteria above;
keep one active implementation issue at a time. Do not turn collection into a
blocker for A1/A2. Run focused checks only when requested, and broad verification
only under the repository testing schedule. Record unrun device/live checks and
undeployed code in the handoff and eventual PR.

Immediate next agent task: A1, make the existing photo-record schema scoreable
with explicit matching/reviewer evidence and a frozen baseline snapshot.
Immediate next user task: collect the first three weighed meals using the existing
template; agree the full development/holdout split before examining predictions.
