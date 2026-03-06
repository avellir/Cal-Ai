Your overall architecture is sound: AI for visual decomposition, food DB for nutrition, then validation/fallbacks. That is the right direction. The main weakness is not the idea, it is the loss of structured data between stages.

## Findings

1. High: validation warnings are computed but never reach the UI. You generate important warnings like USDA fallback usage and calorie/macro discrepancy, but `validateAdvancedAnalysis` only writes back `confidence`, not the new warnings, so the result screen cannot explain why confidence dropped. [advancedFoodValidation.ts#L88](/mnt/c/cal-ai/services/advancedFoodValidation.ts#L88) [advancedFoodValidation.ts#L108](/mnt/c/cal-ai/services/advancedFoodValidation.ts#L108) [camera.tsx#L193](/mnt/c/cal-ai/app/(app)/camera.tsx#L193)

2. High: unit handling is lossy, so beverages and label-extracted foods can display wrong serving info. Label extraction creates an ingredient with `unit: 'serving'`, but your display mapper converts unknown units as grams; then the camera screen hard-codes ingredient units to `'g'`. That can turn “1 serving” into something like “1g”, and drinks lose `ml`. [advancedFoodEdgeCases.ts#L699](/mnt/c/cal-ai/services/advancedFoodEdgeCases.ts#L699) [foodAnalysis.ts#L58](/mnt/c/cal-ai/services/foodAnalysis.ts#L58) [fatSecretApi.ts#L1484](/mnt/c/cal-ai/services/fatSecretApi.ts#L1484) [camera.tsx#L196](/mnt/c/cal-ai/app/(app)/camera.tsx#L196)

3. High: portion adjustments are applied, but most of that provenance is stripped before display. The analysis stage sets `wasAdjusted` and `adjustmentReason`, and the result UI is built to show them, but the legacy mapping drops those fields and `camera.tsx` never passes `adjustments` at all. So you do the correction work without giving the user transparency. [advancedFoodAnalysis.ts#L421](/mnt/c/cal-ai/services/advancedFoodAnalysis.ts#L421) [foodAnalysis.ts#L62](/mnt/c/cal-ai/services/foodAnalysis.ts#L62) [camera.tsx#L195](/mnt/c/cal-ai/app/(app)/camera.tsx#L195) [food-result.tsx#L528](/mnt/c/cal-ai/app/(app)/food-result.tsx#L528)

4. Medium: FatSecret matching is too naive. `searchFatSecretFood` just takes the first returned result, with no ranking by exact token overlap, generic-vs-branded preference, preparation match, or serving compatibility. That will produce silent mis-matches even when vision was correct. [fatSecretApi.ts#L893](/mnt/c/cal-ai/services/fatSecretApi.ts#L893) [fatSecretApi.ts#L940](/mnt/c/cal-ai/services/fatSecretApi.ts#L940)

5. Medium: you already have a better display label (`dishName`), but you discard it and rebuild `foodName` from region descriptions. That makes the displayed meal name weaker than the model output needed to be. [advancedFoodAnalysis.ts#L128](/mnt/c/cal-ai/services/advancedFoodAnalysis.ts#L128) [advancedFoodAnalysis.ts#L258](/mnt/c/cal-ai/services/advancedFoodAnalysis.ts#L258) [foodAnalysis.ts#L55](/mnt/c/cal-ai/services/foodAnalysis.ts#L55)

6. Medium: your region box schema is inconsistent. The Gemini schema uses `xmin/ymin/xmax/ymax`, while `FoodRegion` is typed as `x/y/width/height`. That is survivable now, but it will break overlays or validation later. [advancedFoodAnalysis.ts#L681](/mnt/c/cal-ai/services/advancedFoodAnalysis.ts#L681) [advanced-food-analysis-types.ts#L18](/mnt/c/cal-ai/lib/advanced-food-analysis-types.ts#L18)

## What I'd Improve

1. Keep one canonical analysis object from AI -> DB lookup -> UI. Do not remap into a lossy legacy shape in the middle.
2. Preserve separate fields for `detectedName`, `dishName`, `matchedFoodName`, `matchSource`, `matchConfidence`, `estimatedQuantity`, `displayQuantity`, and `displayUnit`.
3. Add a scoring layer on top of FatSecret search results instead of taking the first hit.
4. Surface uncertainty explicitly in the UI: “recognized as”, “matched to DB entry”, “portion adjusted”, “fallback source used”.
5. Add tests for the risky paths: beverages, label extraction, USDA fallback, serving scaling, and route-param serialization. I only found meal-log/storage tests under `__tests__`, not pipeline coverage.

## Bottom Line

The approach is good. The biggest improvement is to stop collapsing rich analysis data into a simplified display model too early.
