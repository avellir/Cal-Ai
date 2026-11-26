# Stage-isolation experiments

These are protocols and collection templates, not executed experiments or wired
runner modes. No measured meals are available yet. Use the five primary metrics
in [METRICS.md](METRICS.md); the gram comparison below is a stage diagnostic.

Evaluation stages (conceptual labels, not source-code step numbers):

1. S1: food identity, inclusion and scope, including filtering and deduplication.
2. S2: quantities estimated from the photo.
3. S3: portion validation and its warnings/adjustments.
4. S4: nutrition lookup, reference selection and quantity scaling.

S1 and S2 share a vision call today. Do not introduce extra provider calls simply
to match these labels. Pin the photo hashes, annotations, client source, deployed
function versions, model settings and fixed ground-truth references for a run.

## A. Lookup with measured foods and grams

Use completed `weighed/meal_NNN.ground-truth.json` records. Bypass S1-S3 entirely:
build canonical ingredients from the measured foods, preparation states and
consumed grams, including every measured cooking fat. Call the existing
`lookupFoodNutrition` path and use `resolveIngredient` for the same reference
scaling as the app. Lookup selects references; gram scaling happens downstream.
Do not substitute the USDA ground-truth entry into the app's FatSecret lookup.

Retain input components, contexts, selected IDs/names, serving basis, raw/cooked
state, scaled component kcal, unresolved entries and total. Keep identities
explicit (including preparation) and use `g`; never relabel ml as grams. Do not
run vision, portion validation, hidden-food filtering or deduplication over these
inputs. Separate measured components must not disappear or be counted twice.

Compare the complete total with `true_kcal`. Report MAPE, signed percentage bias,
absolute kcal error and eligible/unscored counts using METRICS.md. Incomplete
lookup results are unscored, with unresolved components reported separately.
Compare with the full pipeline on the same meal IDs and show both eligibility
counts plus the paired eligible set; do not hide failures by dropping them.

This isolates error with correct foods and quantities supplied. It is a practical
reference for perfect upstream inputs, not a guaranteed mathematical lower bound:
upstream errors can accidentally cancel lookup errors. Residual differences can
include database composition differences from USDA, as well as incorrect entry,
preparation or scaling. A missing fat is S4 only if it was correctly supplied
here; a fat omitted from the measurements invalidates ground truth.

## B. Portion check before versus after

Capture canonical ingredient identities, grams and stable occurrence/region keys
immediately before the `validatePortionSize` map and immediately after it, before
deduplication. Save warnings, `wasAdjusted` and adjustment reasons. Both snapshots
must come from the same vision response, with no correction or second vision call.

Match the same correctly identified component to measured grams `g > 0`. For each:

- Before absolute gram error: `abs(before_g - g)`.
- After absolute gram error: `abs(after_g - g)`.
- Error change: `after_error - before_error`; negative improves, positive worsens.
- Before/after signed percentage error: `100 * (estimate_g - g) / g`.

Report paired mean absolute gram error and mean absolute percentage error before
and after, plus improved/unchanged/worsened counts. Break down by food category,
visible count and whole-dish versus component representation, with sample counts.
Exclude misidentified, missing, duplicated or unmeasured components from the paired
gram calculation; retain their failures and excluded counts separately. Do not
interpret a smaller total-meal error as proof that every component improved.

Current implementation: ordinary quantities are preserved; values above 10,000
g/ml are capped. Beverages bypass the caller's validation map. Warnings can change
the review experience even when grams do not change. Record whether each warning
was useful, inappropriate or missing; do not claim warning benefit from unchanged
gram scores. Define any acceptable-error tolerance before inspecting predictions.

Checker revision after the initial replay: prepared/whole dishes skip ingredient
ranges; countable foods use visible count and fraction. Without a count they emit
an explicit "Count unknown" note, with no count derived from estimated grams.
Serving ranges for bulk foods are not multiplied by item counts. The class-based
follow-up adds no-minimum herb guidelines and count-aware meatball/scoop handling.
It passed 79 focused tests and was replayed on the same ten photos, changing no
quantities. See `PORTION_CHECK_RESULTS_2026-10-30.md` for source-specific results
and the separate reviewer audit. Report tiny hand-labeled samples as counts,
retain indeterminate labels and reviewer identity, and do not target zero warnings
on this tuning set.
Whole dishes currently have no numerical guideline beyond the existing schema
ceiling; a dish-level range remains future work.

Do not keep or remove S3 on the aggregate alone. Investigate repeatable regressions
by category and retain supported input guards independently of serving guidelines.

## Failure attribution

Keep `photo-records.json` and its observed `known_failures` strings intact. Store
new run-specific evidence using `templates/failure-record.template.json` in the
run's artifacts. One record identifies one observed issue; multiple category codes
are allowed when evidence establishes multiple stages. Unknown attribution stays
null until reviewed. Never infer a stage solely from final calorie error.

| Code | Evidence required |
|---|---|
| S1_misidentified | A detected item's identity contradicts the annotated food |
| S1_missed_item | A confidently visible annotated item was not identified |
| S1_hallucinated | An included food is confirmed absent; uncertainty alone is insufficient |
| S1_background_included | An annotated exclusion is included in the meal |
| S2_portion_over | Correctly matched component has estimated grams above measured grams |
| S2_portion_under | Correctly matched component has estimated grams below measured grams |
| S3_check_made_worse | Paired absolute gram error increases after the check |
| S3_check_missed | A predeclared unacceptable portion error receives no relevant warning or useful correction |
| S4_wrong_entry | Correct supplied identity/preparation maps to an incompatible reference |
| S4_raw_vs_cooked | Lookup/scaling uses a preparation basis inconsistent with the supplied weight |
| S4_missing_fat | A correctly supplied measured fat is omitted or lost in lookup/scaling |

Record numeric error even when applying an agreed tolerance to failure labels.
Inappropriate warnings are recorded in the evidence as S3 observations; do not
force them into `S3_check_made_worse` when grams never changed. A hidden fat missed
upstream belongs to S1; missing clarification also affects uncertainty handling.
If raw/cooked state was already wrong upstream, attribute that origin separately.

## Cases to collect deliberately

- Rice, pasta and meat with exact cooked/raw state matching the measured weight.
- Added oil, butter and dressing with measured consumed amounts; do not assume
  all fat poured into a pan was eaten.
- Mixed dishes with measured recipe ingredients, final cooked yield and served
  fraction. Do not add full-dish weight to separate internal ingredients. If
  component allocation is unknown, leave per-component gram scoring unscored.
- Unusually large and small plates, preferably paired photos of the same measured
  portion. Today `imageContext.plateSize` is not used by the portion check; this
  tests vision anchoring unless a future S3 change adds plate-size logic.

Start with ten independently measured meals covering several categories. Repeated
photos of one meal are paired diagnostics, not additional independent meals.
Select the set before results are inspected. Real provider experiments require
an explicit request; this document does not run them or deploy changes.
