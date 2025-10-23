# Stage 4: Nutritional Aggregation Implementation

## Overview

This document describes the implementation of Stage 4 (Nutritional Aggregation) of the advanced multi-stage food analysis system.

## Files Created

### 1. `services/nutritionAggregation.ts`

Main implementation file containing:

#### Task 6.1: Nutrition Aggregation Logic

**Function: `aggregateNutrition()`**
- Sums all nutritional values from enriched ingredients
- Calculates weighted average confidence score based on calorie contribution
- Implements rounding rules per requirements:
  - Requirement 4.1: Sum calories from all ingredients
  - Requirement 4.2: Sum protein, carbohydrates, and fat
  - Requirement 4.3: Round calories to nearest 5 for values over 50
  - Requirement 4.4: Round macronutrients to nearest whole gram

**Input:**
```typescript
EnrichedIngredient[] // From Stage 3 (FatSecret lookup)
```

**Output:**
```typescript
{
  totalNutrition: {
    calories: number;  // Rounded to nearest 5 if > 50
    protein: number;   // Rounded to whole gram
    carbs: number;     // Rounded to whole gram
    fat: number;       // Rounded to whole gram
  };
  confidence: number;  // Weighted average (0-100)
}
```

#### Task 6.2: Ingredient Breakdown Generation

**Function: `generateIngredientBreakdown()`**
- Groups ingredients by food region
- Calculates each ingredient's contribution percentage to total nutrition
- Formats quantities with user-friendly unit conversions
- Implements requirements:
  - Requirement 4.5: Breakdown showing each ingredient's contribution
  - Requirement 5.1: List of all ingredients with quantities
  - Requirement 5.2: Indicate which region each ingredient belongs to
  - Requirement 5.4: User-friendly units alongside metric measurements

**Input:**
```typescript
enrichedIngredients: EnrichedIngredient[]
regions: FoodRegion[]  // From Stage 1 (segmentation)
totalNutrition: { calories, protein, carbs, fat }
```

**Output:**
```typescript
RegionBreakdown[] = [
  {
    regionId: string;
    regionDescription: string;
    ingredients: IngredientBreakdown[];
    regionTotals: { calories, protein, carbs, fat };
  }
]
```

**Helper Functions:**
- `calculateContribution()` - Calculates percentage contribution to total
- `formatDisplayQuantity()` - Converts units for user-friendly display
  - g → oz (for quantities ≥ 28g)
  - ml → fl oz (for quantities ≥ 30ml)
  - oz → g
  - cup → ml
  - tbsp → ml
  - tsp → ml
  - piece → count

**Function: `formatIngredientSummary()`**
- Generates human-readable text summary of all ingredients
- Groups by region with totals
- Shows contribution percentages

### 2. `services/nutritionAggregation.example.ts`

Example usage and verification file demonstrating:
- Sample data structure
- How to use aggregation functions
- Requirement verification checks

## Integration Points

### Input (from previous stages):
1. **Stage 1 (Segmentation)**: `FoodRegion[]` - Used for grouping ingredients
2. **Stage 3 (Lookup)**: `EnrichedIngredient[]` - Ingredients with nutrition data

### Output (for next stage):
Used by Stage 7 (Main Orchestration) to build final `AdvancedAnalysisResult`:
```typescript
{
  success: true,
  data: {
    totalNutrition: { ... },      // From aggregateNutrition()
    ingredients: [ ... ],          // EnrichedIngredient[]
    regions: [ ... ],              // FoodRegion[]
    confidence: number,            // From aggregateNutrition()
  }
}
```

## Requirements Coverage

| Requirement | Description | Implementation |
|-------------|-------------|----------------|
| 4.1 | Sum calories from all ingredients | `aggregateNutrition()` - reduces scaledNutrition.calories |
| 4.2 | Sum protein, carbs, fat | `aggregateNutrition()` - reduces all macros |
| 4.3 | Round calories to nearest 5 (>50) | `aggregateNutrition()` - conditional rounding logic |
| 4.4 | Round macros to whole gram | `aggregateNutrition()` - Math.round() on all macros |
| 4.5 | Ingredient contribution breakdown | `generateIngredientBreakdown()` - calculates percentages |
| 5.1 | List ingredients with quantities | `generateIngredientBreakdown()` - includes all data |
| 5.2 | Group by food region | `generateIngredientBreakdown()` - groups by regionId |
| 5.4 | User-friendly unit conversions | `formatDisplayQuantity()` - converts g↔oz, ml↔floz |

## Usage Example

```typescript
import { aggregateNutrition, generateIngredientBreakdown } from '@/services/nutritionAggregation';

// After Stage 3 completes
const enrichedIngredients = await batchLookupNutrition(ingredients);

// Stage 4: Aggregate
const { totalNutrition, confidence } = aggregateNutrition(enrichedIngredients);

// Generate breakdown for UI
const breakdown = generateIngredientBreakdown(
  enrichedIngredients,
  segmentation.regions,
  totalNutrition
);

// Result:
// totalNutrition = { calories: 635, protein: 60, carbs: 56, fat: 17 }
// confidence = 87
// breakdown = [{ regionId: 'region_1', ingredients: [...], ... }]
```

## Testing

Since no test framework is configured in the project, verification can be done by:

1. Running the example file:
   ```typescript
   import { exampleAggregation, verifyRequirements } from '@/services/nutritionAggregation.example';
   
   exampleAggregation();
   verifyRequirements();
   ```

2. Manual integration testing in the main orchestration function (Task 7)

## Type Safety

All functions use strict TypeScript types from `@/lib/advanced-food-analysis-types.ts`:
- `EnrichedIngredient`
- `FoodRegion`
- `IngredientBreakdown` (new type)
- `RegionBreakdown` (new type)

## Performance Considerations

- **Time Complexity**: O(n) where n = number of ingredients
- **Space Complexity**: O(n) for breakdown generation
- **Optimizations**:
  - Single pass aggregation
  - Efficient grouping using Map
  - Minimal object allocations

## Next Steps

This implementation completes Task 6. The next task (Task 7) will integrate this with:
- Stage 1: `segmentFoodImage()`
- Stage 2: `decomposeAllRegions()`
- Stage 3: `batchLookupNutrition()`
- Stage 4: `aggregateNutrition()` + `generateIngredientBreakdown()` ✓

To create the main orchestration function `analyzeAdvancedFoodImage()`.
