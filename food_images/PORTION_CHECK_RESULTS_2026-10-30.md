# Portion-check diagnostic on the ten stable-ID photos

## Class-based follow-up and review limitations

Report the earlier author review as **4 of 9 judged warnings**, with four others
indeterminate. Do not present that fraction as a stable percentage: changing one
label with the same denominator changes the count by one ninth. The implementing
agent supplied those judgments and knew the warning versions.

A separate same-model agent reviewed a shuffled packet of 18 unique warning/photo
pairs from the original and first revised checker. It saw only the warnings and
the eight associated photos; previous labels, code, and version metadata were
withheld. After labels were returned, version membership was restored. On the
first revised 13-warning set, that reviewer gave **7 useful, 2 false alarms, and
4 indeterminate**, versus the author's **5 useful, 4 false alarms, 4 indeterminate**.
Keep both reviews. The disagreement illustrates sensitivity to the reviewer and
the definition of contextual usefulness. Same-model review is not human validation;
wording may itself suggest which design approach produced a warning.

[Separate reviewer labels and limitations](blinded-warning-review.json).

The four original indeterminate warnings cannot be settled as gram errors from
these images: chocolate sauce, yogurt, rice and yogurt-cucumber sauce have no
measured portions. The separate reviewer considered the sauce confirmation useful,
but that does not establish its actual mass; it labeled the meatball warning
indeterminate instead. No record was relabeled as measured ground truth. New
weighed meals can test these food classes; they cannot retroactively establish
the mass of the pictured historical meals.

Class changes were specified before inspecting their replay result:

- Herbs and microgreens have no minimum-serving warning; an upper review bound
  remains. The exception does not extend to olive portions or herb-flavored oil.
- Meatballs use per-unit bounds times the vision count. No count means an explicit
  "Count unknown" message. The bounds are broad provisional heuristics, not
  validated portion distributions.
- Ice cream is treated as countable only when the name or vision item type
  identifies scoops. Bulk ice cream is not assigned an invented scoop count.

Follow-up replay at 23:40 UTC: **0 of 44 quantities changed**, **10 warnings**.
Compared with the first revision, 9 warning texts remain unchanged, 1 is reworded
(scoop count unknown), and 3 are removed (the two herb minima and the counted
meatball total). No new warning is added. The author-defined changes apply by
food role/unit, without photo IDs, filenames or benchmark gram amounts in rules.
The three original dish/egg fixes remain in place. No new false-alarm score is
claimed: the separate review predates these class changes and must not be
automatically transferred to altered warning texts.

[Class-follow-up replay evidence](evaluation/portion-check/2026-10-29T23-40-23-185Z/results.json).
**79 of 79 focused tests passed in two suites** on Node 24.21.0 with the same
command below, including large herb amounts, non-herb reversals, counted and
uncounted meatballs, scoop/bulk distinctions and contradictory counted totals.
No other checks or provider calls were made. This remains a tuning-set diagnostic;
an independent photo holdout and measured meals are still missing. Further
calibration must use those inputs rather than targeting zero warnings on this set.

## First revised checker replay (historical)

The revised checker was run at 23:30 UTC on 29 October (30 October local time).
It uses counts only when supplied by vision; countable items without counts emit
"Count unknown". No counts are inferred from the grams being checked.

- Quantities changed: **0/44**, across the same ten verified photos.
- Warnings: **13 before, 13 after**, with affected photos falling from 8 to 7.
- **8 unchanged, 4 reworded, 1 removed, 1 added**. The only removed warning is the
  three-egg warning on meal_008. No other warning silently disappeared.
- Meal_003 casserole and meal_006 stew ask for consumed-portion confirmation;
  neither uses an ingredient-sized numeric range. Meal_009 whole pizza is also
  reworded because its total is not a single consumed serving.
- Meal_004 scrambled eggs now requests an unknown count; toast gains the same
  request because the saved result supplies no slice count. This explains the
  extra warning and the unchanged overall count. No warning uses an inferred count.
- Manual review by the implementing agent: **5 useful, 4 false alarms,
  4 indeterminate**. Report **4 of 9 judged warnings**, with **4 of all 13**
  labeled false alarms and four still indeterminate; this is an unstable small sample.
  These are judgments about contextual appropriateness, not measured gram error.
  The original report did not establish a labeled useful-warning set.
- Remaining false alarms concern multi-scoop ice cream, small parsley and
  microgreen garnishes, and the combined weight of four meatballs. All eight
  unchanged warnings and their individual judgments are retained in the audit.

[Full hand review and reconciliation](portion-warning-review.json).
[Revised replay evidence](evaluation/portion-check/2026-10-29T23-30-02-789Z/results.json).

Focused verification: **71/71 tests passed in 2 suites** on Node 24.21.0 using
`npm test -- --runInBand --runTestsByPath __tests__/portionValidation.test.ts __tests__/foodAnalysisConsistency.test.ts`.
The updated tests first reproduced 12 failures, including circular count inference
and missed fried-rice/loaded-fries classification, then passed after the fix.
Cases include oversized single eggs/chicken breasts, 1 kg plain broccoli, half
and quarter items, prepared dishes and reverse component-name cases.

This is the tuning set, not an independent holdout. No separate untouched meal
photo dataset is available in the working tree (`photo-food/` is absent); extra
synthetic regression cases do not replace a photo holdout. Independent photos
with frozen labels are still required before a generalization claim. No fresh
vision/nutrition requests or broader checks were run. Whole dishes currently have
serving confirmation and the schema ceiling but no numerical dish-level range.
Calorie MAPE/bias remain unavailable without measured meals.

## Original checker replay (historical)

Executed `node scripts/replay-food-portion-check.cjs` on 30 October 2026 local
time (29 October 23:20 UTC). This was an offline replay of the current S3 checker
against historical saved estimates, not a new photo-analysis or nutrition run.

All ten image hashes matched both the immutable index and the original run
manifest (`2026-10-29T14-32-10-853Z-01b24d`). Each selected component's original
estimate was checked against a unique same-name saved raw vision detection.
Inputs are reconstructed from those fields, not newly instrumented S3 snapshots.

- 10/10 photos supplied usable saved inputs: 44 selected components, all in grams.
- The current checker processed all 44 and changed **zero quantities**.
- It emitted **13 portion warnings across 8 photos**.
- The three-egg meal (`meal_008`, 150 g total) still receives the 45-60 g single-egg
  guideline. Chicken stew (`meal_006`, 700 g) receives a 30-180 g protein guideline.
  Broccoli casserole (`meal_003`, 1,200 g shared dish) receives a 15-150 g guideline.
  These demonstrate count/dish-context problems; they do not establish true grams.
- With no quantity changes, S3 supplies no numerical weight correction on these
  inputs. Its impact here is on warnings and review; this does not prove S3 has
  no value for other inputs or that its warnings improve user decisions.

No photos have scale measurements or fixed-source actual calories. Therefore:

- Lookup with true foods/grams: **not run**, required inputs unavailable.
- Before/after gram accuracy, calorie MAPE and bias: **unscored**, not zero.
- No S2 over/under or S3 made-worse labels can be justified from measured error.

This execution does not rescore visible-item recall, false-item rate, background
leakage or uncertainty handling. Those require a separate semantic review of the
saved predictions against the new annotation records.

The actionable result is to make warnings count-aware and classify whole prepared
dishes before matching individual ingredient words. Collect measured meals before
claiming an accuracy improvement or deciding whether S3 improves gram estimates.

[Detailed output with input/source hashes and every warning](evaluation/portion-check/2026-10-29T23-20-04-216Z/results.json)
is local and ignored by Git. The reusable script and this summary preserve the
procedure and findings. Provider calls: zero. No meals saved or deployment made.
No broader tests, lint, typecheck, builds or exports were run.
