/**
 * Nutritional Calculation Module
 * 
 * Single source of truth for all calorie and macronutrient calculations.
 * Ensures consistency between macros and calories using the formula:
 * Calories = (Protein × 4) + (Carbs × 4) + (Fat × 9)
 * 
 * Implements error handling and user feedback (Requirements 5.4, 5.5, 6.4)
 */


export interface NutritionData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface IngredientWithNutrition {
  name: string;
  quantity: number;
  unit: string;
  nutritionPer100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  servingSize?: number; // in grams/ml
  source?: 'fatsecret' | 'usda' | 'estimated';
}

export interface CalculationResult {
  nutrition: NutritionData;
  isValid: boolean;
  adjustments: string[];
  confidence: number;
}

export interface ConsistencyValidationResult {
  isValid: boolean;
  adjustedNutrition?: NutritionData;
  warnings: string[];
}

/**
 * Calorie calculation constants
 */
const CALORIES_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

/**
 * Tolerance for macro-calorie consistency (10%)
 */
const CONSISTENCY_TOLERANCE = 0.10;

/**
 * Confidence penalties
 */
const CONFIDENCE_PENALTIES = {
  macroAdjustment: 10,
  missingData: 15,
  fallbackData: 20,
} as const;

/**
 * Calculate calories from macronutrients using the standard formula
 * This is the SINGLE SOURCE OF TRUTH for calorie calculations
 * 
 * @param protein - Protein in grams
 * @param carbs - Carbohydrates in grams
 * @param fat - Fat in grams
 * @returns Calculated calories
 */
export function calculateCaloriesFromMacros(
  protein: number,
  carbs: number,
  fat: number
): number {
  return (
    protein * CALORIES_PER_GRAM.protein +
    carbs * CALORIES_PER_GRAM.carbs +
    fat * CALORIES_PER_GRAM.fat
  );
}

/**
 * Round calories to nearest 10 for portions > 100 calories
 * Round to nearest 1 for portions <= 100 calories
 * 
 * @param calories - Raw calorie value
 * @returns Rounded calorie value
 */
export function roundCalories(calories: number): number {
  if (calories > 100) {
    return Math.round(calories / 10) * 10;
  }
  return Math.round(calories);
}

/**
 * Round macronutrients to nearest whole gram
 * 
 * @param value - Raw macro value
 * @returns Rounded macro value
 */
export function roundMacro(value: number): number {
  return Math.round(value);
}

/**
 * Validate that macronutrients align with total calories
 * If inconsistent, adjust macros proportionally to match calories
 * 
 * @param nutrition - Nutrition data to validate
 * @returns Validation result with adjusted values if needed
 */
export function validateNutritionalConsistency(
  nutrition: NutritionData
): ConsistencyValidationResult {
  const { calories, protein, carbs, fat } = nutrition;
  
  // Calculate what calories SHOULD be based on macros
  const calculatedCalories = calculateCaloriesFromMacros(protein, carbs, fat);
  
  // Calculate tolerance range
  const tolerance = calculatedCalories * CONSISTENCY_TOLERANCE;
  const difference = Math.abs(calories - calculatedCalories);
  
  // Check if within acceptable range
  if (difference <= tolerance) {
    return {
      isValid: true,
      warnings: [],
    };
  }
  
  // Inconsistent - need to adjust macros proportionally
  const warnings: string[] = [];
  warnings.push(
    `Macronutrients inconsistent with calories. ` +
    `Calculated: ${calculatedCalories.toFixed(0)} cal, ` +
    `Reported: ${calories.toFixed(0)} cal. ` +
    `Adjusting macros proportionally.`
  );
  
  // Calculate adjustment ratio
  const adjustmentRatio = calories / calculatedCalories;
  
  // Adjust each macro proportionally
  const adjustedNutrition: NutritionData = {
    calories: roundCalories(calories),
    protein: roundMacro(protein * adjustmentRatio),
    carbs: roundMacro(carbs * adjustmentRatio),
    fat: roundMacro(fat * adjustmentRatio),
  };
  
  warnings.push(
    `Adjusted macros: ` +
    `Protein ${protein.toFixed(1)}g → ${adjustedNutrition.protein}g, ` +
    `Carbs ${carbs.toFixed(1)}g → ${adjustedNutrition.carbs}g, ` +
    `Fat ${fat.toFixed(1)}g → ${adjustedNutrition.fat}g`
  );
  
  return {
    isValid: false,
    adjustedNutrition,
    warnings,
  };
}

/**
 * Calculate scaled nutrition based on quantity
 * 
 * @param nutritionPer100g - Nutrition per 100g
 * @param quantity - Actual quantity in grams
 * @returns Scaled nutrition values
 */
function scaleNutrition(
  nutritionPer100g: NutritionData,
  quantity: number
): NutritionData {
  const scale = quantity / 100;
  
  return {
    calories: nutritionPer100g.calories * scale,
    protein: nutritionPer100g.protein * scale,
    carbs: nutritionPer100g.carbs * scale,
    fat: nutritionPer100g.fat * scale,
  };
}

/**
 * Calculate total nutrition from multiple ingredients
 * This is the main function for nutritional calculations
 * 
 * @param ingredients - Array of ingredients with nutrition data
 * @param baseConfidence - Starting confidence score (0-100)
 * @returns Calculation result with final nutrition and confidence
 * @throws Error if ingredients array is empty or contains invalid data
 */
export function calculateNutrition(
  ingredients: IngredientWithNutrition[],
  baseConfidence: number = 80
): CalculationResult {
  // Validation: Check for empty ingredients
  if (!ingredients || ingredients.length === 0) {
    const error = new Error('Validation failed for ingredients: No ingredients provided for calculation');
    error.name = 'ValidationError';
    throw error;
  }

  // Validation: Check base confidence is in valid range
  if (baseConfidence < 0 || baseConfidence > 100) {
    const error = new Error('Validation failed for baseConfidence: Confidence must be between 0 and 100');
    error.name = 'ValidationError';
    throw error;
  }

  const adjustments: string[] = [];
  let confidence = baseConfidence;
  
  // Step 1: Sum macros from all ingredients
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  
  for (const ingredient of ingredients) {
    // Validation: Check ingredient has required nutrition data
    if (!ingredient.nutritionPer100g) {
      console.warn(`Missing nutrition data for ${ingredient.name}, skipping`);
      confidence -= 10;
      adjustments.push(`Missing nutrition data for ${ingredient.name}`);
      continue;
    }

    // Validation: Check for negative or invalid values
    if (ingredient.quantity <= 0) {
      console.warn(`Invalid quantity for ${ingredient.name}: ${ingredient.quantity}`);
      continue;
    }

    try {
      // Determine quantity in grams (assume servingSize is in grams if provided)
      const quantityInGrams = ingredient.servingSize 
        ? (ingredient.quantity / ingredient.servingSize) * 100
        : ingredient.quantity;
      
      // Scale nutrition based on quantity
      const scaled = scaleNutrition(ingredient.nutritionPer100g, quantityInGrams);
      
      totalProtein += scaled.protein;
      totalCarbs += scaled.carbs;
      totalFat += scaled.fat;
      
      // Apply confidence penalties for data quality
      if (ingredient.source === 'estimated') {
        confidence -= CONFIDENCE_PENALTIES.missingData;
        adjustments.push(`Used estimated data for ${ingredient.name}`);
      } else if (ingredient.source === 'usda') {
        confidence -= CONFIDENCE_PENALTIES.fallbackData;
        adjustments.push(`Used USDA fallback data for ${ingredient.name}`);
      }
    } catch (error) {
      console.error(`Error calculating nutrition for ${ingredient.name}:`, error);
      confidence -= 15;
      adjustments.push(`Calculation error for ${ingredient.name}`);
    }
  }
  
  // Validation: Check that we have some nutritional data
  if (totalProtein === 0 && totalCarbs === 0 && totalFat === 0) {
    const error = new Error('Validation failed for nutrition: No valid nutritional data could be calculated');
    error.name = 'ValidationError';
    throw error;
  }

  // Step 2: Calculate calories from macros (SINGLE SOURCE OF TRUTH)
  const calculatedCalories = calculateCaloriesFromMacros(
    totalProtein,
    totalCarbs,
    totalFat
  );
  
  // Step 3: Create initial nutrition data
  let nutrition: NutritionData = {
    calories: calculatedCalories,
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFat,
  };
  
  // Step 4: Validate consistency
  const validation = validateNutritionalConsistency(nutrition);
  
  if (!validation.isValid && validation.adjustedNutrition) {
    // Use adjusted values
    nutrition = validation.adjustedNutrition;
    confidence -= CONFIDENCE_PENALTIES.macroAdjustment;
    adjustments.push(...validation.warnings);
  }
  
  // Step 5: Round values
  nutrition = {
    calories: roundCalories(nutrition.calories),
    protein: roundMacro(nutrition.protein),
    carbs: roundMacro(nutrition.carbs),
    fat: roundMacro(nutrition.fat),
  };
  
  // Ensure confidence stays within bounds
  confidence = Math.max(0, Math.min(100, confidence));
  
  return {
    nutrition,
    isValid: validation.isValid,
    adjustments,
    confidence,
  };
}

/**
 * Recalculate nutrition when macros are known but calories need to be derived
 * Useful when you have macro data but want to ensure calorie consistency
 * 
 * @param protein - Protein in grams
 * @param carbs - Carbohydrates in grams
 * @param fat - Fat in grams
 * @returns Nutrition data with calculated calories
 */
export function calculateNutritionFromMacros(
  protein: number,
  carbs: number,
  fat: number
): NutritionData {
  const calories = calculateCaloriesFromMacros(protein, carbs, fat);
  
  return {
    calories: roundCalories(calories),
    protein: roundMacro(protein),
    carbs: roundMacro(carbs),
    fat: roundMacro(fat),
  };
}

/**
 * Validate and fix nutrition data if needed
 * Useful for cleaning up nutrition data from external sources
 * 
 * @param nutrition - Raw nutrition data
 * @returns Validated and potentially adjusted nutrition data
 */
export function validateAndFixNutrition(
  nutrition: NutritionData
): { nutrition: NutritionData; wasAdjusted: boolean; warnings: string[] } {
  const validation = validateNutritionalConsistency(nutrition);
  
  if (validation.isValid) {
    // Just round the values
    return {
      nutrition: {
        calories: roundCalories(nutrition.calories),
        protein: roundMacro(nutrition.protein),
        carbs: roundMacro(nutrition.carbs),
        fat: roundMacro(nutrition.fat),
      },
      wasAdjusted: false,
      warnings: [],
    };
  }
  
  // Use adjusted values
  return {
    nutrition: validation.adjustedNutrition!,
    wasAdjusted: true,
    warnings: validation.warnings,
  };
}
