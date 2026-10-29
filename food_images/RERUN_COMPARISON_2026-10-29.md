# Grain salad and broccoli: fresh rerun comparison

Both photos were analyzed again with fresh vision and nutrition requests through the existing app services and deployed Supabase functions. No application code, credentials or model settings were changed. No unit tests, user review or saving were performed. Original results are preserved.

| Meal | First run | Fresh rerun | Verdict |
|---|---|---|---|
| Grain salad | HTTP 503; nutrition unavailable; 458 g | 7/7 matched; 283 kcal; 483 g | The server error did not recur. All detected components now matched, but visible cucumber is still omitted. |
| Broccoli casserole | 0/1 matched; Unavailable; 1200 g | 0/1 matched; Unavailable; 1200 g | Same unresolved casserole and same whole-dish estimate. Lookup still provides incompatible casserole candidates. |

The salad now selects cooked pearled barley for the grains, winter squash, cherry tomatoes, roasted cauliflower, mixed salad greens, red onions and a generic raw-vegetable reference for microgreens. The 283 kcal is an app estimate for those seven detected components, not a verified full-meal calorie measurement. Grain identity, recipe fat and the omitted cucumber remain uncertain. One successful rerun does not establish why the previous 503 happened or prove permanent recovery.

The casserole is again recognized as broccoli cheese casserole, estimated at 1,200 g for the shared baking dish. Candidates remain cheeseburger casserole, turkey casserole, rice casserole with cheese, spinach and cheese casserole, and breakfast casserole. No match is selected. Nutrition is unavailable, not zero calories. This reproduces the retrieval limitation rather than an authentication failure.

## Grain salad

Original: 2026-10-29T14-32-10-853Z-01b24d. Rerun: 2026-10-29T14-49-36-470Z-b5c0b0. Same image hash: true; same vision source: true; same nutrition source: true; same model names: true.

- Cooked grains: 150 g; Pearled Barley (Cooked).
- Roasted squash: 110 g; Winter Type Squash.
- Cherry tomatoes: 95 g; Cherry Tomatoes.
- Roasted cauliflower: 55 g; Roasted Cauliflower.
- Mixed salad greens: 45 g; Mixed Salad Greens.
- Red onion: 20 g; Red Onions.
- Microgreens: 8 g; Raw Vegetable.

[Rerun results](evaluation/runs/2026-10-29T14-49-36-470Z-b5c0b0/results.json)

## Broccoli casserole

Original: 2026-10-29T14-32-10-853Z-01b24d. Rerun: 2026-10-29T14-50-19-745Z-7929c3. Same image hash: true; same vision source: true; same nutrition source: true; same model names: true.

- Broccoli cheese casserole: 1200 g; No candidate matches a broccoli-and-cheese baked casserole; available entries are different vegetables or other casseroles..

[Rerun results](evaluation/runs/2026-10-29T14-50-19-745Z-7929c3/results.json)
