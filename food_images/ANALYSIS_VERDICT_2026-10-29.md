# Food images: live app analysis and visual verdict

Run: 2026-10-29T14-32-10-853Z-01b24d. Completed: 2026-10-29T14:36:23.739Z. Vision: gpt-6.1-terra; nutrition selector: gpt-5-mini; provider: FatSecret; authentication: oauth1.

My verdict: the app broadly recognizes these complex meals and generally separates background food correctly, but it does not yet provide dependable automatic nutrition totals for this set. Missing sauce/common-food matches, recipe assumptions and one nutrition service error are the main weaknesses.

10/10 photos produced vision results; 9/10 completed the pipeline without a nutrition transport failure. 31/44 detected components received nutrition references; 4/10 meals have complete nutrition coverage. A whole prepared dish can count as one component. Coverage is not a count of correct identifications.

I inspected all ten original images before comparing the full predictions. Visible counts, ingredients, omissions, food forms and background handling are assessed below. No measured portions or recipe nutrition were supplied, so weight/calorie accuracy is unscored. All quantities and calories are app estimates; missing nutrition is shown as unavailable rather than zero. Subtotals exclude unresolved components.

User review and saving were skipped as requested. No test suite was run. Application code and credentials were not changed.

| Meal | App amount | App kcal | Matched components | Independent visual verdict |
|---|---:|---:|---:|---|
| Sushi platter | 475 g | 587 subtotal | 4/5 | Good counting; incomplete nutrition |
| Ice-cream sundae | 335 g | 710 subtotal | 3/5 | Good ingredient recognition; missing sauces |
| Broccoli-cheese casserole | 1200 g | Unavailable | 0/1 | Correct dish recognition; nutrition unavailable |
| Large cooked breakfast | 628 g | 1,438 | 7/7 | Mostly correct coverage; recipe assumptions remain |
| Grain and vegetable salad | 458 g | Unavailable | 0/7 | Broad recognition correct; nutrition request failed |
| Chicken and vegetable soup | 700 g | 497 | 1/1 | Correct category; generic recipe may misrepresent proportions |
| Meatballs, rice and yogurt-style sauce | 570 g | 578 subtotal | 5/6 | Good count and main ingredients; sauce omitted from nutrition |
| Fried eggs and vegetables | 435 g | 345 | 5/5 | Strong main-ingredient recognition; small garnish mismatch |
| Whole salami pizza | 850 g | 2,346 | 1/1 | Correct whole-pizza scope; total depends on estimated mass |
| Bread, spread, avocado and fruit | 333 g | 337 subtotal | 5/6 | Mostly correct visible foods; strawberries unresolved |

## 1. Sushi platter

[Open original photo](meal_001.webp)

**What I see:** About 12 visible pieces: three nori-outside rolls, three rice-outside seafood rolls, three salmon nigiri, one shrimp nigiri, and two glazed/topped rolls. Rice, seaweed, green fillings, sesame and glaze are visible.

**App result:** 475 g; 587 subtotal kcal; 4/5 components matched.

**My verdict:** The app's 12 pieces and five groups agree with my visual count. It identifies salmon and shrimp nigiri and separates the roll types. Three seafood rolls remain unresolved. The generic Tuna Sushi and Sushi references may not capture avocado, glaze and the assortment's recipe differences.

| Detected component | App quantity | Selected nutrition reference / unresolved reason |
|---|---:|---|
| Salmon nigiri | 135 g | Salmon Sushi |
| Shrimp nigiri | 45 g | Shrimp Sushi |
| Tuna avocado roll | 90 g | Tuna Sushi |
| Sushi roll | 110 g | Confirm the food type or recipe: Shrimp sushi roll or Fish sushi roll. Nutrition cannot be determined from appearance alone. |
| Topped sushi roll | 95 g | Sushi |

## 2. Ice-cream sundae

[Open original photo](meal_002.webp)

**What I see:** Several pale ice-cream scoops with dark chocolate sauce, amber sauce, upright rectangular biscuits, chocolate chunks and crumbs in the bowl. Additional chocolate and crumbs sit on the table.

**App result:** 335 g; 710 subtotal kcal; 3/5 components matched.

**My verdict:** It captures ice cream, crackers, chocolate pieces and both dark and amber sauces, and correctly excludes tabletop chocolate. Chocolate and caramel sauces have no compatible nutrition match. The 710 kcal value excludes both sauces and is not a complete sundae total.

| Detected component | App quantity | Selected nutrition reference / unresolved reason |
|---|---:|---|
| Vanilla ice cream | 240 g | Vanilla Ice Creams |
| Graham crackers | 30 g | Graham Crackers |
| Chocolate pieces | 20 g | Sweet or Dark Chocolate |
| Chocolate sauce | 35 g | No FatSecret candidates provided; need a generic chocolate sauce/chocolate syrup record. |
| Caramel sauce | 10 g | Available candidates are incompatible (marinara/oyster); need a generic caramel sauce record. |

## 3. Broccoli-cheese casserole

[Open original photo](meal_003.webp)

**What I see:** Broccoli florets under a substantial melted yellow cheese topping in a large oval baking dish. Interior base is concealed.

**App result:** 1200 g; Unavailable kcal; 0/1 components matched.

**My verdict:** Broccoli-cheese casserole is a defensible whole-dish description of the visible bake; the concealed base should not be invented. The app estimates 1,200 g for the entire baking dish but finds no nutrition reference. Its stored zero means no resolved nutrition, not zero-calorie food. One person's consumed portion is unknown.

| Detected component | App quantity | Selected nutrition reference / unresolved reason |
|---|---:|---|
| Broccoli cheese casserole | 1200 g | No candidate matches broccoli cheese casserole (contains broccoli and melted cheese, baked). |

## 4. Large cooked breakfast

[Open original photo](meal_004.webp)

**What I see:** Scrambled eggs, two to three visible sausage bodies, bacon strips, several toast slices, orange/red browned vegetable cubes, a bowl of white dip with spice flakes, and a glass of orange liquid on the plate.

**App result:** 628 g; 1,438 kcal; 7/7 components matched.

**My verdict:** All major food groups are present in the output: eggs, toast, sausages, bacon, browned cubes and white dip. Orange juice is explicitly excluded as an accompaniment. The cube identity and plain-yogurt choice are uncertain; the white dip could differ substantially. Sausage bodies overlap, so I would not grade the model's count of two as a definite error. The large meal estimate is plausible, but 1,438 kcal is not verified by the photo.

| Detected component | App quantity | Selected nutrition reference / unresolved reason |
|---|---:|---|
| Scrambled eggs | 140 g | Scrambled Egg (Whole, Cooked) |
| Toast | 110 g | Toasted Bread |
| Breakfast sausages | 100 g | Breakfast Sausage |
| Bacon | 55 g | Bacon (Cured, Pan-Fried, Cooked) |
| Roasted diced potatoes | 150 g | Roasted Potato |
| Yogurt | 70 g | Plain Yogurt |
| Parsley | 3 g | Parsley |

## 5. Grain and vegetable salad

[Open original photo](meal_005.webp)

**What I see:** A substantial cooked grain base resembling barley/farro, leafy greens, red and yellow tomatoes, cucumber slices, red onion, roasted cauliflower, orange roasted vegetable pieces, herbs and microgreens.

**App result:** 458 g; Unavailable kcal; 0/7 components matched; Nutrition lookup failed (HTTP 503): Nutrition lookup is unavailable. Try again shortly..

**My verdict:** The grain base, roasted orange vegetables, tomatoes, greens, cauliflower, onion and microgreens are recognized. I can also see cucumber slices that are missing from the ingredient list. Grain and orange-vegetable species remain uncertain. A nutrition HTTP 503 leaves all seven detected components without references; the stored zero is an unavailable result.

| Detected component | App quantity | Selected nutrition reference / unresolved reason |
|---|---:|---|
| Cooked grains | 130 g | Search for this food or enter nutrition manually. |
| Roasted squash | 100 g | Search for this food or enter nutrition manually. |
| Cherry tomatoes | 100 g | Search for this food or enter nutrition manually. |
| Leafy greens | 45 g | Search for this food or enter nutrition manually. |
| Roasted cauliflower | 55 g | Search for this food or enter nutrition manually. |
| Red onion | 20 g | Search for this food or enter nutrition manually. |
| Microgreens | 8 g | Search for this food or enter nutrition manually. |

## 6. Chicken and vegetable soup

[Open original photo](meal_006.webp)

**What I see:** A bowl filled with numerous large cooked chicken pieces, carrot chunks, celery and pale vegetable pieces in broth, with a small herb sprig.

**App result:** 700 g; 497 kcal; 1/1 components matched.

**My verdict:** Chicken-and-vegetable stew/soup matches the picture broadly. The app uses one average prepared-dish reference for 700 g. This bowl looks particularly chicken-heavy, so that generic recipe may understate its protein or energy; the image cannot establish the exact amounts. The 497 kcal is an approximate whole-bowl estimate, not a measured result.

| Detected component | App quantity | Selected nutrition reference / unresolved reason |
|---|---:|---|
| Chicken and vegetable stew | 700 g | Chicken or Turkey Vegetable Stew Type Soup |

## 7. Meatballs, rice and yogurt-style sauce

[Open original photo](meal_007.webp)

**What I see:** Four visible browned meatballs on white rice, a substantial white herbed sauce, cucumber rounds, red/yellow tomatoes, red pepper pieces and leafy herbs.

**App result:** 570 g; 578 subtotal kcal; 5/6 components matched.

**My verdict:** The app correctly counts four meatballs and includes rice, tomatoes, cucumber and the substantial yogurt-style sauce. The sauce is detected but has no nutrition match, so 578 kcal excludes it. Beef is an approximate reference choice rather than a visually established meat species. Some red pepper-like pieces are not separately represented.

| Detected component | App quantity | Selected nutrition reference / unresolved reason |
|---|---:|---|
| Cooked meatballs | 160 g | Beef Meatballs |
| Cooked white rice | 180 g | White Rice (Medium-Grain, Cooked) |
| Yogurt cucumber sauce | 100 g | No FatSecret candidates supplied — search for common yogurt-cucumber sauce (tzatziki). |
| Cherry tomatoes | 75 g | Cherry Tomatoes |
| Cucumber | 50 g | Cucumber |
| Fresh herbs | 5 g | Raw Vegetable |

## 8. Fried eggs and vegetables

[Open original photo](meal_008.webp)

**What I see:** Three visible fried egg yolks with whites, chopped chives, cucumber slices, red bell-pepper strips and cherry-tomato halves. A separate cup of tea sits beside the plate.

**App result:** 435 g; 345 kcal; 5/5 components matched.

**My verdict:** Three eggs are correctly counted, and cucumber, red pepper and tomatoes are retained. The separate tea is excluded. The chopped tubular green garnish looks like chives rather than the selected dill; this is a minor identity mismatch compared with the main ingredients. Egg frying fat and actual portion weights remain estimates.

| Detected component | App quantity | Selected nutrition reference / unresolved reason |
|---|---:|---|
| Fried chicken eggs | 150 g | Fried Egg |
| Red bell pepper | 90 g | Red Bell Pepper |
| Cucumber | 100 g | Cucumber |
| Cherry tomatoes | 90 g | Cherry Tomatoes |
| Dill | 5 g | Dill |

## 9. Whole salami pizza

[Open original photo](meal_009.webp)

**What I see:** One whole round pizza with cured-meat slices, melted cheese, red tomato sauce, crust and small herbs. Loose cured-meat slices and a basil bunch sit outside the pizza.

**App result:** 850 g; 2,346 kcal; 1/1 components matched.

**My verdict:** The app correctly treats the image as one whole cured-meat pizza, with no separate addition of its internal cheese or meat. Loose meat and basil outside the pizza are excluded. The 2,346 kcal applies to its estimated 850 g whole pizza. Actual diameter, weight and the salami/pepperoni recipe are not established by the photo.

| Detected component | App quantity | Selected nutrition reference / unresolved reason |
|---|---:|---|
| Pepperoni pizza | 850 g | 14" Pepperoni Pizza |

## 10. Bread, spread, avocado and fruit

[Open original photo](meal_010.webp)

**What I see:** One dark bread piece with white spread, a peeled banana section, a fan of avocado slices, a cut fig half, a whole dark-purple fruit and roughly six to seven overlapping strawberries. A large spread block/dish and knife sit beside the plate.

**App result:** 333 g; 337 subtotal kcal; 5/6 components matched.

**My verdict:** Bread, spread, banana, avocado, figs and seven strawberries are represented. Partial banana and avocado fractions are retained, and the large background spread block is excluded. The prominent strawberries have no nutrition match. Butter is assumed despite a cream-cheese alternative; the whole dark fruit and the whole/half fig count are also uncertain. The 337 kcal value is a subtotal.

| Detected component | App quantity | Selected nutrition reference / unresolved reason |
|---|---:|---|
| Dark bread | 35 g | Rye Bread |
| Butter | 8 g | Butter |
| Banana | 55 g | Banana |
| Avocado | 55 g | Avocado |
| Figs | 70 g | Fig |
| Strawberries | 110 g | No raw strawberry record among candidates; only juices, desserts, or flavored products listed. |

## Evidence

- [Visual report with all photos](analysis-review.html)
- [Run manifest](evaluation/runs/2026-10-29T14-32-10-853Z-01b24d/manifest.json)
- [Raw results](evaluation/runs/2026-10-29T14-32-10-853Z-01b24d/results.json)
- [Independent visual observations and verdicts](evaluation/runs/2026-10-29T14-32-10-853Z-01b24d/nutrition-visual-audit.json)
