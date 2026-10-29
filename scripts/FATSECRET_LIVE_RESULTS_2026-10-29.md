# FatSecret live verification and food comparison - 29 October 2026

Live authentication and nutrition lookup now work through Supabase using FatSecret OAuth 1.0. The deployment reports fatsecret-reference-v1, referenceSource=fatsecret, authentication=oauth1, configured=true. The single-food smoke check resolved cooked buckwheat to fatsecret:4436, with 92 kcal, 3.37 g protein, 19.86 g carbohydrates and 0.62 g fat per 100 g, plus documented servings. The three-food benchmark preflight matched 3/3 foods.

The previous OAuth 2.0 attempts failed first at credentials and then at IP restrictions. Signed OAuth 1.0 requests now complete without those failures. No provider secret or access token appears in this report. No meals were saved.

## Full photo benchmark

Run: 2026-10-29T14-06-14-856Z-c3f718. Completed: 2026-10-29T14:08:44.588Z. Nine food photos; standalone cocktail excluded. Vision model: gpt-6.1-terra. Nutrition selector: gpt-5-mini. Vision live requests: 9; cached: 0. Nutrition live requests: 9; cached: 0.

9/9 pipeline results completed; 34/42 ingredients obtained nutrition references; 3/9 meals have complete nutrition; 3/9 have complete nutrition without a pending portion/structure review. These counts measure pipeline behavior and coverage, not verified identification correctness.

| Stage | Pipeline results | Ingredients matched | Complete nutrition | Portions within +/-25% | Mean portion error |
|---|---:|---:|---:|---:|---:|
| Initial validation | 9/9 | 0/62 | 0/9 | 6/9 | 47.3% |
| Phase 1-2 | 9/9 | 36/37 | 8/9 | 8/9 | 11.4% |
| Restored Mini | 9/9 | 41/42 | 8/9 | 7/9 | 16.6% |
| Yesterday: Terra + Foundation | 9/9 | 15/43 | 0/9 | 7/9 | 17.0% |
| Today: Terra + FatSecret | 9/9 | 34/42 | 3/9 | 8/9 | 12.3% |

Reference portions and calories are the original user estimates, not weighed or measured ground truth. This run uses fresh vision, so changes relative to yesterday combine a new vision response with a new nutrition provider. FatSecret supplies reference nutrition; it does not determine the photo weights. A single nine-photo run cannot establish general accuracy or isolate the provider effect.

| Dish | User reference | Phase 1-2 | Yesterday | Today | Today: matched foods |
|---|---:|---:|---:|---:|---:|
| Cheesecake | 230 g | 240 g | 256 g | 216 g | 1/2 |
| Ramen | 695 g | 650 g | 550 g | 650 g | 1/1 |
| Tofu bowl | 435 g | 595 g | 558 g | 563 g | 7/9 |
| Buddha bowl | 580 g | 525 g | 645 g | 640 g | 10/10 |
| Ice cream | 165 g | 175 g | 235 g | 205 g | 2/2 |
| Breakfast | 125 g | 133 g | 143 g | 142 g | 4/5 |
| Salmon pan | 640 g | 558 g | 775 g | 730 g | 3/4 |
| Panzanella | 470 g | 560 g | 483 g | 473 g | 2/4 |
| Penne | 325 g | 320 g | 324 g | 343 g | 4/5 |

| Dish | User reference kcal | Yesterday | Today |
|---|---:|---:|---:|
| Cheesecake | 620 | 8 subtotal | 8 subtotal |
| Ramen | 610 | Unresolved | 1066 |
| Tofu bowl | 430 | 39 subtotal | 299 subtotal |
| Buddha bowl | 530 | 361 subtotal | 674 |
| Ice cream | 370 | Unresolved | 411 |
| Breakfast | 200 | 11 subtotal | 204 subtotal |
| Salmon pan | 1260 | Unresolved | 564 subtotal |
| Panzanella | 605 | 379 subtotal | 175 subtotal |
| Penne | 410 | 20 subtotal | 458 subtotal |

Subtotals include matched foods only and are not full-meal calorie estimates. Complete nutrition still does not prove correct food identity or suitability of the selected reference. Calorie comparisons exclude incomplete nutrition and pending review.

On the 3 eligible current meals, mean absolute calorie difference from the user estimates is 37.6%. This is not measured calorie accuracy and is not comparable to yesterday's incomplete meal subtotals.

## Remaining unresolved foods

### Cheesecake

- Raspberry cheesecake: Confirm the food type or recipe: Custard tart. Nutrition cannot be determined from appearance alone.
- Portion or structure review remains pending.

### Ramen

All included ingredients have nutrition references.

### Tofu bowl

- Cooked tofu: Confirm the food type or recipe: chicken. Nutrition cannot be determined from appearance alone.
- Tomatoes: No plain raw tomato record in candidates; all are processed/conserved forms.
- Portion or structure review remains pending.

### Buddha bowl

All included ingredients have nutrition references.

### Ice cream

All included ingredients have nutrition references.

### Breakfast

- Raw tomato: No raw/fresh tomato record among candidates; all are processed tomato products.
- Portion or structure review remains pending.

### Salmon pan

- Orange sauce: Confirm the food type or recipe: Cream sauce or Tomato sauce. Nutrition cannot be determined from appearance alone.
- Portion or structure review remains pending.

### Panzanella

- Raw tomatoes: No raw/fresh tomato entry among candidates; need a raw tomato record.
- Mozzarella: No mozzarella candidates provided; need fresh mozzarella.
- Portion or structure review remains pending.

### Penne

- Tomato: No raw fresh tomato record in candidates; visible tomato halves require a raw tomato entry.

## Verification and evidence

The deployed authentication change passed 274 tests across 27 suites, TypeScript, and targeted ESLint before deployment. This live recheck changed no application source or credentials. A separate requirement explicitly numbered requirement 1 has not been identified; the comparisons above use the original reference targets and show phase 1-2 separately.

- [Current manifest](../photo-food/evaluation/runs/2026-10-29T14-06-14-856Z-c3f718/manifest.json)
- [Successful FatSecret preflight](../photo-food/evaluation/runs/2026-10-29T14-06-14-856Z-c3f718/fatsecret-live-preflight.json)
- [Current results](../photo-food/evaluation/runs/2026-10-29T14-06-14-856Z-c3f718/results.json)
- [Photo review](../photo-food/evaluation/runs/2026-10-29T14-06-14-856Z-c3f718/nutrition-review.html)
- [Yesterday's Foundation comparison](../photo-food/evaluation/runs/2026-10-28T22-07-24-070Z-71ac87/foundation-comparison.md)
