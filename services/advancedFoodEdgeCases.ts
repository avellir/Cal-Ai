/**
 * Edge Case Detection and Handling for Advanced Food Analysis
 * 
 * This module handles special cases that can bypass or modify the standard
 * multi-stage analysis pipeline for improved accuracy and performance.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import type {
  AdvancedAnalysisResult,
  FoodRegion,
  Ingredient,
  SegmentationResult,
} from '@/lib/advanced-food-analysis-types';

// ============================================================================
// Edge Case Detection Types
// ============================================================================

export type EdgeCaseType =
  | 'single_ingredient'
  | 'packaged_food_label'
  | 'beverage'
  | 'complex_mixed_dish'
  | 'no_food'
  | 'none';

export type EdgeCaseDetectionResult = {
  type: EdgeCaseType;
  confidence: number;
  reason: string;
  metadata?: Record<string, unknown>;
};

// ============================================================================
// Requirement 10.5: No-Food Detection
// ============================================================================

/**
 * Detects if the image contains no food items
 * Returns clear error when no food is detected
 * 
 * Requirement 10.5: Return clear error when no food is detected
 * 
 * @param segmentation - Segmentation result from Stage 1
 * @returns EdgeCaseDetectionResult indicating if no food was detected
 */
export function detectNoFood(segmentation: SegmentationResult): EdgeCaseDetectionResult | null {
  // Check if no regions were detected
  if (!segmentation.regions || segmentation.regions.length === 0) {
    return {
      type: 'no_food',
      confidence: 95,
      reason: 'No food regions detected in the image',
    };
  }

  // Check if overall confidence is extremely low
  if (segmentation.overallConfidence < 20) {
    return {
      type: 'no_food',
      confidence: 85,
      reason: 'Very low confidence in food detection',
    };
  }

  // Check if notes indicate no food
  if (segmentation.notes) {
    const noFoodIndicators = [
      'no food',
      'not food',
      'empty plate',
      'no visible food',
      'cannot detect food',
    ];

    const notesLower = segmentation.notes.toLowerCase();
    for (const indicator of noFoodIndicators) {
      if (notesLower.includes(indicator)) {
        return {
          type: 'no_food',
          confidence: 90,
          reason: `Segmentation notes indicate no food: ${segmentation.notes}`,
        };
      }
    }
  }

  return null;
}

/**
 * Generates user-friendly error message for no-food detection
 * Suggests retaking photo with better view
 * 
 * Requirement 10.5: Suggest retaking photo with better view
 */
export function getNoFoodErrorMessage(): string {
  return 'No food detected in the image. Please try again with:\n' +
    '• A clearer view of the food\n' +
    '• Better lighting\n' +
    '• The food centered in the frame\n' +
    '• Less background clutter';
}

// ============================================================================
// Requirement 10.1: Single Ingredient Detection
// ============================================================================

/**
 * Detects if the image contains a single whole ingredient
 * This allows skipping decomposition and querying FatSecret directly
 * 
 * Requirement 10.1: Detect when image contains single whole ingredient
 * 
 * @param segmentation - Segmentation result from Stage 1
 * @returns EdgeCaseDetectionResult if single ingredient detected, null otherwise
 */
export function detectSingleIngredient(segmentation: SegmentationResult): EdgeCaseDetectionResult | null {
  // Must have exactly one region
  if (segmentation.regions.length !== 1) {
    return null;
  }

  const region = segmentation.regions[0];

  // Check if description indicates a single whole ingredient
  const singleIngredientIndicators = [
    'whole',
    'single',
    'one',
    'apple',
    'banana',
    'orange',
    'egg',
    'avocado',
    'tomato',
    'potato',
    'carrot',
    'cucumber',
    'piece of fruit',
    'whole fruit',
    'single vegetable',
  ];

  const descriptionLower = region.description.toLowerCase();
  const hasSingleIndicator = singleIngredientIndicators.some(indicator =>
    descriptionLower.includes(indicator)
  );

  // Check if description does NOT indicate a prepared dish
  const preparedDishIndicators = [
    'mixed',
    'cooked',
    'prepared',
    'dish',
    'meal',
    'plate',
    'bowl',
    'salad',
    'stir-fry',
    'casserole',
    'stew',
    'soup',
  ];

  const hasPreparedIndicator = preparedDishIndicators.some(indicator =>
    descriptionLower.includes(indicator)
  );

  // Single ingredient if:
  // 1. Has single ingredient indicator, OR
  // 2. High confidence (>80) and no prepared dish indicators
  if (hasSingleIndicator || (region.confidence > 80 && !hasPreparedIndicator)) {
    return {
      type: 'single_ingredient',
      confidence: hasSingleIndicator ? 85 : 70,
      reason: `Single whole ingredient detected: ${region.description}`,
      metadata: {
        ingredientName: region.description,
      },
    };
  }

  return null;
}

/**
 * Extracts ingredient name from single ingredient detection
 * Cleans up the description to get a searchable ingredient name
 */
export function extractSingleIngredientName(region: FoodRegion): string {
  let name = region.description.toLowerCase();

  // Remove common descriptive words
  const wordsToRemove = [
    'whole',
    'single',
    'one',
    'large',
    'small',
    'medium',
    'fresh',
    'ripe',
    'raw',
    'the',
    'a',
    'an',
  ];

  for (const word of wordsToRemove) {
    name = name.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
  }

  // Clean up extra spaces
  name = name.trim().replace(/\s+/g, ' ');

  return name || region.description;
}

// ============================================================================
// Requirement 10.2: Packaged Food Label Detection
// ============================================================================

/**
 * Detects if the image contains a visible nutrition label
 * This allows extracting nutritional information directly from the label
 * 
 * Requirement 10.2: Detect visible nutrition labels in images
 * 
 * @param segmentation - Segmentation result from Stage 1
 * @returns EdgeCaseDetectionResult if nutrition label detected, null otherwise
 */
export function detectPackagedFoodLabel(segmentation: SegmentationResult): EdgeCaseDetectionResult | null {
  // Check if any region description mentions a label or package
  const labelIndicators = [
    'label',
    'nutrition facts',
    'nutrition label',
    'package',
    'packaged',
    'box',
    'container',
    'wrapper',
    'can',
    'bottle',
    'barcode',
  ];

  for (const region of segmentation.regions) {
    const descriptionLower = region.description.toLowerCase();
    const hasLabelIndicator = labelIndicators.some(indicator =>
      descriptionLower.includes(indicator)
    );

    if (hasLabelIndicator) {
      return {
        type: 'packaged_food_label',
        confidence: 75,
        reason: `Nutrition label or package detected: ${region.description}`,
        metadata: {
          description: region.description,
        },
      };
    }
  }

  // Check segmentation notes for label mentions
  if (segmentation.notes) {
    const notesLower = segmentation.notes.toLowerCase();
    const hasLabelIndicator = labelIndicators.some(indicator =>
      notesLower.includes(indicator)
    );

    if (hasLabelIndicator) {
      return {
        type: 'packaged_food_label',
        confidence: 70,
        reason: `Nutrition label mentioned in notes: ${segmentation.notes}`,
      };
    }
  }

  return null;
}

// ============================================================================
// Requirement 10.3: Beverage Detection
// ============================================================================

/**
 * Detects if the image contains beverages or liquids
 * This allows using volume estimation instead of weight
 * 
 * Requirement 10.3: Add volume estimation for beverages
 * 
 * @param segmentation - Segmentation result from Stage 1
 * @returns EdgeCaseDetectionResult if beverage detected, null otherwise
 */
export function detectBeverage(segmentation: SegmentationResult): EdgeCaseDetectionResult | null {
  const beverageIndicators = [
    'drink',
    'beverage',
    'juice',
    'soda',
    'water',
    'coffee',
    'tea',
    'milk',
    'smoothie',
    'shake',
    'beer',
    'wine',
    'cocktail',
    'glass',
    'cup',
    'mug',
    'bottle',
    'can',
  ];

  const beverageRegions: FoodRegion[] = [];

  for (const region of segmentation.regions) {
    const descriptionLower = region.description.toLowerCase();
    const hasBeverageIndicator = beverageIndicators.some(indicator =>
      descriptionLower.includes(indicator)
    );

    if (hasBeverageIndicator) {
      beverageRegions.push(region);
    }
  }

  // If all regions are beverages, treat as beverage edge case
  if (beverageRegions.length > 0 && beverageRegions.length === segmentation.regions.length) {
    return {
      type: 'beverage',
      confidence: 80,
      reason: `All regions are beverages: ${beverageRegions.map(r => r.description).join(', ')}`,
      metadata: {
        beverageRegions: beverageRegions.map(r => r.description),
      },
    };
  }

  // If some regions are beverages, note it but don't treat as edge case
  if (beverageRegions.length > 0) {
    return {
      type: 'beverage',
      confidence: 60,
      reason: `Some regions contain beverages: ${beverageRegions.map(r => r.description).join(', ')}`,
      metadata: {
        beverageRegions: beverageRegions.map(r => r.description),
        hasSolidFood: true,
      },
    };
  }

  return null;
}

/**
 * Adjusts ingredient units for beverages to use volume (ml/fl oz) instead of weight
 * 
 * Requirement 10.3: Convert to milliliters or fluid ounces
 */
export function adjustBeverageUnits(ingredients: Ingredient[]): Ingredient[] {
  return ingredients.map(ingredient => {
    const nameLower = ingredient.name.toLowerCase();

    // Check if this is a beverage
    const beverageKeywords = [
      'juice',
      'soda',
      'water',
      'coffee',
      'tea',
      'milk',
      'smoothie',
      'shake',
      'beer',
      'wine',
      'cocktail',
    ];

    const isBeverage = beverageKeywords.some(keyword => nameLower.includes(keyword));

    if (isBeverage && ingredient.unit === 'g') {
      // Convert grams to milliliters (1:1 for most beverages)
      return {
        ...ingredient,
        unit: 'ml',
      };
    }

    return ingredient;
  });
}

// ============================================================================
// Requirement 10.4: Complex Mixed Dish Detection
// ============================================================================

/**
 * Detects if the image contains complex mixed dishes like casseroles or stews
 * This limits ingredient identification to top 5 most prominent ingredients
 * 
 * Requirement 10.4: Identify prominent ingredients in casseroles/stews
 * 
 * @param segmentation - Segmentation result from Stage 1
 * @returns EdgeCaseDetectionResult if complex mixed dish detected, null otherwise
 */
export function detectComplexMixedDish(segmentation: SegmentationResult): EdgeCaseDetectionResult | null {
  const complexDishIndicators = [
    'casserole',
    'stew',
    'soup',
    'curry',
    'mixed',
    'combined',
    'layered',
    'baked dish',
    'pot',
    'bowl of mixed',
    'everything mixed',
  ];

  for (const region of segmentation.regions) {
    const descriptionLower = region.description.toLowerCase();
    const hasComplexIndicator = complexDishIndicators.some(indicator =>
      descriptionLower.includes(indicator)
    );

    if (hasComplexIndicator) {
      return {
        type: 'complex_mixed_dish',
        confidence: 75,
        reason: `Complex mixed dish detected: ${region.description}`,
        metadata: {
          description: region.description,
        },
      };
    }
  }

  // Check if confidence is low and notes mention complexity
  if (segmentation.overallConfidence < 60 && segmentation.notes) {
    const notesLower = segmentation.notes.toLowerCase();
    const complexityIndicators = [
      'complex',
      'mixed',
      'unclear',
      'difficult to separate',
      'many ingredients',
    ];

    const hasComplexityIndicator = complexityIndicators.some(indicator =>
      notesLower.includes(indicator)
    );

    if (hasComplexityIndicator) {
      return {
        type: 'complex_mixed_dish',
        confidence: 65,
        reason: `Complex composition indicated in notes: ${segmentation.notes}`,
      };
    }
  }

  return null;
}

/**
 * Limits ingredients to top 5 most prominent for complex mixed dishes
 * Sorts by confidence and quantity, keeping only the most significant ingredients
 * 
 * Requirement 10.4: Limit to top 5 ingredients when composition is unclear
 */
export function limitToTopIngredients(ingredients: Ingredient[], maxCount: number = 5): Ingredient[] {
  if (ingredients.length <= maxCount) {
    return ingredients;
  }

  // Sort by confidence (descending) and quantity (descending)
  const sorted = [...ingredients].sort((a, b) => {
    // First sort by confidence
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }

    // Then by quantity (convert to grams for comparison)
    const aGrams = convertToGramsForComparison(a.quantity, a.unit);
    const bGrams = convertToGramsForComparison(b.quantity, b.unit);
    return bGrams - aGrams;
  });

  return sorted.slice(0, maxCount);
}

/**
 * Helper function to convert quantities to grams for comparison
 */
function convertToGramsForComparison(quantity: number, unit: string): number {
  const conversions: Record<string, number> = {
    'g': 1,
    'ml': 1,
    'oz': 28.35,
    'cup': 240,
    'tbsp': 15,
    'tsp': 5,
    'piece': 100,
  };

  return quantity * (conversions[unit] || 1);
}

// ============================================================================
// Main Edge Case Detection Function
// ============================================================================

/**
 * Detects all applicable edge cases for the given segmentation result
 * Returns the most relevant edge case with highest confidence
 * 
 * @param segmentation - Segmentation result from Stage 1
 * @returns EdgeCaseDetectionResult for the most relevant edge case, or null if none
 */
export function detectEdgeCases(segmentation: SegmentationResult): EdgeCaseDetectionResult | null {
  const detections: EdgeCaseDetectionResult[] = [];

  // Check for no food (highest priority)
  const noFood = detectNoFood(segmentation);
  if (noFood) {
    detections.push(noFood);
  }

  // Check for packaged food label
  const packagedLabel = detectPackagedFoodLabel(segmentation);
  if (packagedLabel) {
    detections.push(packagedLabel);
  }

  // Check for single ingredient
  const singleIngredient = detectSingleIngredient(segmentation);
  if (singleIngredient) {
    detections.push(singleIngredient);
  }

  // Check for beverage
  const beverage = detectBeverage(segmentation);
  if (beverage) {
    detections.push(beverage);
  }

  // Check for complex mixed dish
  const complexDish = detectComplexMixedDish(segmentation);
  if (complexDish) {
    detections.push(complexDish);
  }

  // Return the detection with highest confidence
  if (detections.length === 0) {
    return null;
  }

  return detections.reduce((highest, current) =>
    current.confidence > highest.confidence ? current : highest
  );
}


// ============================================================================
// Packaged Food Label Extraction
// ============================================================================

/**
 * Extracts nutritional information from a visible nutrition label
 * Uses Gemini to read and parse the nutrition facts panel
 * 
 * Requirement 10.2: Extract nutritional information from labels
 * 
 * @param base64Image - Base64 encoded image data
 * @returns AdvancedAnalysisResult with extracted nutrition data
 */
export async function extractNutritionFromLabel(
  base64Image: string
): Promise<AdvancedAnalysisResult> {
  const startTime = Date.now();

  try {
    // Import Gemini utilities
    const { runGeminiRequest, buildParts } = await import('./geminiService');

    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Google Gemini API key not configured');
    }

    const model =
      process.env.EXPO_PUBLIC_GOOGLE_GEMINI_MODEL ||
      process.env.GOOGLE_GEMINI_MODEL ||
      'gemini-2.5-flash-lite';  // Updated to 2.5-flash-lite (released July 2025)

    const prompt = `Extract nutritional information from the visible nutrition label in this image.

EXTRACTION INSTRUCTIONS:
1. Locate the "Nutrition Facts" or "Nutrition Information" panel
2. Extract the following values per serving:
   - Serving size (with unit)
   - Calories
   - Total Fat (grams)
   - Total Carbohydrates (grams)
   - Protein (grams)
3. If multiple servings are shown, extract data for ONE serving
4. If the label is partially obscured or unclear, note which values are uncertain

IMPORTANT:
- Only extract values that are clearly visible
- Do not estimate or guess values
- If a value is not visible, set it to null
- Include the product name if visible

Return JSON with extracted nutrition data.`;

    const schema = {
      type: 'object',
      properties: {
        productName: {
          type: 'string',
          description: 'Product name if visible on package',
        },
        servingSize: {
          type: 'string',
          description: 'Serving size with unit (e.g., "1 cup (240ml)", "2 pieces (50g)")',
        },
        calories: {
          type: 'number',
          description: 'Calories per serving',
          minimum: 0,
        },
        fat: {
          type: 'number',
          description: 'Total fat in grams per serving',
          minimum: 0,
        },
        carbs: {
          type: 'number',
          description: 'Total carbohydrates in grams per serving',
          minimum: 0,
        },
        protein: {
          type: 'number',
          description: 'Protein in grams per serving',
          minimum: 0,
        },
        confidence: {
          type: 'number',
          description: 'Confidence in extraction accuracy (0-100)',
          minimum: 0,
          maximum: 100,
        },
        notes: {
          type: 'string',
          description: 'Any issues with label visibility or extraction',
        },
      },
      required: ['servingSize', 'calories', 'fat', 'carbs', 'protein', 'confidence'],
    };

    const response = await runGeminiRequest({
      apiKey,
      model,
      prompt,
      base64Image,
      temperature: 0.1, // Low temperature for accurate extraction
      maxOutputTokens: 500,
      responseSchema: schema,
    });

    const extracted = JSON.parse(response);

    // Validate extracted data
    if (
      typeof extracted.calories !== 'number' ||
      typeof extracted.fat !== 'number' ||
      typeof extracted.carbs !== 'number' ||
      typeof extracted.protein !== 'number'
    ) {
      throw new Error('Invalid nutrition data extracted from label');
    }

    // Create result in AdvancedAnalysisResult format
    const processingTimeMs = Date.now() - startTime;

    // Create a single enriched ingredient representing the packaged food
    const enrichedIngredient: import('@/lib/advanced-food-analysis-types').EnrichedIngredient = {
      name: extracted.productName || 'Packaged food',
      quantity: 1,
      unit: 'serving',
      confidence: extracted.confidence,
      nutrition: {
        foodId: 'label_extracted',
        foodName: extracted.productName || 'Packaged food',
        calories: extracted.calories,
        protein: extracted.protein,
        carbs: extracted.carbs,
        fat: extracted.fat,
        servingSize: extracted.servingSize,
        servingUnit: 'serving',
      },
      scaledNutrition: {
        calories: extracted.calories,
        protein: extracted.protein,
        carbs: extracted.carbs,
        fat: extracted.fat,
      },
    };

    return {
      success: true,
      data: {
        totalNutrition: {
          calories: extracted.calories,
          protein: extracted.protein,
          carbs: extracted.carbs,
          fat: extracted.fat,
        },
        ingredients: [enrichedIngredient],
        // Create a synthetic region for the label
        regions: [{
          description: "Nutrition Label",
          confidence: extracted.confidence,
          boundingBox: { x: 0, y: 0, width: 100, height: 100 }
        }],
        confidence: extracted.confidence,
      },
      metadata: {
        processingTimeMs,
        stagesCompleted: ['label_extraction'],
        labelExtraction: {
          method: 'gemini_ocr',
          notes: extracted.notes,
        },
      },
    };
  } catch (error) {
    console.error('Failed to extract nutrition from label:', error);

    // Return error result
    return {
      success: false,
      error: 'Could not read the nutrition label. Please try:\n' +
        '• Taking a clearer photo of the label\n' +
        '• Ensuring the label is well-lit and in focus\n' +
        '• Photographing the label straight-on (not at an angle)',
      metadata: {
        processingTimeMs: Date.now() - startTime,
        stagesCompleted: ['label_extraction'],
      },
    };
  }
}
