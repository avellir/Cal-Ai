# Design Document: Improved Food Detection and Analysis

## Overview

This design enhances the existing two-stage food analysis system to improve accuracy, consistency, and user confidence. The improvements focus on refining AI prompts, adding validation logic, and implementing better contextual awareness while maintaining the current architecture and API integration with Google Gemini 2.5 Flash.

The current system already implements a two-stage approach:
1. **Stage 1 (Identification)**: Identifies food items, portions, and preparation methods
2. **Stage 2 (Nutrition Estimation)**: Calculates nutritional values based on Stage 1 findings

Our enhancements will improve both stages without changing the fundamental architecture.

## Architecture

### Current Architecture (Maintained)
```
User captures image
    ↓
foodAnalysis.ts
    ↓
Stage 1: identificationPrompt → Gemini API → parseIdentification()
    ↓
Stage 2: buildStageTwoPrompt() → Gemini API → parseNutrition()
    ↓
Return AnalysisResult with identification + nutrition data
```

### Enhanced Components
- **Improved Prompts**: More specific instructions for food identification and portion estimation
- **Validation Layer**: Post-processing to validate nutritional consistency
- **Enhanced Context**: Better Stage 1 to Stage 2 information flow
- **Error Recovery**: Improved handling of ambiguous or low-quality images

## Components and Interfaces

### 1. Enhanced Identification Prompt

**Current Issues:**
- Generic instructions that don't emphasize specific visual cues
- Limited guidance on portion estimation techniques
- No explicit instructions for handling common edge cases

**Improvements:**

```typescript
const enhancedIdentificationPrompt = [
  'Stage 1 - Identify visible food items in the image with precision.',
  '',
  'VISUAL ANALYSIS INSTRUCTIONS:',
  '1. Identify ALL distinct food items you can clearly see',
  '2. For EACH item, analyze:',
  '   - Color, texture, and surface appearance (glossy = oil/sauce, charred = grilled, golden-brown = fried)',
  '   - Shape and structure (whole vs. chopped, intact vs. mixed)',
  '   - Visible ingredients or components',
  '   - Any garnishes, sauces, or condiments',
  '',
  'PORTION ESTIMATION TECHNIQUES:',
  '3. Use reference objects for size estimation:',
  '   - Standard dinner plates: 10-11 inches (25-28 cm) diameter',
  '   - Forks/spoons: ~7 inches (18 cm) length',
  '   - Hands: palm width ~3-4 inches (8-10 cm)',
  '   - Cups/bowls: standard cup ~8 oz (240 ml)',
  '4. Estimate coverage: "fills 1/3 of plate", "stacked 2 inches high", "size of a fist"',
  '5. Account for food density: leafy greens vs. dense proteins vs. liquids',
  '',
  'PREPARATION METHOD DETECTION:',
  '6. Look for visual indicators:',
  '   - Fried: golden-brown color, crispy texture, breading, glossy surface',
  '   - Grilled: char marks, grill lines, slightly dried edges',
  '   - Baked: even browning, dry surface',
  '   - Steamed: moist appearance, vibrant colors, no browning',
  '   - Raw: natural colors, no cooking marks',
  '   - Sautéed: light browning, glossy from oil',
  '',
  'PRIORITIZATION RULES:',
  '7. If more than 5 items visible, focus on the 5 largest by visual area',
  '8. Combine small condiments/sauces with their primary food item',
  '9. Ignore non-food items (napkins, utensils, decorations)',
  '',
  'CONFIDENCE SCORING GUIDELINES:',
  '- 80-100: Clear view, standard food, good lighting, visible reference objects',
  '- 60-79: Partially obscured, mixed dishes, or moderate lighting',
  '- 40-59: Poor lighting, unusual angle, or unfamiliar food combinations',
  '- 0-39: Blurry image, heavily obscured, or cannot identify food type',
  '',
  'Return ONLY valid JSON:',
  '{',
  '  "items": [',
  '    {',
  '      "foodName": "specific name (e.g., \'grilled chicken breast\' not just \'chicken\')",',
  '      "description": "appearance details: color, texture, visible ingredients, preparation indicators",',
  '      "portionHint": "size estimation with reference (e.g., \'fills 1/3 of 10-inch plate, ~6oz\')",',
  '      "preparation": "cooking method if detectable, else null",',
  '      "confidence": number (0-100)',
  '    }',
  '  ],',
  '  "overallConfidence": number (0-100),',
  '  "notes": "any ambiguities, image quality issues, or assumptions made"',
  '}',
].join('\n');
```

### 2. Enhanced Nutrition Estimation Prompt

**Current Issues:**
- Lacks specific guidance on handling Stage 1 context
- No explicit validation rules for nutritional consistency
- Limited instructions for preparation method adjustments

**Improvements:**

```typescript
const enhancedNutritionPrompt = [
  'Analyze this food image and provide detailed nutritional information.',
  '',
  'CRITICAL INSTRUCTIONS:',
  '',
  '1. PORTION SIZE ESTIMATION:',
  '   - Use reference objects visible in the image (plates, utensils, hands)',
  '   - Standard plate = 10-11 inches diameter',
  '   - Cross-reference with Stage 1 portion hints',
  '   - Account for food density: 1 cup leafy greens ≠ 1 cup rice in weight',
  '',
  '2. PREPARATION METHOD ADJUSTMENTS:',
  '   - Fried foods: Add 10-20% calories for oil absorption',
  '     * Deep fried: +20% (e.g., fried chicken, french fries)',
  '     * Pan fried: +10-15% (e.g., pan-fried fish)',
  '   - Grilled/baked: Use base nutritional values',
  '   - Sautéed: Add ~1 tbsp oil (120 cal, 14g fat) per serving',
  '   - Steamed/boiled: Use base values, no additions',
  '',
  '3. COMPREHENSIVE ITEM ACCOUNTING:',
  '   - Include ALL visible food items from Stage 1',
  '   - Account for sauces, dressings, and condiments',
  '   - Estimate butter, oil, or cheese if visible',
  '   - Consider garnishes if substantial (>1 tbsp)',
  '',
  '4. USDA DATABASE STANDARDS:',
  '   - Base all estimates on USDA nutritional data',
  '   - Use median values for foods with recipe variations',
  '   - Round calories to nearest 10 for portions >100 cal',
  '   - Round macros (protein, carbs, fat) to nearest whole gram',
  '',
  '5. NUTRITIONAL VALIDATION:',
  '   - Verify: (protein × 4) + (carbs × 4) + (fat × 9) ≈ total calories (±10%)',
  '   - If mismatch, adjust macros proportionally to match calories',
  '   - Protein: typically 10-35% of calories',
  '   - Carbs: typically 45-65% of calories',
  '   - Fat: typically 20-35% of calories',
  '',
  '6. CONFIDENCE SCORING:',
  '   - Reduce confidence if:',
  '     * Image quality is poor (blurry, dark, obscured)',
  '     * Portion size is ambiguous (no reference objects)',
  '     * Food type is unusual or mixed dish',
  '     * Preparation method is unclear',
  '   - High confidence (75-100): Clear image, standard food, visible portions',
  '   - Medium confidence (50-74): Some ambiguity in portion or preparation',
  '   - Low confidence (<50): Significant uncertainty in identification or quantity',
  '',
  '7. CONSERVATIVE ESTIMATES:',
  '   - When uncertain, estimate on the lower end for calories',
  '   - Better to underestimate than overestimate for user trust',
  '   - Note uncertainty in reasoning field',
  '',
  'Return ONLY valid JSON:',
  '{',
  '  "foodName": "specific name(s) of all food items (e.g., \'Grilled salmon with roasted vegetables and quinoa\')",',
  '  "calories": number (rounded to nearest 10 if >100)',',
  '  "protein": number (grams, whole number)',',
  '  "carbs": number (grams, whole number)',',
  '  "fat": number (grams, whole number)',',
  '  "servingSize": "detailed weight/volume with breakdown (e.g., \'6oz salmon, 1 cup vegetables, 1/2 cup quinoa\')",',
  '  "confidence": number (0-100)',',
  '  "reasoning": "brief explanation: portion estimation method, preparation adjustments, and any assumptions (max 2 sentences)"',
  '}',
  '',
  'IMPORTANT: Ensure nutritional consistency. Verify that (protein×4 + carbs×4 + fat×9) is within 10% of total calories.',
].join('\n');
```

### 3. Validation Layer

Add post-processing validation to ensure nutritional consistency and catch common errors:

```typescript
interface ValidationResult {
  isValid: boolean;
  adjustedData?: NutritionData;
  warnings: string[];
}

function validateNutritionData(data: NutritionData): ValidationResult {
  const warnings: string[] = [];
  let adjustedData = { ...data };
  let isValid = true;

  // 1. Validate calorie-to-macro consistency
  const calculatedCalories = (data.protein * 4) + (data.carbs * 4) + (data.fat * 9);
  const calorieDiscrepancy = Math.abs(calculatedCalories - data.calories) / data.calories;

  if (calorieDiscrepancy > 0.15) { // More than 15% discrepancy
    warnings.push('Calorie-to-macro mismatch detected, adjusting macros proportionally');
    
    // Adjust macros to match stated calories while maintaining ratios
    const totalMacroCalories = calculatedCalories;
    const scaleFactor = data.calories / totalMacroCalories;
    
    adjustedData.protein = Math.round(data.protein * scaleFactor);
    adjustedData.carbs = Math.round(data.carbs * scaleFactor);
    adjustedData.fat = Math.round(data.fat * scaleFactor);
    
    // Reduce confidence due to inconsistency
    adjustedData.confidence = Math.max(30, data.confidence - 15);
  }

  // 2. Validate reasonable macro ratios
  const proteinCalories = adjustedData.protein * 4;
  const carbCalories = adjustedData.carbs * 4;
  const fatCalories = adjustedData.fat * 9;
  const totalCalories = adjustedData.calories;

  const proteinPercent = (proteinCalories / totalCalories) * 100;
  const carbPercent = (carbCalories / totalCalories) * 100;
  const fatPercent = (fatCalories / totalCalories) * 100;

  // Flag unusual macro distributions
  if (proteinPercent > 50 || proteinPercent < 5) {
    warnings.push(`Unusual protein ratio: ${proteinPercent.toFixed(0)}%`);
    adjustedData.confidence = Math.max(40, adjustedData.confidence - 10);
  }
  if (carbPercent > 80 || carbPercent < 5) {
    warnings.push(`Unusual carb ratio: ${carbPercent.toFixed(0)}%`);
    adjustedData.confidence = Math.max(40, adjustedData.confidence - 10);
  }
  if (fatPercent > 60 || fatPercent < 5) {
    warnings.push(`Unusual fat ratio: ${fatPercent.toFixed(0)}%`);
    adjustedData.confidence = Math.max(40, adjustedData.confidence - 10);
  }

  // 3. Validate reasonable calorie ranges
  if (data.calories < 20) {
    warnings.push('Unusually low calorie count');
    adjustedData.confidence = Math.max(30, adjustedData.confidence - 20);
  }
  if (data.calories > 2000) {
    warnings.push('Unusually high calorie count for single serving');
    adjustedData.confidence = Math.max(50, adjustedData.confidence - 15);
  }

  // 4. Append warnings to reasoning if any
  if (warnings.length > 0) {
    const warningText = warnings.join('; ');
    adjustedData.reasoning = `${adjustedData.reasoning} [Validation: ${warningText}]`;
  }

  return {
    isValid: warnings.length === 0,
    adjustedData: warnings.length > 0 ? adjustedData : undefined,
    warnings,
  };
}
```

### 4. Enhanced Stage 2 Prompt Builder

Improve how Stage 1 context is passed to Stage 2:

```typescript
function buildEnhancedStageTwoPrompt(identification: IdentificationSummary): string {
  // Create a more detailed context summary
  const contextSummary = identification.items.map((item, index) => {
    return [
      `Item ${index + 1}: ${item.foodName}`,
      `  - Appearance: ${item.description}`,
      `  - Portion: ${item.portionHint}`,
      item.preparation ? `  - Preparation: ${item.preparation}` : '',
      `  - Confidence: ${item.confidence}%`,
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const imageQualityNote = identification.overallConfidence < 60 
    ? '\nNOTE: Image quality or clarity is suboptimal. Adjust confidence accordingly.'
    : '';

  const ambiguityNote = identification.notes 
    ? `\nSTAGE 1 NOTES: ${identification.notes}`
    : '';

  return [
    'Stage 2 - Estimate nutrition based on the image and Stage 1 findings.',
    '',
    '=== STAGE 1 IDENTIFICATION SUMMARY ===',
    contextSummary,
    imageQualityNote,
    ambiguityNote,
    '',
    '=== YOUR TASK ===',
    'Using the Stage 1 summary above AND the image, provide comprehensive nutritional analysis.',
    'Cross-reference the image to verify portion sizes and preparation methods identified in Stage 1.',
    'If you notice discrepancies between Stage 1 and what you see, trust your direct image analysis.',
    '',
    enhancedNutritionPrompt,
  ].join('\n');
}
```

## Data Models

No changes to existing TypeScript interfaces. The current models are well-structured:

```typescript
// Existing interfaces (no changes)
type NutritionData = { ... }
type IdentifiedFoodItem = { ... }
type IdentificationSummary = { ... }
type AnalysisResult = { ... }
```

## Error Handling

### Enhanced Error Recovery

1. **Parsing Failures**: Current implementation already handles JSON truncation well. Enhance with validation fallbacks.

2. **Low Confidence Results**: Add explicit user messaging when confidence is below thresholds:
   - <40%: "Unable to analyze clearly. Please retake with better lighting."
   - 40-60%: "Analysis uncertain. Consider verifying the results."
   - 60-75%: "Good estimate. Results should be reasonably accurate."
   - >75%: "High confidence analysis."

3. **API Errors**: Current error handling is good. Maintain existing approach.

### Validation Error Handling

```typescript
// In analyzeFoodImage function, after parseNutrition:
const nutritionData = parseNutrition(nutritionResponse);

// Add validation
const validation = validateNutritionData(nutritionData);
const finalData = validation.adjustedData || nutritionData;

// Log warnings for debugging
if (validation.warnings.length > 0) {
  console.warn('Nutrition validation warnings:', validation.warnings);
}

return {
  success: true,
  data: finalData,
  identification,
};
```

## Testing Strategy

### 1. Prompt Testing
- Test with diverse food images (single items, complex meals, different cuisines)
- Validate portion estimation accuracy against known quantities
- Test preparation method detection with various cooking styles

### 2. Validation Testing
- Test macro-to-calorie consistency checks with edge cases
- Verify adjustment logic maintains reasonable nutritional ratios
- Test confidence score adjustments

### 3. Integration Testing
- End-to-end tests with real images
- Compare results before and after improvements
- Measure accuracy improvements with test dataset

### 4. Edge Case Testing
- Blurry images
- Poor lighting
- Partially obscured foods
- Unusual food combinations
- Packaged foods with labels
- Empty plates or non-food items

## Performance Considerations

### Token Usage
- Enhanced prompts are longer but more specific
- Stage 1: ~600 tokens (current) → ~800 tokens (enhanced)
- Stage 2: ~1200 tokens (current) → ~1500 tokens (enhanced)
- Still well within Gemini 2.5 Flash limits (2048 tokens output)

### API Costs
- Remains FREE for up to 1500 requests/day
- Enhanced prompts don't significantly impact cost
- Validation is client-side, no additional API calls

### Response Time
- No significant impact on latency
- Validation adds <10ms of processing time
- Overall user experience unchanged

## Implementation Phases

### Phase 1: Prompt Enhancement
1. Replace `identificationPrompt` with `enhancedIdentificationPrompt`
2. Replace `enhancedPrompt` with `enhancedNutritionPrompt`
3. Update `buildStageTwoPrompt` to `buildEnhancedStageTwoPrompt`

### Phase 2: Validation Layer
1. Implement `validateNutritionData` function
2. Integrate validation into `analyzeFoodImage` workflow
3. Add warning logging for debugging

### Phase 3: Testing & Refinement
1. Test with diverse food images
2. Collect accuracy metrics
3. Refine prompts based on results
4. Adjust validation thresholds if needed

## Success Metrics

- **Identification Accuracy**: >90% of prominent food items correctly identified
- **Portion Estimation**: Within 20% of actual portions for standard servings
- **Nutritional Consistency**: <5% calorie-to-macro discrepancy after validation
- **Confidence Calibration**: High confidence (>75%) results are accurate >85% of the time
- **User Trust**: Reduced user-reported inaccuracies

## Future Enhancements

1. **Learning from User Corrections**: Store user adjustments to improve future estimates
2. **Regional Food Database**: Add support for regional/cultural food variations
3. **Barcode Integration**: Use package labels when visible for exact nutritional data
4. **Multi-Image Analysis**: Combine multiple angles for better portion estimation
5. **Meal Context**: Consider meal type (breakfast/lunch/dinner) for better estimates
