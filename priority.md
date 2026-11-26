# Food analysis priorities

Canonical priority list. Reviewed 29 October 2026 against current source, saved evaluations and the original salad, chicken-soup and fruit-breakfast photos. This is a proposed implementation sequence. No application changes or new provider requests were made during this review.

## Current baseline

- Complete-reference recovery and ingredient failure isolation are implemented and deployed.
- The latest controlled lookup replay completed 10/10 meals, matched 43/44 detected ingredients, and produced complete reference coverage for 9/10 meals. The remaining sushi-roll identity is unresolved intentionally.
- These numbers measure coverage of foods already detected. They do not measure missed ingredients, recipe suitability or calorie accuracy. The latest replay reused saved vision responses.
- Ingredient correction, manual nutrition, region selection, serving review, approximate-reference labels, photo amount ranges and visible-fat handling already exist. Extend these features rather than implementing them again.
- The October 1 production plan and the earlier phase document contain historical descriptions superseded by current code. This document continues the food-analysis work; it does not re-audit the broader release plan.

## Remaining priorities

The [recognition and measured-meal execution plan](docs/workflow/food-analysis-improvement-plan.md)
starts with visible-ingredient scoring and a single-pass completeness improvement
while measured meals are collected. It defines verifiable slices and an initial
seven-meal development / three-meal holdout split. No new execution issues or live
vision evaluations have been created by that planning step. The completed
dataset/checker groundwork is tracked in [issue #6](https://github.com/avellir/Cal-Ai/issues/6);
follow-up recognition slices remain to be created.

The table orders product priorities. GitHub Issues track execution status and PRs; link them here once created. Keep detailed acceptance criteria below.

| Priority | Improvement | Evidence and intended outcome |
|---|---|---|
| 3 | Recover missed visible ingredients | Cucumber is visible in the grain salad but absent in both saved fresh detections. Evaluate a bounded completeness check for complex component-based dishes. |
| 4 | Improve recipe fit and treatment of uncertainty | Chicken-heavy soup uses an average prepared-soup reference; casserole uses a recipe containing rice and mushroom sauce; bread spread retains a butter/cream-cheese ambiguity. Keep these assumptions explicit and improve matching where evidence supports it. |
| 5 | Make portion warnings aware of counts and dish type | Three fried eggs at 150 g trigger a one-egg guideline; the 700 g chicken stew receives a 30–180 g protein guideline. Preserve quantities and produce warnings relevant to the whole food being assessed. |
| 6 | Retry only failed nutrition lookups | The result-screen retry currently reruns vision and replaces the analysis. Extend the new per-ingredient backend behavior through the canonical analysis and UI, preserving successful matches and user corrections. |
| 7 | Measure accuracy, stability, latency and cost | The ten photos expose useful defects but have no weighed ground truth. Add independent measured meals and repeated scans before making an accuracy claim. |

Start a small annotation baseline before priority 3 so its effect can be compared fairly. Add a case to that baseline whenever a later priority exposes a new failure.

## 3. Missed visible ingredients

First record the existing omissions and background exclusions in the evaluation annotations. Separate clearly visible foods from uncertain or concealed ingredients. Cucumber is a defensible positive case; minor garnish species and partly obscured pieces need cautious labels.

Experiment with at most one additional vision check for crowded bowls and plates represented as separate components. Ask it to identify visible omissions, their evidence and estimated amounts, using the first result as context. Keep existing detections and quantities unless there is a supported contradiction; merge additions through the canonical pipeline before nutrition lookup. Failure of this optional check must preserve the first analysis.

Do not use a low confidence score as the only trigger: an omitted ingredient can coexist with confident detected foods. Compare an improved single-pass prompt with the selective second check before choosing the extra call. Evaluate the trigger itself, extra latency and paid-call count. No image filenames, benchmark-specific foods or expected benchmark weights belong in production rules.

Acceptance: measure ingredient omissions and unsupported additions separately over repeated runs. The salad's visible cucumber should be recovered consistently, while tabletop food, background supplies and whole-dish internal ingredients remain excluded. Existing quantities must not be multiplied or counted twice. Ship an extra-call path only if the observed quality gain justifies its measured cost and latency.

Likely implementation: `supabase/functions/analyze-food/index.ts`, `services/advancedFoodAnalysis.ts`, existing scope/deduplication helpers and evaluation annotations.

## 4. Recipe fit and uncertainty

Distinguish matching the broad food family from matching the preparation, food form and recipe. A successful provider lookup alone must not establish that a recipe is known. Preserve the observed dish name, selected FatSecret reference and the specific assumptions behind an approximate match.

For the soup, compare the current average-recipe approach with component estimation only when visible solids and the remaining liquid can be represented as disjoint quantities. Do not combine the full soup weight with additional chicken. If reliable separation is unavailable, retain the whole-dish estimate and state its recipe limitation.

For the casserole, the selected recipe is a proxy: its rice/mushroom ingredients are not visually confirmed through the cheese topping. For spreads and sauces with materially different plausible identities, keep alternatives and an explicit assumption; avoid presenting an ordinary representative as a confirmed recipe. Retain confirmation for incompatible protein identities such as shrimp versus fish.

Acceptance: evaluate reference suitability separately from coverage. Compatible generic profiles remain available; unsupported identities never become confirmed solely to reach 44/44. Preserve cooked/raw integrity, serving units, display names, existing scope and protection against duplicate recipe fat.

Likely implementation: vision identity fields, `supabase/functions/nutrition-lookup/index.ts`, `services/analysisNutrition.ts` and existing estimate details.

## 5. Portion warnings

Pass visible count, fraction, item type and whole-dish representation to warning logic. Compare a supported count with an appropriate per-item guideline without multiplying the already-totaled quantity again. Classify a named soup/stew/casserole as a prepared dish before matching words such as chicken or cheese. Small reliable garnishes need suitable categories.

Acceptance: three fried eggs totaling 150 g do not receive a one-egg warning. Chicken stew does not receive a chicken-piece range. A shared casserole or pizza still requests the consumed portion. Quantities remain unchanged; genuinely contradictory amounts remain reviewable. Existing photo ranges remain estimates, not calibrated confidence intervals.

Likely implementation: `services/portionValidation.ts`, its call in `services/advancedFoodAnalysis.ts`, existing scope review and focused regressions.

## 6. Targeted recovery

Carry structured lookup failure metadata into `AdvancedAnalysisResult` and its serialization, rather than retaining only a reason string. Add an action for retryable failed ingredients that calls nutrition resolution using their saved identity/preparation context. It must not invoke vision or replace healthy ingredients, manual references, quantities, included regions or consumed portions. Distinguish a service error from an identity question or a genuine no-match.

Acceptance: retrying one failed food makes no photo-analysis call, leaves all healthy values and user corrections intact, and recalculates the subtotal once. Remaining failures stay incomplete. Cancellation and account changes cannot apply stale results. Existing manual correction remains available for non-retryable cases.

Likely implementation: `lib/advanced-food-analysis-types.ts`, `services/advancedFoodAnalysis.ts`, `services/analysisNutrition.ts`, `services/foodAnalysis.ts`, draft/route serialization and `app/(app)/food-result.tsx`.

## 7. Evidence and diagnostics

Use the current ten images as regression examples. Add independent weighed meals with recipe ingredients and consumed portions; image-only judgments can assess visible identity and scope but cannot establish true calories. New measured photos/recipes are an input dependency for an accuracy benchmark.

Compare changes on identical saved detections for nutrition-only work. For vision changes, make fresh paired evaluations and repeat difficult cases. Track ingredient recall and unsupported additions, reference suitability, unresolved identities, portion error, complete-meal calorie error where eligible, repeated-scan variation, latency and paid-call count. Do not count missing labels as passes or incomplete subtotals as full-meal estimates.

Add sanitized request/stage identifiers, error categories, retry counts and timings so a future salad failure can be traced. Avoid photos, auth tokens and provider secrets in diagnostics. Broader production quotas and release readiness remain separate work requiring a fresh audit.

Microsoft documents that vision descriptions can be incorrect and counts approximate; these limits reinforce measuring the pipeline rather than treating a model's confidence as accuracy. [Azure image-input limitations](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses#image-input-limitations).

## Evidence

- [Original visual verdict](food_images/ANALYSIS_VERDICT_2026-10-29.md)
- [Fresh salad and casserole comparison](food_images/RERUN_COMPARISON_2026-10-29.md)
- [Reference recovery results](food_images/REFERENCE_RECOVERY_RESULTS_2026-10-29.md)
- [Failure isolation and latest replay](food_images/INGREDIENT_RESILIENCE_RESULTS_2026-10-29.md)
- [Evaluation procedure](scripts/FOOD_EVALUATION.md)
