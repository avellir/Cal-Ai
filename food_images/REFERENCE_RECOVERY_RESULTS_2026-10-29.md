# FatSecret reference recovery: implementation and controlled results

Implemented and deployed serving-details-v2 in the Supabase nutrition-lookup function. FatSecret remains the only automatic nutrition provider. OAuth 1.0 credentials and the vision deployment are unchanged.

## What changed

- Preserve Generic food IDs when search summaries use cups/pieces/servings or omit macros. Load authoritative details for a bounded, relevance-ranked set before rejecting the food.
- Search up to 50 records; recover at most six incomplete summaries per search with two detail calls at a time. Cache successful details for one hour, bounded to 256 entries, scoped to transport and credentials. Share pending work only within one request signal.
- If selection cannot find a compatible record, make at most two distinct follow-up searches and retry selection once. Supported equivalents include sauce/syrup/topping, yogurt-cucumber sauce/tzatziki, casserole/bake terms, and vision-supported same-family alternatives.
- Keep supported alternatives in the candidate pool when the original query is generic, preventing unrelated grain results from crowding out barley/wheat candidates.
- Recognize a complete casserole recipe whose name includes sauce as a whole dish. Preserve broccoli identity and reject sauce-only or other-vegetable/meat casseroles.
- Require the new retrieval version in the live deployment check. No new secrets, database migration or saved-meal recalculation is required.

## Controlled comparison

Source vision run: 2026-10-29T14-32-10-853Z-01b24d. Both live lookup runs replay the same saved food queries, contexts, quantities and selected plate contents. All ten request inputs match exactly, all portion masses are unchanged, and neither comparison made any vision requests. Same nutrition-selector model: gpt-5-mini. Original image omissions remain unchanged.

| Stage | Requests completed | Components matched | Meals with complete coverage |
|---|---:|---:|---:|
| original | 9/10 | 31/44 | 4/10 |
| before | 10/10 | 38/44 | 5/10 |
| after | 10/10 | 43/44 | 9/10 |

Original = the earlier ten-photo challenge; before = a fresh replay using the old deployed lookup; after = the final deployed retrieval improvement. The original salad server error did not recur in the fresh baseline, so compare before to after when judging this change. The selector remains stochastic; this is one controlled pair, not proof of general numerical accuracy.

| Meal | Matched before | Matched after | App kcal before | App kcal after |
|---|---:|---:|---:|---:|
| Sushi platter | 4/5 | 4/5 | 575 subtotal | 586 subtotal |
| Ice-cream sundae | 3/5 | 5/5 | 710 subtotal | 836 |
| Broccoli-cheese casserole | 0/1 | 1/1 | Unavailable | 1,512 |
| Large cooked breakfast | 7/7 | 7/7 | 1,438 | 1,438 |
| Grain and vegetable salad | 7/7 | 7/7 | 253 | 294 |
| Chicken and vegetable soup | 1/1 | 1/1 | 497 | 497 |
| Meatballs, rice and yogurt-style sauce | 5/6 | 6/6 | 578 subtotal | 688 |
| Fried eggs and vegetables | 5/5 | 5/5 | 345 | 345 |
| Whole salami pizza | 1/1 | 1/1 | 2,346 | 2,346 |
| Bread, spread, avocado and fruit | 5/6 | 6/6 | 334 subtotal | 372 |

Complete coverage means every detected component has a usable nutrition reference. Whole dishes can count as one component. It does not establish the true recipe, capture omitted ingredients, clear serving-review warnings or validate calorie/weight accuracy. Subtotals omit unresolved components. No weighed portions or measured recipe nutrition were supplied.

## Recovered references

### Ice-cream sundae

- Chocolate sauce: Chocolate Syrup (fatsecret:37804), 35 g; exact reference.
- Caramel sauce: Butterscotch or Caramel Topping (fatsecret:7190), 10 g; exact reference.

### Broccoli-cheese casserole

- Broccoli cheese casserole: Broccoli Casserole (Broccoli, Rice, Cheese and Mushroom Sauce) (fatsecret:6025), 1200 g; approximate reference.

### Meatballs, rice and yogurt-style sauce

- Yogurt cucumber sauce: Tzatziki (fatsecret:5717723), 100 g; exact reference.

### Bread, spread, avocado and fruit

- Strawberries: Strawberries (fatsecret:5525), 110 g; exact reference.

## Remaining limitations

- Sushi platter, Sushi roll: Confirm the food type or recipe: Shrimp sushi roll or Fish sushi roll. Nutrition cannot be determined from appearance alone.
- The broccoli casserole reference is an ordinary prepared-recipe proxy, not a verified reconstruction of the photographed recipe. The estimate applies to the whole shared dish.
- The salad still omits cucumber because vision is frozen; lookup recovery does not repair missing detections.
- Other selected references can change when the candidate set expands. Main-food identity and recipe quality still need separate evaluation; match count alone is not correctness.
- Observed median lookup duration: 7.0 seconds before and 9.0 seconds after. Single-pass timing includes different cache states and network/model variability; this is not a latency benchmark. Recovery can require extra provider calls, which are bounded and cached.

## Verification

- 291 tests passed across 29 suites, including regressions for per-piece recovery, missing nutrients, serving-only units, credential cache isolation, bounded follow-ups, casserole compatibility and retained grain alternatives.
- TypeScript and targeted ESLint passed. The existing unrelated full-app lint findings were not changed.
- The final function was deployed to project lgozuyqviyhvcydyajzw. No meals were saved, and credentials were not printed.

- [Before inputs/results](evaluation/reference-recovery/2026-10-29T15-55-02-933Z-before/results.json)
- [After inputs/results](evaluation/reference-recovery/2026-10-29T16-09-42-184Z-after/results.json)
- [Before manifest](evaluation/reference-recovery/2026-10-29T15-55-02-933Z-before/manifest.json)
- [After manifest](evaluation/reference-recovery/2026-10-29T16-09-42-184Z-after/manifest.json)
