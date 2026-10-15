# USDA nutrition lookup

Photo recognition remains in analyze-food. The app sends detected food names,
preparation and dish context to nutrition-lookup. It searches USDA dynamically,
then uses Azure AI to choose only among the returned USDA IDs. A second search
can broaden an unsuccessful query. Nutrients come from USDA details, never the
selector model. This supports new foods without a fixed list of ingredients.

## Deploy

1. Obtain a FoodData Central key: https://fdc.nal.usda.gov/api-key-signup/
2. In the existing Supabase project, Edge Functions → Secrets, add USDA_API_KEY.
   Keep this key server-only; do not put it in EXPO_PUBLIC variables or source control.
   nutrition-lookup also uses the existing AZURE_OPENAI_API_KEY,
   AZURE_OPENAI_BASE_URL and AZURE_OPENAI_DEPLOYMENT secrets for selection.
3. Deploy a function named nutrition-lookup using ALL of
   functions/nutrition-lookup/index.ts. The file is self-contained.
4. Turn off Verify JWT with legacy secret for this function. It authenticates
   every bearer token by calling Supabase Auth /user; anonymous keys cannot use it.
5. Redeploy analyze-food with the updated ingredient-preparation and mixed-dish prompt.
6. Restart Expo and reload Expo Go to obtain the client changes.

CLI alternative, after authenticating to the Supabase CLI:

```sh
supabase functions deploy nutrition-lookup --project-ref lgozuyqviyhvcydyajzw
supabase functions deploy analyze-food --project-ref lgozuyqviyhvcydyajzw
```

No database migration is required. Existing saved meals are not recalculated.

## Contract

POST nutrition-lookup with a signed-in user's bearer token:

- {"mode":"batch","queries":["cooked shrimp","pancakes"]}
- {"mode":"search","query":"vegetable soup"}
- {"mode":"details","id":"usda:170250"}
- {"mode":"resolve","queries":["borscht"],"contexts":[{"foodName":"borscht","preparation":"cooked","dishName":"Borscht"}]}

Search/batch returns results with query, nullable match, candidates and reason.
Details returns reference. References contain source ID/link, nutrients per
basisAmount/basisUnit, and documented serving weights. Search excludes branded
records because a photo cannot establish a product brand.

The app uses resolve mode to select compatible foods and typical recipe profiles
automatically. Match quality and reasoning accompany each selected reference.
Preparation and composite foods stay distinct; incompatible processed foods are
filtered before selection. Missing calories or macros invalidate a reference;
confirmed zero values are retained. Legacy batch mode remains conservative.
Resolve requests have a 60-second server timeout and a 65-second client timeout.

Provider timeouts, throttling and missing setup retain recognition and mark
nutrition unresolved. No universal food-category estimate is substituted.
The function caches successful results for one hour in each running instance,
bounds request size, uses four concurrent lookups, and deduplicates meal queries.
Its per-instance burst guard is not a global quota. Monitor USDA usage and add
persistent shared caching/rate limiting before high-volume deployment.

USDA currently documents a default limit of 1,000 requests/hour/IP.
Source: https://fdc.nal.usda.gov/api-guide/
USDA data are public domain (CC0). In-app source links identify the selected record.

## Review behavior

- A complete automatic estimate can be saved immediately, including compatible
  recipe averages. The recognized dish name stays unchanged. Details and edits
  are optional and initially collapsed.
- If nutrition cannot be resolved, values remain null and the number is explicitly
  a known subtotal. The primary action becomes Retry estimate; incomplete totals
  cannot be saved as a complete estimate. Manual correction remains optional.
- Recognition estimates portion mass from count, thickness and container context,
  with an uncalibrated plausible range available in estimate details. It uses
  whole-dish recipes or disjoint components, never both for the same portion.
- Tap an ingredient to search, correct its base amount, select a documented serving,
  remove an incorrect detection, or enter nutrition from a label/known recipe.
- Whole soup/curry/salad references replace the components of that same region.
  Separate sides remain included.
- Grams from vision stay grams, including drinks. No assumed density or arbitrary
  piece/cup conversion is used.
- Correcting a food clears a meal-level nutrition override. Original photo analysis
  remains in the draft; corrected analysis survives review navigation.
- Saved totals use the existing meal schema. Detailed ingredient edits are kept in
  the in-memory review draft, not in meal history.

## Verify

Run npm test -- --runInBand and npm run typecheck. Run the authenticated food evaluator
for fresh meals; --replay uses saved recognition and nutrition responses.
Re-run old evaluation data live once to populate nutrition lookup responses.

Phone checks: pancakes/syrup, borscht/crispbread, shrimp curry, and a new food outside
the reviewed alias list. Confirm raw vs cooked matches, correct grams, unknown foods,
manual override, 0.5×/2× save-and-reload, and session changes.
Record weighed amounts and recipes in photo-food/reference.json before reporting
portion or calorie accuracy. A successful scan is not evidence of accurate weight.
