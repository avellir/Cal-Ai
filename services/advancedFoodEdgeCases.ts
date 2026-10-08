import { isBeverageName, normalizeFoodName } from '@/services/foodNames';

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

  // A confident region is not necessarily one ingredient (toast, dessert,
  // mixed bowls). Only explicit whole-food captions qualify for this shortcut.
  const description = normalizeFoodName(region.description);
  if (/^(?:(?:a|an|one|single|whole|fresh|raw|ripe|large|small|medium) )*(?:apple|banana|orange|egg|avocado|tomato|potato|carrot|cucumber)$/.test(description)) {
    return {
      type: 'single_ingredient', confidence: 85,
      reason: 'Whole ingredient detected: ' + region.description,
      metadata: { ingredientName: region.description },
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
  // Only a visible nutrition panel warrants OCR. Generic containers and uncertainty
  // notes (for example "cannot measure oil") do not establish that a label exists.
  const region = segmentation.regions.find(region =>
    /\bnutrition(?:al)? (?:facts|information|label|panel)\b/i.test(region.description)
  );
  if (region) {
    return {
      type: 'packaged_food_label',
      confidence: 85,
      reason: `Nutrition panel detected: ${region.description}`,
      metadata: { description: region.description },
    };
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

  const beverageRegions: FoodRegion[] = [];

  for (const region of segmentation.regions) {
    const descriptionLower = region.description.toLowerCase();
    const hasBeverageIndicator = isBeverageName(descriptionLower);

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
    const isBeverage = isBeverageName(ingredient.name);

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
 * Uses Azure to read and parse the nutrition facts panel
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
    const { runPhotoAnalysis } = await import('./photoAnalysis');
    const response = await runPhotoAnalysis({ mode: 'label', base64Image });

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
          method: 'azure_ocr',
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
