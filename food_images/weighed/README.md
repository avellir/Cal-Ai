# Measured meals

No measured meals have been supplied yet. Add only photos with documented ground
truth here, following the intake and immutable-ID rules in `../README.md`.
Keep one annotation record per photo in `../photo-records.json`.

Copy `../templates/weighed-meal.template.json` to
`meal_NNN.ground-truth.json` when collecting a real meal. The next available
photo ID is currently `meal_011`; allocate IDs globally and never reuse them.
Templates contain null placeholders and are not benchmark records.

1. Tare a kitchen scale and weigh each edible component separately in grams
   before eating. Record whether it is raw or cooked; match the reference to that
   same state. Exclude bones, packaging and other inedible material.
2. Assemble the measured portion and take the photo immediately before eating,
   at an ordinary user angle. Retain the original image bytes and capture time.
3. Weigh oil, butter and dressing separately. Record amounts added and amounts
   left behind, plus any batch allocation. Include consumed fat as its own
   component. Use an empty `cooking_fats` array only when no fat was added.
   If retention is unknown, leave it unknown and do not score calorie accuracy.
4. Match every component to USDA FoodData Central **SR Legacy, April 2018** and
   nutrient **1008 (Energy, kcal)**. Retain the exact FDC ID, description,
   preparation state, kcal per 100 g, URL and retrieval date. `component_index`
   is zero-based and links each reference to exactly one component. Do not mix
   reference releases/providers or use the app's lookup to define ground truth.
   If no compatible entry exists, choose a different collection meal or leave
   this one unscored; do not silently substitute an incompatible food.
5. Calculate `true_kcal = sum(component.grams * reference.kcal_per_100g / 100)`.
   Keep full precision until reporting. Here `true_kcal` means measured-portion,
   fixed-source reference calories, with the database's inherent limitations.
6. Use `photo: "weighed/meal_NNN.ext"` relative to `food_images/`. Add the image
   hash/index entry and one photo annotation record, setting `weighed: true` only
   when measurements and calorie references are complete. `components[].grams`
   must represent the edible consumed portion on the matching reference basis.

`measurement` is supporting provenance in addition to the five requested core
fields (`id`, `photo`, `components`, `true_kcal`, `source`). For mixed dishes,
retain the recipe worksheet, final cooked yield, and served fraction as well;
ingredient weights alone do not establish cooked component weights. Prefer
separable meals for the first ten. Photograph and evaluate the entire measured
portion; if food is left uneaten, document the leftovers and reconcile the target
portion before scoring. Never compare a whole-plate prediction with eaten-only
calories without adjusting both to the same scope.

USDA publishes the fixed [SR Legacy April 2018 release](https://fdc.nal.usda.gov/download-datasets/).
Its [field descriptions](https://fdc.nal.usda.gov/portal-data/external/dataDictionary)
define nutrient amounts per 100 g. Save the chosen values to keep subsequent
comparisons reproducible; changing the reference creates a new benchmark version.

Target ten independent meals initially. Report MAPE, signed percentage bias and
eligible/unscored counts using `../METRICS.md`. Until real data is collected,
these results are unavailable. See `../EXPERIMENTS.md` for lookup isolation and
the paired portion-check diagnostic.
