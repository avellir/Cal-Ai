# Food recognition improvements and measured-meal collection

Status: proposed execution plan, revised 30 October 2026. Work is on
`feat/improve-food-analysis`; dataset/checker groundwork is tracked in
[issue #6](https://github.com/avellir/Cal-Ai/issues/6) and draft PR #7.
This plan authorizes no provider runs, deployment or release by itself. Create
linked execution issues for the slices when implementation starts; these slices
are not GitHub execution-status records.

## Summary

Priority (revised 30 October 2026): measured meals come first. Recognition is
already the strongest stage; grams and hidden fat drive calorie error and are
currently unmeasured. Track B starts immediately; Track A stays small.

| Slice | Owner | Depends on | Provider requests | Output |
|---|---|---|---|---|
| B0 External measured photos | User finds, agent vets | None | 0 | Up to 20 vetted external records, separate benchmark |
| B1 Collect meals | User + agent prep | None | 0 | 10 measured records |
| B2 Split | User + agent | B0/B1 records frozen | 0 | Dev / holdout manifest per source |
| A1 Scoreable baseline | Agent | PR #7 integrated | 0 (saved results) | Review artifact, frozen baseline |
| A2 Prompt candidate | Agent | A1 | 0 | `stable-food-v4` prompt behind a version, fixture tests |
| A3 Paired comparison | Agent, on request | A2 | 32 vision, 0 nutrition | Keep/revise decision |
| C1 Stage diagnostics | Agent, on request | B2 | Estimated in its issue | S1-S4 attribution on dev meals |
| C2 Holdout read | Agent, on request | C1, frozen candidate | One run per holdout meal | Early generalization check |

Out of scope here: per-ingredient nutrition retry (priority 6), numerical
dish-level portion bounds, and recipe-fit work (priority 4) unless C1 shows it
dominates error.

## Outcome and current evidence

Reduce demonstrated visible-ingredient omissions while collecting enough measured
meals to separate recognition, quantity and nutrition-reference errors.

Recognition defects observed on the ten tuning photos (run
`2026-10-29T14-32-10-853Z-01b24d` and `ANALYSIS_VERDICT_2026-10-29.md`):

| Photo | Defect | Label |
|---|---|---|
| meal_005 grain salad | Visible cucumber slices omitted in both saved fresh detections | Confirmed omission |
| meal_007 meatballs/rice | Red pepper-like pieces not represented | Probable omission; confirm in A1 |
| meal_008 fried eggs | Chives identified as dill | Minor misidentification, not an omission |

Everything else was judged broadly correct, including counts and background
exclusion. Expected recognition gain is therefore small; the main risk of a
prompt change is regressing photos that are currently correct.

Nutrition coverage is a separate, already-improved stage: the latest controlled
lookup replay matched 43/44 detected ingredients with complete coverage for 9/10
meals (see `priority.md`). Soup/casserole recipe fit is a reference/uncertainty
problem, not proof of a weight error.

None of the ten photos has measured component weights or reference calories.
Current S3 diagnostics preserve all 44 quantities; warning improvements cannot
establish calorie accuracy. Last focused checks: 79 tests passed in two suites.
Broader verification has not been requested or rerun.

### Current vision pipeline facts that constrain this plan

- The client sends `measurementVersion: 'stable-food-v3'`; the edge function uses
  `STABLE_FOOD_PROMPT` only when that value equals `ANALYSIS_VERSION`. Any other
  value falls back to the legacy `COMBINED_ANALYSIS_PROMPT`. Bumping the server
  version alone would silently switch already-installed clients to the legacy
  prompt.
- A conditional second vision call already exists: layered dishes
  (pizza/flatbread/toast) trigger `mode: 'refine'`. "Single-pass" below means the
  main `analyze` call for non-layered meals; the refine path is unchanged.
- Vision runs with `reasoning: { effort: 'low' }` and no temperature/seed control,
  so repeated runs of the same variant can differ. Repeat counts below exist for
  that reason.

## Track A: fix visible recognition errors (agent)

### A1. Freeze and score the recognition baseline

- Preserve stable IDs, original bytes and image hashes. Snapshot photo annotations,
  model deployment, `ANALYSIS_VERSION`, prompt hash and source revision with
  every comparison.
- Record explicit expected-item matches and evidence in a per-run review artifact.
  Accept equivalent broad food names; mark ambiguous cases indeterminate. Never
  infer ingredient detection solely from a whole-dish name.
- Re-inspect meal_007 and decide whether the red pepper is a visible annotated
  item or uncertain. Decide labels before any candidate output exists.
- Score visible-item recall, false-item rate, background leakage and uncertainty
  handling using `food_images/METRICS.md`; retain numerators and denominators.
  Actual calorie errors remain unscored on this set.
- Distinguish historical saved results from a fresh baseline. Independent review
  should use shuffled predictions with variant metadata hidden. Keep reviewer
  provenance and disagreements rather than turning them into consensus by fiat.
  Prior reviews were same-model; the user adjudicates disagreements on the three
  repeated scenes.
- Make the scorer a script that reads saved run results and the annotation file,
  so A3 and later runs are scored identically rather than by hand.

Done when every photo has a traceable assessment, uncertain/excluded labels stay
separate, incomplete/unjudged cases are visible, and the scorer reproduces the
baseline numbers from saved files. Do this before changing vision.

### A2. Improve the existing single-pass vision prompt

- Make one focused change to `STABLE_FOOD_PROMPT`: before returning, check the
  visible meal systematically (for example, region by region) for distinct
  components and small sliced vegetables mixed into bases.
- Require visual evidence for each food, preserve visible counts/fractions and
  scope, and keep hidden fats, fillings and recipe identities explicitly uncertain.
- Preserve whole-dish representation for soups, stews and covered casseroles;
  avoid forcing speculative ingredients beneath toppings into the visible list.
- Use general scene/food rules. No photo IDs, filenames, benchmark-specific foods
  (do not name cucumber), expected weights or answer lists in production prompts.
- Ship the candidate as a new version (`stable-food-v4`) selected explicitly by
  the client. The server must keep serving `stable-food-v3` unchanged so installed
  clients and rollback keep working. Record the prompt hash in run metadata.
- Do not change reasoning effort, output limits or the model in this slice; one
  variable per comparison.
- Add fixture tests using saved vision responses (no provider calls) proving the
  candidate output shape still converts to canonical `AdvancedAnalysisResult`,
  keeps valid units (`g`/`ml`/`serving`) and does not double count a whole dish and
  its internal ingredients. Run them when checks are requested.

Done when the candidate is version-selectable, v3 behaviour is unchanged, and the
candidate can be compared to the fixed baseline with existing correction flows.

### A3. Compare quality before adding another vision call

On an explicitly requested live evaluation, compare v3 and v4 on the same
originals with the same deployment and settings. Run one fresh pass per variant
on all ten photos, then two more runs per variant on three scenes fixed now:

- meal_005: the confirmed cucumber omission.
- meal_007: crowded plate with a probable omission.
- meal_010: many small items, counts and partial fractions; tests regressions.

Total: 10 + 10 + (3 x 2 x 2) = 32 vision requests. Interleave variants per photo
to limit drift. Nutrition calls are unnecessary for the recognition score. Use a
non-production evaluation path with the actual candidate prompt, record deployed
version parity, and do not describe a local edit as a deployed experiment.

Acceptance on the development sample (thresholds fixed before running):

- meal_005: cucumber present in 3/3 candidate runs.
- No regression: no photo loses a visible item that baseline found in its runs
  without being compensated by an equivalent broad match; inspect per photo.
- No increase in confirmed unsupported additions or background leakage;
  unresolved adjudications prevent claiming the comparison passed.
- No duplicated quantities or whole-dish-plus-internal-ingredient double count.
- Zero parse/schema failures across all 16 candidate requests.
- Median latency and output tokens increase by no more than 20%; report actual
  values and request counts regardless.
- Explicit uncertainties remain uncertainties. Report raw counts and every
  regression. The sample is development data, not an accuracy estimate.

If single-pass changes still leave repeated omissions, try the cheaper lever first
in its own slice: the same v3/v4 prompt with higher reasoning effort, compared on
latency and cost. Only then consider one selective completeness check for complex
component-based meals, compared against the best single-pass version. Trigger it
by scene complexity/scope rather than confidence alone, keep the first result if
the check fails, merge additions through the canonical pipeline before nutrition
lookup, and predeclare criteria before running. Do not add the extra call by
default without evidence and an explicit rollout decision.

## Track B: collect measured meals (user, with agent data preparation)

### B0. Vet external photos with published grams and calories

External examples measure accuracy; they do not improve it by themselves. They
help by revealing systematic bias (for example, consistent gram underestimation
for starches) that a later change can target and a holdout can confirm.

Accept an external example only when all of the following hold:

- Per-component grams were measured by weighing, not estimated or taken from a
  recipe or menu. Menu/package calories alone are too loose for ground truth.
- The photo shows exactly the weighed portion, uncropped, with nothing added or
  eaten after weighing.
- The calorie source is documented (database and entry, or lab value).
- The licence permits storing the image in this repository; record it.
- Prefer ordinary phone-angle photos of home or restaurant plates. Overhead
  studio or cafeteria-tray images are a different use case; tag them.

Public research datasets such as Nutrition5k (overhead cafeteria dishes with
weighed ingredients) can supply such records, but public images may already be
in model training data. Treat them as a separate benchmark source: report their
MAPE/bias separately from user-collected meals and never merge the summaries.
Verify each dataset's licence and measurement method before intake.

Store accepted records with the same ID, hash and template rules, adding
`source_type: "external"`, the source URL, licence and the original calorie
basis. Do not convert external calories to USDA SR Legacy unless every component
can be matched; otherwise keep the source's own calories and label the basis.

Split 20 external examples about 14 development / 6 holdout before running the
app on them. Never place their answers in production prompts.

### B1. Collect ten independent meals

Use `food_images/weighed/README.md` and the blank weighed-meal template. Start with
ordinary meals: separable protein/grain/vegetables, counted items, a dressed salad
with small mixed vegetables, and meals with measured added fat. Add a soup/stew or
casserole only when the recipe yield and served fraction can be documented. Vary
portions and plate size; do not reproduce only the existing ten compositions.

For each meal, the user weighs edible components, records raw/cooked state and
consumed cooking fat, and photographs the assembled portion immediately before
eating. Before cooking, check that every component has a compatible USDA SR
Legacy April 2018 entry; swap the meal otherwise. The agent records stable IDs,
photo hashes, fixed FDC IDs/energy values, then calculates reference calories.
Verify reference state and consumed scope before marking a record complete.
Unknown fat retention or leftovers stay explicit and can make a meal unscorable.

Practical pace: three meals in the first batch, then review the records for
template problems before collecting the remaining seven.

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
provenance and a recorded seven/three split. Three holdout meals are a smoke check
only: with n = 3, a single meal can move MAPE by tens of points. Grow toward about
20 meals (for example 14/6) before any generalization or accuracy claim.

## Join the tracks: diagnose and choose the next investment

### C1. Implement and run the two stage-isolation evaluations

Implementation can proceed while meals are being collected. Build evaluation-only
support for the measured-record format and weighed subset; do not feed answer
weights or identities into the normal full-photo run.

1. Correct measured foods/preparation/grams -> existing nutrition lookup/scaling.
   Record selected reference IDs and per-component errors against fixed-source
   calories. The nutrition selector is also a model call; record its deployment
   and selected IDs, and repeat once to show whether selection is stable.
   Differences can include database composition mismatch.
2. Full photo pipeline -> measured component grams and meal calories. Capture S3
   before/after inputs in the same run and record count/dish/warning context.

Use `food_images/EXPERIMENTS.md` for matching, missing-data and stage-attribution
rules. Full-meal totals with unresolved ingredients are unscored, not zeros or
complete predictions. Compare the same eligible meal IDs and show exclusions.
State the request budget in the C1 issue before running.

On the seven development meals, report MAPE, signed percentage bias, absolute kcal
error and eligible counts. Retain component gram diagnostics and the five primary
metrics; do not create a combined score. Use S1-S4 failure evidence to decide
whether to invest next in detection, quantity estimation or recipe/reference fit.

### C2. Freeze the candidate, then evaluate the holdout once

Lock prompts, versions, rules and references before opening holdout outputs.
Report each held-out meal and the small-sample summaries, including failures. Make
no fixes against those three meals while calling them independent evaluation.
Obtain an explicit release decision separately from any merge or Supabase
deployment; a v4 rollout requires the edge function and a client that sends v4.

## Implementation order and next action

1. B0/B1: collect and vet measured examples (external and own weighed meals);
   freeze them and record B2 splits before any prediction is viewed.
2. C1 evaluator: measured-record scoring and stage diagnostics, built while data
   arrives; run on development records on request.
3. A1: scorer script, review artifact and frozen recognition baseline.
4. A2/A3: one versioned completeness change and its paired comparison, kept small;
   it does not block or replace measurement work.
5. C2: frozen candidate holdout evaluation; choose the next work (likely portion
   estimation or hidden-fat handling) from observed errors.

Create one execution issue per complete slice, with acceptance criteria above;
keep one active implementation issue at a time. Do not turn collection into a
blocker for A1/A2. Run focused checks only when requested, and broad verification
only under the repository testing schedule. Record unrun device/live checks and
undeployed code in the handoff and eventual PR.

Immediate next user task: gather candidate external examples (with sources) and
weigh the first three own meals using the existing template; review them with the
agent before collecting the rest.
Immediate next agent task: vet submitted external examples against B0, extend
the weighed-meal template with external-source fields, and start the C1
measured-record evaluator. Agree all splits before examining predictions.
