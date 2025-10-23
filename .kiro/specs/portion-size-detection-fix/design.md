# Design Document: Portion Size Detection Fix

## Overview

This design addresses the critical issue where the food analysis system correctly identifies ingredients but defaults all portions to 100g, resulting in inaccurate nutritional calculations. The fix enhances the Stage 2 (Ingredient Decomposition) prompt and response schema to force the Gemini Vision API to perform actual visual portion estimation using reference objects, relative sizing, and depth analysis.

The solution focuses on three key improvements:

1. **Enhanced Decomposition Prompt** - Add explicit visual analysis instructions with reference object guidelines
2. **Structured Portion Reasoning** - Require the AI to explain its portion size logic
3. **Validation Layer** - Post-process estimates to catch and correct unrealistic defaults

## Architecture

### Current Problem

The existing `getDecompositionPrompt()` function provides quantity estimation guidelines but doesn't enforce visual analysis:

```typescript
// Current prompt includes guidelines but AI ignores them
'3. Use visual cues and standard portion sizes for weight estimation:'
'   - Chicken breast: ~170g per piece, ~85g per half piece'
```

**Issue**: The AI treats these as defaults rather than baselines for visual adjustment.


### Proposed Solution Architecture

```
Image + Region Description
    ↓
Enhanced Decomposition Prompt
    ├─ Step 1: Identify Reference Objects
    ├─ Step 2: Estimate Portion Sizes Visually
    ├─ Step 3: Provide Reasoning for Each Estimate
    └─ Step 4: Validate Against Realistic Ranges
    ↓
Gemini Vision API Response
    ├─ Ingredients with visual-based quantities
    ├─ Portion reasoning for each ingredient
    └─ Reference objects used
    ↓
Post-Processing Validation
    ├─ Check for 100g defaults
    ├─ Validate total meal weight
    └─ Adjust unrealistic estimates
    ↓
Validated Ingredient List
```

## Components and Interfaces

### 1. Enhanced Decomposition Schema

Add new fields to capture portion estimation reasoning:

```typescript
type Ingredient = {
  name: string;
  quantity: number;
  unit: string;
  preparation?: string;
  regionId: string;
  confidence: number;
  // NEW FIELDS
  portionReasoning: string; // Explains how quantity was estimated
  referenceObjects?: string[]; // Objects used for scale (e.g., ["plate", "fork"])
  visualDescriptor?: string; // e.g., "covers 1/3 of plate", "stacked 2 inches high"
};
```



### 2. Enhanced Decomposition Prompt

Restructure the prompt to enforce visual analysis:

```typescript
function getDecompositionPrompt(region: FoodRegion): string {
  return `Analyze the food region: "${region.description}"

CRITICAL: You MUST estimate actual portion sizes from the image, NOT use default values.

STEP 1: IDENTIFY REFERENCE OBJECTS
Look for these scale references in the image:
- Dinner plates (10-11 inches / 25-28 cm diameter)
- Salad/dessert plates (7-8 inches / 18-20 cm diameter)
- Bowls (standard ~2 cup / 480ml capacity)
- Forks/spoons (fork ~7 inches / 18 cm length)
- Hands (palm width ~3-4 inches / 8-10 cm)
- Cups/glasses (standard cup ~8 oz / 240 ml)
- Food items relative to each other

STEP 2: ESTIMATE PORTION SIZES VISUALLY
For EACH ingredient, analyze:

A. SURFACE AREA COVERAGE
   - What percentage of the plate/bowl does it cover?
   - Compare to reference: "covers 1/4 of plate", "fills half the bowl"
   
B. HEIGHT/DEPTH
   - How high is it stacked or piled?
   - Measure in inches or compare to utensils: "1 inch high", "height of fork tines"
   
C. VOLUME ESTIMATION
   - For rice/grains: estimate cups based on coverage + height
     * 1 cup cooked rice = ~180g, occupies ~240ml volume
   - For proteins: compare to standard pieces
     * Chicken breast piece = ~170g (palm-sized, 1 inch thick)
     * Fish fillet = ~140g (palm-sized, 0.75 inch thick)
   - For vegetables: estimate cups or pieces
     * 1 cup chopped vegetables = ~80-120g depending on density

D. DENSITY ADJUSTMENT
   - Leafy greens: 1 cup = ~30g (very light)
   - Cooked rice: 1 cup = ~180g (dense)
   - Cooked pasta: 1 cup = ~140g (medium)
   - Liquids: 1 cup = ~240ml

STEP 3: CALCULATE WEIGHT FROM VISUAL ANALYSIS
Use this formula: Weight = (Coverage % × Reference Size) × Height Factor × Density

Example calculations:
- Rice covering 1/3 of 10-inch plate, 1 inch high:
  * Coverage area ≈ 26 sq inches (1/3 of ~78 sq inch plate)
  * Volume ≈ 26 cubic inches ≈ 1.5 cups
  * Weight = 1.5 cups × 180g/cup = 270g

- Chicken breast covering 1/4 of plate, 1 inch thick:
  * Size ≈ palm-sized (4 inches × 3 inches)
  * Thickness = 1 inch
  * Weight ≈ 170g (standard chicken breast)

STEP 4: PROVIDE REASONING
For each ingredient, explain:
- Which reference objects you used
- How you estimated the size visually
- Your calculation logic

QUANTITY ESTIMATION BASELINES (adjust based on visual analysis):
- Chicken breast: 170g per piece (adjust if smaller/larger)
- Beef steak: 225g per 8oz portion
- Fish fillet: 140g per piece
- Pork chop: 180g per piece

- White rice (cooked): 180g per cup, 90g per 1/2 cup
- Brown rice (cooked): 195g per cup
- Pasta (cooked): 140g per cup
- Quinoa (cooked): 185g per cup

- Bell pepper: 120g whole, 30g per 1/4
- Onion: 150g whole, 40g per 1/4, 10g per slice
- Tomato: 180g whole, 45g per 1/4
- Broccoli: 90g per cup florets
- Carrot: 60g per medium, 15g per 1/4

- Olive oil: 15ml per tablespoon visible
- Butter: 14g per tablespoon
- Soy sauce: 15ml per tablespoon

COOKING OIL DETECTION:
- Fried foods (glossy, golden-brown): add 15-20g oil
- Sautéed foods (light sheen): add 10-15ml oil
- Grilled/baked (dry surface): no oil unless visible

VALIDATION CHECKS:
- Does the total weight make sense for the visible food?
- Are portions realistic for a typical meal?
- If all ingredients are 100g, you're doing it WRONG - recalculate!

Return JSON with ingredient breakdown including portion reasoning.`;
}
```



### 3. Updated JSON Schema

Modify the decomposition schema to include reasoning fields:

```typescript
function getDecompositionSchema(regionId: string) {
  return {
    type: 'object',
    properties: {
      referenceObjects: {
        type: 'array',
        description: 'Reference objects identified for scale (e.g., plate, fork, hand)',
        items: { type: 'string' },
      },
      ingredients: {
        type: 'array',
        description: 'Array of identified ingredients with visual-based quantities',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Specific ingredient name (FatSecret-compatible)',
            },
            quantity: {
              type: 'number',
              description: 'Quantity based on VISUAL ANALYSIS, not defaults',
              minimum: 0,
            },
            unit: {
              type: 'string',
              description: 'Measurement unit',
              enum: ['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece'],
            },
            preparation: {
              type: 'string',
              description: 'Cooking/preparation method if visible',
            },
            portionReasoning: {
              type: 'string',
              description: 'Explanation of how quantity was estimated from visual analysis',
            },
            visualDescriptor: {
              type: 'string',
              description: 'Visual description of portion (e.g., "covers 1/3 of plate, 1 inch high")',
            },
            confidence: {
              type: 'number',
              description: 'Confidence score from 0-100',
              minimum: 0,
              maximum: 100,
            },
          },
          required: ['name', 'quantity', 'unit', 'portionReasoning', 'confidence'],
        },
      },
      dishName: {
        type: 'string',
        description: 'Name of prepared dish if applicable',
      },
      confidence: {
        type: 'number',
        description: 'Overall decomposition confidence from 0-100',
        minimum: 0,
        maximum: 100,
      },
    },
    required: ['ingredients', 'confidence'],
  };
}
```



### 4. Post-Processing Validation

Add validation layer to catch and correct default values:

```typescript
/**
 * Validates and corrects portion estimates that appear to be defaults
 * Requirements: 8.1, 8.4, 8.5
 */
function validatePortionEstimates(
  decomposition: DecompositionResult,
  region: FoodRegion
): DecompositionResult {
  const { ingredients } = decomposition;
  
  // Check 1: Detect if all ingredients are exactly 100g (obvious default)
  const all100g = ingredients.every(
    ing => ing.quantity === 100 && ing.unit === 'g'
  );
  
  if (all100g && ingredients.length > 1) {
    console.warn(`All ingredients defaulted to 100g for region ${region.regionId}`);
    // Reduce confidence significantly
    decomposition.confidence = Math.max(30, decomposition.confidence - 30);
    
    // Add warning to reasoning
    ingredients.forEach(ing => {
      ing.portionReasoning = `WARNING: Default estimate used. ${ing.portionReasoning || 'Visual analysis unclear'}`;
      ing.confidence = Math.max(30, ing.confidence - 20);
    });
  }
  
  // Check 2: Validate total meal weight is realistic
  const totalWeight = ingredients.reduce((sum, ing) => {
    const grams = convertToGrams(ing.quantity, ing.unit);
    return sum + grams;
  }, 0);
  
  // Typical meal range: 200g - 1500g
  if (totalWeight < 50) {
    console.warn(`Total weight ${totalWeight}g seems too low for region ${region.regionId}`);
    decomposition.confidence = Math.max(40, decomposition.confidence - 20);
  } else if (totalWeight > 2000) {
    console.warn(`Total weight ${totalWeight}g seems too high for region ${region.regionId}`);
    decomposition.confidence = Math.max(40, decomposition.confidence - 20);
  }
  
  // Check 3: Validate individual portions against realistic ranges
  const adjustedIngredients = ingredients.map(ing => {
    const grams = convertToGrams(ing.quantity, ing.unit);
    const validation = validateIngredientPortion(ing.name, grams);
    
    if (!validation.isValid) {
      console.warn(
        `Portion for ${ing.name} (${grams}g) outside realistic range ` +
        `[${validation.minGrams}-${validation.maxGrams}g]`
      );
      
      // Adjust to midpoint of realistic range
      const adjustedGrams = (validation.minGrams + validation.maxGrams) / 2;
      ing.quantity = adjustedGrams;
      ing.unit = 'g';
      ing.confidence = Math.max(40, ing.confidence - 15);
      ing.portionReasoning = `Adjusted from ${grams}g to realistic range. ${ing.portionReasoning}`;
    }
    
    return ing;
  });
  
  return {
    ...decomposition,
    ingredients: adjustedIngredients,
  };
}

/**
 * Validates if a portion size is within realistic range for the ingredient
 */
function validateIngredientPortion(
  ingredientName: string,
  grams: number
): { isValid: boolean; minGrams: number; maxGrams: number } {
  const name = ingredientName.toLowerCase();
  
  // Define realistic ranges for common ingredients
  const ranges: Record<string, { min: number; max: number }> = {
    // Proteins (typical serving: 85-225g)
    'chicken': { min: 50, max: 400 },
    'beef': { min: 50, max: 400 },
    'pork': { min: 50, max: 400 },
    'fish': { min: 50, max: 300 },
    'salmon': { min: 50, max: 300 },
    'shrimp': { min: 30, max: 250 },
    'egg': { min: 40, max: 200 }, // 1-4 eggs
    
    // Grains (typical serving: 100-250g cooked)
    'rice': { min: 50, max: 400 },
    'pasta': { min: 50, max: 400 },
    'quinoa': { min: 50, max: 300 },
    'bread': { min: 25, max: 150 },
    
    // Vegetables (typical serving: 50-200g)
    'broccoli': { min: 30, max: 300 },
    'carrot': { min: 20, max: 200 },
    'pepper': { min: 20, max: 200 },
    'onion': { min: 10, max: 200 },
    'tomato': { min: 30, max: 300 },
    'lettuce': { min: 20, max: 150 },
    'spinach': { min: 20, max: 150 },
    
    // Oils/sauces (typical: 5-30ml)
    'oil': { min: 5, max: 50 },
    'butter': { min: 5, max: 30 },
    'sauce': { min: 10, max: 60 },
    'dressing': { min: 10, max: 50 },
  };
  
  // Find matching range
  for (const [key, range] of Object.entries(ranges)) {
    if (name.includes(key)) {
      const isValid = grams >= range.min && grams <= range.max;
      return {
        isValid,
        minGrams: range.min,
        maxGrams: range.max,
      };
    }
  }
  
  // Default range for unknown ingredients
  return {
    isValid: grams >= 10 && grams <= 500,
    minGrams: 10,
    maxGrams: 500,
  };
}
```



### 5. Integration with Existing Pipeline

Modify the `decomposeIngredients` function to include validation:

```typescript
export async function decomposeIngredients(
  base64Image: string,
  region: FoodRegion
): Promise<DecompositionResult> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Google Gemini API key not configured');
  }

  const model =
    process.env.EXPO_PUBLIC_GOOGLE_GEMINI_MODEL ||
    process.env.GOOGLE_GEMINI_MODEL ||
    'gemini-2.5-flash-lite';

  const prompt = getDecompositionPrompt(region); // Enhanced prompt

  const response = await runGeminiRequest({
    apiKey,
    model,
    parts: buildParts(prompt, base64Image),
    temperature: 0.1,
    maxOutputTokens: 1500, // Increased for reasoning fields
    responseSchema: getDecompositionSchema(region.regionId),
  });

  const parsed = parseDecomposition(response, region);
  
  // NEW: Validate and correct portion estimates
  const validated = validatePortionEstimates(parsed, region);
  
  return validated;
}
```



## Data Models

### Updated Type Definitions

```typescript
// Update Ingredient type in advanced-food-analysis-types.ts
export type Ingredient = {
  name: string;
  quantity: number;
  unit: string;
  preparation?: string;
  regionId: string;
  confidence: number;
  // NEW FIELDS
  portionReasoning?: string; // Explanation of quantity estimate
  visualDescriptor?: string; // Visual description (e.g., "covers 1/3 of plate")
  referenceObjects?: string[]; // Objects used for scale
};

// Update DecompositionResult type
export type DecompositionResult = {
  ingredients: Ingredient[];
  dishName?: string;
  confidence: number;
  // NEW FIELD
  referenceObjects?: string[]; // Reference objects identified in the region
};
```

## Error Handling

### Fallback Strategies

1. **No Reference Objects Detected**:
   - Use typical serving sizes as baselines
   - Reduce confidence score by 15 points
   - Add note in reasoning: "No reference objects visible, using typical serving sizes"

2. **All Portions Default to 100g**:
   - Log warning for monitoring
   - Reduce confidence score by 30 points
   - Add warning prefix to portion reasoning
   - Consider triggering re-analysis with different prompt

3. **Unrealistic Total Weight**:
   - If total < 50g: Increase all portions proportionally to reach 150g minimum
   - If total > 2000g: Decrease all portions proportionally to reach 800g maximum
   - Reduce confidence score by 20 points

4. **Individual Portion Out of Range**:
   - Adjust to midpoint of realistic range
   - Reduce ingredient confidence by 15 points
   - Add adjustment note to reasoning



## Testing Strategy

### Unit Tests

1. **Prompt Generation**:
   - Verify enhanced prompt includes all visual analysis steps
   - Confirm reference object guidelines are present
   - Check calculation examples are included

2. **Validation Logic**:
   - Test detection of 100g defaults
   - Test realistic range validation for various ingredients
   - Test total weight validation (too low/too high)
   - Test confidence score adjustments

3. **Portion Reasoning Parsing**:
   - Verify reasoning field is captured
   - Test visual descriptor extraction
   - Validate reference objects array

### Integration Tests

1. **Real Image Analysis**:
   ```typescript
   const testCases = [
     {
       name: 'Plate with chicken and rice',
       image: 'chicken_rice_plate.jpg',
       expectedBehavior: {
         chickenRange: [150, 200], // grams
         riceRange: [150, 250],
         hasReferenceObjects: true,
         noDefaultPortions: true,
       },
     },
     {
       name: 'Bowl of pasta',
       image: 'pasta_bowl.jpg',
       expectedBehavior: {
         pastaRange: [200, 350],
         hasReferenceObjects: true,
         totalWeightRange: [200, 400],
       },
     },
     {
       name: 'Stir-fry with multiple ingredients',
       image: 'stir_fry.jpg',
       expectedBehavior: {
         ingredientCount: [4, 7],
         noDefaultPortions: true,
         totalWeightRange: [300, 600],
       },
     },
   ];
   ```

2. **Validation Tests**:
   - Test with mock data containing all 100g portions
   - Test with unrealistic portion sizes (1g chicken, 5000g rice)
   - Test with missing reference objects
   - Verify confidence adjustments are applied

### Manual Testing Checklist

- [ ] Take photo of known portions (weighed beforehand)
- [ ] Compare estimated weights to actual weights
- [ ] Verify portion reasoning makes sense
- [ ] Check that reference objects are identified
- [ ] Confirm no ingredients default to exactly 100g
- [ ] Test with various plate sizes and containers
- [ ] Test with and without utensils visible
- [ ] Test with hand in frame for scale
- [ ] Test with poor lighting conditions
- [ ] Test with mixed dishes vs. separate items



## Performance Considerations

### Token Usage

- Enhanced prompt increases token count by ~500 tokens
- Reasoning fields add ~200 tokens to response
- Total increase: ~700 tokens per region
- Impact: Minimal, well within Gemini limits

### Processing Time

- Validation adds <50ms per region
- No additional API calls required
- Overall pipeline impact: <5% increase

### API Costs

- No change to number of API calls
- Slightly higher token usage per call
- Estimated cost increase: <10%

## Migration Plan

### Phase 1: Implementation (Week 1)

1. Update `getDecompositionPrompt()` with enhanced instructions
2. Update `getDecompositionSchema()` to include new fields
3. Implement `validatePortionEstimates()` function
4. Update type definitions in `advanced-food-analysis-types.ts`
5. Integrate validation into `decomposeIngredients()`

### Phase 2: Testing (Week 1-2)

1. Unit test validation logic
2. Integration test with sample images
3. Manual testing with known portions
4. Compare results to current system

### Phase 3: Rollout (Week 2)

1. Deploy to staging environment
2. A/B test with 10% of users
3. Monitor portion estimate accuracy
4. Collect user feedback
5. Full rollout if metrics improve

### Success Metrics

- **Primary**: Reduce instances of all-100g portions from ~80% to <10%
- **Secondary**: Improve total meal weight accuracy (within 20% of actual)
- **Tertiary**: Maintain or improve confidence scores
- **User Satisfaction**: Reduce "this doesn't look right" feedback

## Backward Compatibility

The changes are backward compatible:
- New fields are optional in the schema
- Existing code continues to work
- Validation layer only enhances, doesn't break
- Old responses without reasoning still parse correctly

## Future Enhancements

1. **Machine Learning Calibration**:
   - Collect user corrections to portion estimates
   - Train model to improve visual estimation
   - Personalize to user's typical portion sizes

2. **Multi-Image Analysis**:
   - Allow users to take photos from multiple angles
   - Combine perspectives for better volume estimation
   - Use depth information if available

3. **Reference Object Detection**:
   - Use computer vision to automatically detect plates/utensils
   - Measure reference objects precisely
   - Provide more accurate scale calibration

4. **User Feedback Loop**:
   - Allow users to adjust portion estimates
   - Learn from corrections over time
   - Improve prompt based on common errors
