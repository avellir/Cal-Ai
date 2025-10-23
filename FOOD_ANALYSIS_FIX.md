# Food Analysis Fixes - Duplication & Portion Size

## Problems Identified

### Issue 1: Duplication
The AI was detecting individual pieces (like each olive) as separate ingredients and creating duplicate entries with different names (e.g., "Chicken Breast" AND "Chicken Breast, Grilled"), leading to:
- Inflated calorie counts (2725 cal instead of ~700 cal)
- 32 ingredients for a simple meal
- Same food listed multiple times

### Issue 2: Massive Portion Overestimation
The AI was wildly overestimating portion sizes:
- 410g of hummus (should be ~20-40g for a spoonful)
- 170g of spinach (should be ~30-50g for a handful)
- 90g of olives (should be ~20-40g for a few pieces)
- 100g of pickles (should be ~30-50g)
- Total meal weight: 2075g (should be ~400-600g)

## Root Causes
1. **Segmentation over-splitting**: Creating separate regions for each piece
2. **Decomposition counting pieces**: Listing each olive/piece individually
3. **No portion size references**: AI defaulting to 100g or guessing wildly
4. **No validation**: Unrealistic quantities passing through unchecked

## Solutions Implemented

### 1. Enhanced Segmentation Prompt
- Explicit instruction: "Group similar items together! DO NOT create separate regions for each piece"
- Grouping rules: Multiple pieces of same food = ONE region
- Limited to 5-8 regions maximum
- Small garnishes combined with main food

### 2. Comprehensive Portion Size Guidelines
Added detailed visual reference guides:
- **Size comparisons**: Tablespoon = thumb tip, Tennis ball = 1/2 cup, Deck of cards = 85g meat
- **Plate coverage**: 1/8 plate = 30-60g, 1/4 plate = 80-120g, 1/2 plate = 150-200g
- **Specific food categories**:
  - Spreads/dips (hummus, guacamole): 15-60g typical, NEVER >100g
  - Condiments: 5-30ml typical
  - Leafy greens: 30-100g typical
  - Small vegetables (olives, pickles): 20-80g typical
  - Oils: 5-20ml typical

### 3. Conservative Estimation Rules
- Step-by-step visual estimation process
- Compare to plate size first
- Compare to reference objects (utensils, hands)
- For spreads/dips: BE VERY CONSERVATIVE
- When in doubt: UNDERESTIMATE rather than overestimate
- Added realistic meal examples showing total weights of 225-305g

### 4. Final Checklist with Sanity Checks
Added validation before AI responds:
- Total meal weight should be 300-800g
- Spreads/dips should be 15-60g, NOT 200-400g
- Condiments should be 5-30ml, NOT 100ml+
- Side vegetables should be 30-100g, NOT 200-400g
- Explicit examples: "A spoonful of hummus is ~15-30g, NOT 400g!"

### 5. Post-Processing Validation
Added `validateIngredientQuantities()` function that:
- Catches unrealistic quantities after AI response
- Applies category-specific limits:
  - Spreads/dips: Max 100g → adjusted to 40g
  - Condiments: Max 50ml → adjusted to 20ml
  - Leafy greens: Max 150g → adjusted to 60g
  - Small vegetables: Max 100g → adjusted to 40g
  - Cheese: Max 80g → adjusted to 40g
  - Oils: Max 30ml → adjusted to 15ml
- Logs adjustments with warnings
- Lowers confidence score for adjusted values

### 6. Deduplication System
Added `deduplicateIngredients()` function that:
- Detects similar ingredient names
- Merges quantities when units are compatible
- Keeps the lowest confidence score
- Logs when duplicates are merged

### 7. Ingredient Similarity Detection
`areIngredientsSimilar()` function:
- Normalizes names (lowercase, removes preparation methods)
- Checks for exact matches and substring matches
- Prevents false positives (e.g., "olive oil" vs "olives")

### 8. Unit Conversion
`convertToSameUnit()` function:
- Converts between g/oz for weights
- Converts between ml/cup/tbsp/tsp for volumes
- Returns null if conversion not possible

## Expected Results
For the same meal photo, you should now see:
- **Ingredient count**: 5-7 items instead of 32
- **Hummus**: ~20-40g instead of 410g
- **Spinach**: ~30-50g instead of 170g
- **Olives**: ~20-40g instead of 90g
- **Pickles**: ~30-50g instead of 100g
- **Total meal weight**: ~400-600g instead of 2075g
- **Total calories**: ~600-900 cal instead of 2605 cal
- Each food type listed once with realistic portions

## Validation Layers
1. **AI Prompt**: Detailed guidelines and examples
2. **AI Checklist**: Sanity checks before responding
3. **Post-processing**: Automatic adjustment of unrealistic values
4. **Deduplication**: Merge similar ingredients
5. **Logging**: Track all adjustments for debugging
