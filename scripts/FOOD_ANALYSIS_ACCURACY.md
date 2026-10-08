# Food analysis consistency changes

The pipeline preserves detected food identity and quantity, and makes uncertainty visible. These changes fix deterministic client processing errors; they do not establish the accuracy of an unseen recipe or the vision model's portion estimate.

## Processing changes

- Shared name normalization uses controlled plural aliases and whole-word matching. Preparation, food varieties and cuts remain distinct.
- Specific names are matched before general references. Scrambled eggs, penne and Parmesan have explicit handling. Composite dishes and materially different variants cannot borrow a component's reference (orange juice versus orange, coconut milk versus milk, peanut butter versus butter).
- Serving-size guidelines now warn instead of replacing positive weights with a typical single serving. Large portions and small toppings keep their supplied amounts. Invalid quantities fail; the 10000 g/ml schema ceiling retains adjustment provenance.
- Region captions no longer replace the structured ingredient list. Mixed dishes retain every reliable detected ingredient instead of being limited to five.
- Repeated labels in one recognition region use the largest reported total for that food. Separate regions add. Merging retains adjustment reasons and the lowest confidence; incompatible mass and volume units remain separate.
- Beverage detection uses words rather than substrings, preserving grams for steak, milk chocolate, coffee beans and water chestnuts. Drinks preserve their supplied quantity without rounding to a fixed serving.
- Low-confidence and likely inferred detections are excluded with a warning that nutrition may be incomplete. Pepperoni, bell pepper and ice cream are no longer removed by the hidden-ingredient substring filter.
- Optional topping refinement failures retain the initial recognition. Confidence penalties never increase the original score. Invalid nutrition returns a failed result; whole-diet macro proportions are not treated as errors in a single meal.

## Nutrition references

The local table is still an approximate, offline reference. Unknown foods still use a generic estimate with warnings and lower confidence. This is not a live nutrition database integration. Cooking fat, sauces, brands, preparation, density and actual quantities remain sources of error.

Two explicit entries were added from the [USDA SR28 dairy and egg report](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR/SR28/reports/sr28fg01.pdf):

| Reference | NDB number | Printed PDF page | kcal / 100 g | Protein | Carbs | Fat |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Egg, whole, cooked, scrambled | 01132 | 393 | 149 | 9.99 g | 1.61 g | 10.98 g |
| Cheese, Parmesan, hard | 01033 | 222 | 392 | 35.75 g | 3.22 g | 25.83 g |

These are reference averages, not measured recipes for the photos. The older approximate entries were not independently revalidated.

## Validation and reports

Regression tests exercise the real orchestrator and nutrition calculations with mocked vision responses, plus server payload validation, ingredient merging and portion handling.

Run npm test -- --runInBand, npm run typecheck, and node scripts/food-analysis-probes.cjs.

The offline comparison preserves the original photo-food/evaluation/service-probes.json and writes service-probes-after.json and algorithm-improvements.md. The prior per-photo visual review remains in the same folder. These artifacts contain no live Azure results.

## Deployment and live evaluation

Redeploy supabase/functions/analyze-food/index.ts using [AZURE_SETUP.md](../supabase/AZURE_SETUP.md). Recognition and refinement prompts now require specific preparation names, visible totals, disjoint regions, one total per food per region, and either dish components or the whole dish. They also require notes for shared pans, missing sectors and uncertain serving scope. Reversed bounding boxes and invalid total plate weights fail validation.

No migration or environment-variable change is needed. Client changes take effect with the rebuilt app; server changes require deployment.

Live evaluation still needs a signed-in Cal AI session. Supabase dashboard GitHub login is a separate session. Use [FOOD_EVALUATION.md](FOOD_EVALUATION.md) to run all photos and retain raw model responses. Record actual ingredient/meal weights and recipe nutrition in photo-food/reference.json before computing accuracy metrics. Multiple fresh runs on the same images are needed to measure vision consistency; cached replay measures client consistency only.

## Verification for this change

- Full Jest suite: 17 suites and 179 tests passed.
- TypeScript typecheck: passed.
- Targeted ESLint on changed services, types, tests, Edge Function and offline comparison script: passed without warnings.
- Repository-wide Expo lint: failed in unrelated existing UI routes/components (58 errors and 4 warnings), including React hook refs and manual memoization rules.
- Offline service probes: generated successfully. No live photo model calls or deployment were performed.
