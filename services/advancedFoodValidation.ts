/**
 * Advanced Food Analysis Validation Module
 * 
 * Provides comprehensive validation logic for nutritional consistency,
 * confidence adjustment based on fallback usage, and calorie-to-macro ratio checks.
 * 
 * Requirements: 4.1, 5.5
 */

import type {
    AdvancedAnalysisResult,
    EnrichedIngredient,
} from '@/lib/advanced-food-analysis-types';

// ============================================================================
// Validation Configuration
// ============================================================================

/**
 * Validation thresholds and configuration
 */
const VALIDATION_CONFIG = {
  // Calorie-to-macro discrepancy threshold (15%)
  MAX_CALORIE_DISCREPANCY: 0.15,
  
  // Confidence adjustments
  HIGH_DISCREPANCY_PENALTY: 15,
  GENERIC_ESTIMATE_PENALTY_PER_INGREDIENT: 5,
  LOW_CONFIDENCE_INGREDIENT_PENALTY: 3,
  
  // Ingredient confidence thresholds
  LOW_INGREDIENT_CONFIDENCE_THRESHOLD: 50,
  
};

/**
 * Validation result with warnings and adjustments
 */
export type ValidationResult = {
  isValid: boolean;
  adjustedConfidence: number;
  warnings: string[];
  errors: string[];
  metrics: {
    calorieDiscrepancy: number;
    fallbackCount: number;
    lowConfidenceCount: number;
    proteinRatio: number;
    carbsRatio: number;
    fatRatio: number;
  };
};

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validates advanced analysis result for nutritional consistency
 * Checks calorie-to-macro ratios and adjusts confidence based on fallback usage
 * 
 * Requirements: 4.1, 5.5
 * 
 * @param result - Analysis result to validate
 * @returns Validated result with adjusted confidence if needed
 */
export function validateAdvancedAnalysis(
  result: AdvancedAnalysisResult
): AdvancedAnalysisResult {
  // Skip validation if analysis failed
  if (!result.success || !result.data) {
    return result;
  }

  const { totalNutrition, ingredients } = result.data;
  const originalConfidence = result.data.confidence;

  // Perform comprehensive validation
  const validation = performValidation(totalNutrition, ingredients, originalConfidence);

  // Log validation results
  if (validation.warnings.length > 0) {
    console.warn('Validation warnings:', validation.warnings);
  }

  if (validation.errors.length > 0) {
    console.error('Validation errors:', validation.errors);
  }

  // Log validation metrics
  console.log('Validation metrics:', {
    calorieDiscrepancy: `${(validation.metrics.calorieDiscrepancy * 100).toFixed(1)}%`,
    fallbackCount: validation.metrics.fallbackCount,
    lowConfidenceCount: validation.metrics.lowConfidenceCount,
    originalConfidence,
    adjustedConfidence: validation.adjustedConfidence,
  });

  // Return result with adjusted confidence
  const mergedWarnings = Array.from(
    new Set([...(result.data.warnings ?? []), ...validation.warnings])
  );

  return {
    ...result,
    success: validation.isValid,
    error: validation.isValid ? result.error : validation.errors.join('; '),
    data: {
      ...result.data,
      confidence: validation.adjustedConfidence,
      warnings: mergedWarnings,
    },
  };
}

// ============================================================================
// Validation Logic
// ============================================================================

/**
 * Performs comprehensive validation checks on nutritional data
 * 
 * @param totalNutrition - Total nutritional values
 * @param ingredients - Array of enriched ingredients
 * @param originalConfidence - Original confidence score
 * @returns Validation result with adjusted confidence and warnings
 */
function performValidation(
  totalNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  },
  ingredients: EnrichedIngredient[],
  originalConfidence: number
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const calorieWeight = ingredients.reduce((sum, ingredient) => sum + Math.max(0, ingredient.scaledNutrition.calories), 0);
  const ingredientConfidence = calorieWeight > 0
    ? ingredients.reduce((sum, ingredient) => sum + ingredient.confidence * Math.max(0, ingredient.scaledNutrition.calories), 0) / calorieWeight
    : originalConfidence;
  let adjustedConfidence = Math.max(0, Math.min(originalConfidence, ingredientConfidence));

  // ========================================================================
  // 1. Calorie-to-Macro Ratio Validation
  // ========================================================================
  const calorieValidation = validateCalorieToMacroRatio(totalNutrition);
  
  if (calorieValidation.discrepancy > VALIDATION_CONFIG.MAX_CALORIE_DISCREPANCY) {
    warnings.push(
      `High calorie discrepancy: ${(calorieValidation.discrepancy * 100).toFixed(1)}% ` +
      `(calculated: ${calorieValidation.calculatedCalories} cal, reported: ${totalNutrition.calories} cal)`
    );
    
    // Apply confidence penalty for high discrepancy
    adjustedConfidence = Math.max(
      0,
      adjustedConfidence - VALIDATION_CONFIG.HIGH_DISCREPANCY_PENALTY
    );
  }

  // ========================================================================
  // 2. Generic Estimate Usage Check
  // ========================================================================
  const fallbackCount = countGenericEstimates(ingredients);
  
  if (fallbackCount > 0) {
    warnings.push(
      `${fallbackCount} ingredient(s) had no nutrition reference and used a generic estimate. Review before saving.`
    );
    
    // Apply confidence penalty for each fallback
    const fallbackPenalty = fallbackCount * VALIDATION_CONFIG.GENERIC_ESTIMATE_PENALTY_PER_INGREDIENT;
    adjustedConfidence = Math.max(
      0,
      adjustedConfidence - fallbackPenalty
    );
  }

  // ========================================================================
  // 3. Low Ingredient Confidence Check
  // ========================================================================
  const lowConfidenceIngredients = countLowConfidenceIngredients(ingredients);
  
  if (lowConfidenceIngredients > 0) {
    warnings.push(
      `${lowConfidenceIngredients} ingredient(s) have low confidence (<${VALIDATION_CONFIG.LOW_INGREDIENT_CONFIDENCE_THRESHOLD}%)`
    );
    
    // Apply confidence penalty for low confidence ingredients
    const lowConfidencePenalty = lowConfidenceIngredients * VALIDATION_CONFIG.LOW_CONFIDENCE_INGREDIENT_PENALTY;
    adjustedConfidence = Math.max(
      0,
      adjustedConfidence - lowConfidencePenalty
    );
  }

  // ========================================================================
  // 4. Macro Ratio Validation (Optional - for informational purposes)
  // ========================================================================
  const macroRatios = calculateMacroRatios(totalNutrition);
  
  // Meal composition is not an accuracy test: a valid egg or drink does not
  // need to meet whole-diet macro ratios. Keep ratios as diagnostics only.

  // ========================================================================
  // 5. Zero Nutrition Check
  // ========================================================================
  if (totalNutrition.calories === 0) {
    errors.push('Total calories is zero - invalid nutritional data');
  }

  if (totalNutrition.protein === 0 && totalNutrition.carbs === 0 && totalNutrition.fat === 0) {
    errors.push('All macronutrients are zero - invalid nutritional data');
  }

  if (!validateNutritionValues(totalNutrition) || ingredients.some(ingredient => !validateNutritionValues(ingredient.scaledNutrition))) {
    errors.push('Nutrition contains invalid or unsupported values. Confirm ingredients and portions.');
  }
  if (ingredients.some(ingredient => ingredient.source === 'estimated')) {
    warnings.push('Nutrition uses approximate reference values. Recipes and preparation can change the actual calories and macros.');
  }

  // Determine if validation passed
  const isValid = errors.length === 0;

  return {
    isValid,
    adjustedConfidence,
    warnings,
    errors,
    metrics: {
      calorieDiscrepancy: calorieValidation.discrepancy,
      fallbackCount,
      lowConfidenceCount: lowConfidenceIngredients,
      proteinRatio: macroRatios.protein,
      carbsRatio: macroRatios.carbs,
      fatRatio: macroRatios.fat,
    },
  };
}

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Validates calorie-to-macro ratio consistency
 * Formula: (protein * 4) + (carbs * 4) + (fat * 9) should equal total calories
 * 
 * @param nutrition - Nutritional values to validate
 * @returns Validation result with calculated calories and discrepancy
 */
function validateCalorieToMacroRatio(nutrition: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}): {
  calculatedCalories: number;
  discrepancy: number;
  isValid: boolean;
} {
  // Calculate calories from macros
  const calculatedCalories =
    (nutrition.protein * 4) +
    (nutrition.carbs * 4) +
    (nutrition.fat * 9);

  // Calculate discrepancy as percentage
  const discrepancy = nutrition.calories > 0
    ? Math.abs(calculatedCalories - nutrition.calories) / nutrition.calories
    : 1; // 100% discrepancy if calories is 0

  const isValid = discrepancy <= VALIDATION_CONFIG.MAX_CALORIE_DISCREPANCY;

  return {
    calculatedCalories: Math.round(calculatedCalories),
    discrepancy,
    isValid,
  };
}

/**
 * Counts ingredients with no matching nutrition reference
 * 
 * @param ingredients - Array of enriched ingredients
 * @returns Count of ingredients using a generic estimate
 */
function countGenericEstimates(ingredients: EnrichedIngredient[]): number {
  return ingredients.filter(
    ing => ing.source === 'generic'
  ).length;
}

/**
 * Counts ingredients with low confidence scores
 * 
 * @param ingredients - Array of enriched ingredients
 * @returns Count of low confidence ingredients
 */
function countLowConfidenceIngredients(ingredients: EnrichedIngredient[]): number {
  return ingredients.filter(
    ing => ing.confidence < VALIDATION_CONFIG.LOW_INGREDIENT_CONFIDENCE_THRESHOLD
  ).length;
}

/**
 * Calculates macro ratios as percentage of total calories
 * 
 * @param nutrition - Nutritional values
 * @returns Macro ratios (0-1 scale)
 */
function calculateMacroRatios(nutrition: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}): {
  protein: number;
  carbs: number;
  fat: number;
} {
  if (nutrition.calories === 0) {
    return { protein: 0, carbs: 0, fat: 0 };
  }

  return {
    protein: (nutrition.protein * 4) / nutrition.calories,
    carbs: (nutrition.carbs * 4) / nutrition.calories,
    fat: (nutrition.fat * 9) / nutrition.calories,
  };
}

// ============================================================================
// Exported Validation Utilities
// ============================================================================

/**
 * Validates that nutritional values are non-negative and reasonable
 * 
 * @param nutrition - Nutritional values to validate
 * @returns true if valid, false otherwise
 */
export function validateNutritionValues(nutrition: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}): boolean {
  return (
    typeof nutrition.calories === 'number' &&
    nutrition.calories >= 0 &&
    nutrition.calories < 10000 && // Reasonable upper limit
    typeof nutrition.protein === 'number' &&
    nutrition.protein >= 0 &&
    nutrition.protein < 1000 &&
    typeof nutrition.carbs === 'number' &&
    nutrition.carbs >= 0 &&
    nutrition.carbs < 1000 &&
    typeof nutrition.fat === 'number' &&
    nutrition.fat >= 0 &&
    nutrition.fat < 1000
  );
}

/**
 * Validates that confidence score is within valid range (0-100)
 * 
 * @param confidence - Confidence score to validate
 * @returns true if valid, false otherwise
 */
export function validateConfidenceScore(confidence: number): boolean {
  return (
    typeof confidence === 'number' &&
    confidence >= 0 &&
    confidence <= 100 &&
    isFinite(confidence)
  );
}

/**
 * Gets validation configuration for testing or customization
 * 
 * @returns Current validation configuration
 */
export function getValidationConfig() {
  return { ...VALIDATION_CONFIG };
}
