/**
 * Advanced Food Analysis Type Definitions
 * 
 * Multi-stage food analysis system types for:
 * - Image segmentation
 * - Ingredient decomposition
 * - Nutritional lookup
 * - Aggregation
 */

// ============================================================================
// Stage 1: Image Segmentation Types
// ============================================================================

/**
 * Food region identified in segmentation stage
 */
export type FoodRegion = {
  regionId: string;
  description: string; // e.g., "main protein on left side of plate"
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
};

/**
 * Result from Stage 1: Image Segmentation
 */
export type SegmentationResult = {
  regions: FoodRegion[];
  overallConfidence: number;
  notes?: string;
};

// ============================================================================
// Stage 2: Ingredient Decomposition Types
// ============================================================================

/**
 * Individual ingredient with quantity and metadata
 */
export type Ingredient = {
  name: string; // e.g., "chicken breast"
  quantity: number; // numeric value
  unit: string; // e.g., "g", "ml", "oz"
  preparation?: string; // e.g., "grilled", "fried"
  regionId: string; // which food region this belongs to
  confidence: number;
};

/**
 * Result from Stage 2: Ingredient Decomposition
 */
export type DecompositionResult = {
  ingredients: Ingredient[];
  dishName?: string; // e.g., "chicken stir-fry"
  confidence: number;
};

// ============================================================================
// Stage 3: Nutritional Lookup Types
// ============================================================================

/**
 * Nutritional data from FatSecret API
 */
export type FatSecretNutrition = {
  foodId: string;
  foodName: string;
  calories: number;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
  servingSize: string;
  servingUnit: string;
};

/**
 * Ingredient enriched with nutritional data
 */
export type EnrichedIngredient = Ingredient & {
  nutrition: FatSecretNutrition;
  scaledNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
};

// ============================================================================
// Stage 4: Final Analysis Result
// ============================================================================

/**
 * Complete analysis result with all stages
 */
export type AdvancedAnalysisResult = {
  success: boolean;
  data?: {
    totalNutrition: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
    ingredients: EnrichedIngredient[];
    regions: FoodRegion[];
    confidence: number;
  };
  error?: string;
  metadata?: {
    processingTimeMs: number;
    stagesCompleted: string[];
    [key: string]: unknown; // Allow additional metadata properties for edge cases
  };
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid FoodRegion
 */
export function isFoodRegion(value: unknown): value is FoodRegion {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const region = value as Record<string, unknown>;

  return (
    typeof region.regionId === 'string' &&
    typeof region.description === 'string' &&
    typeof region.confidence === 'number' &&
    region.confidence >= 0 &&
    region.confidence <= 100 &&
    (region.boundingBox === undefined ||
      (typeof region.boundingBox === 'object' &&
        region.boundingBox !== null &&
        typeof (region.boundingBox as Record<string, unknown>).x === 'number' &&
        typeof (region.boundingBox as Record<string, unknown>).y === 'number' &&
        typeof (region.boundingBox as Record<string, unknown>).width === 'number' &&
        typeof (region.boundingBox as Record<string, unknown>).height === 'number'))
  );
}

/**
 * Type guard to check if a value is a valid SegmentationResult
 */
export function isSegmentationResult(value: unknown): value is SegmentationResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const result = value as Record<string, unknown>;

  return (
    Array.isArray(result.regions) &&
    result.regions.every(isFoodRegion) &&
    typeof result.overallConfidence === 'number' &&
    result.overallConfidence >= 0 &&
    result.overallConfidence <= 100 &&
    (result.notes === undefined || typeof result.notes === 'string')
  );
}

/**
 * Type guard to check if a value is a valid Ingredient
 */
export function isIngredient(value: unknown): value is Ingredient {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const ingredient = value as Record<string, unknown>;

  return (
    typeof ingredient.name === 'string' &&
    ingredient.name.length > 0 &&
    typeof ingredient.quantity === 'number' &&
    ingredient.quantity >= 0 &&
    typeof ingredient.unit === 'string' &&
    ingredient.unit.length > 0 &&
    typeof ingredient.regionId === 'string' &&
    typeof ingredient.confidence === 'number' &&
    ingredient.confidence >= 0 &&
    ingredient.confidence <= 100 &&
    (ingredient.preparation === undefined || typeof ingredient.preparation === 'string')
  );
}

/**
 * Type guard to check if a value is a valid DecompositionResult
 */
export function isDecompositionResult(value: unknown): value is DecompositionResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const result = value as Record<string, unknown>;

  return (
    Array.isArray(result.ingredients) &&
    result.ingredients.every(isIngredient) &&
    typeof result.confidence === 'number' &&
    result.confidence >= 0 &&
    result.confidence <= 100 &&
    (result.dishName === undefined || typeof result.dishName === 'string')
  );
}

/**
 * Type guard to check if a value is a valid FatSecretNutrition
 */
export function isFatSecretNutrition(value: unknown): value is FatSecretNutrition {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const nutrition = value as Record<string, unknown>;

  return (
    typeof nutrition.foodId === 'string' &&
    typeof nutrition.foodName === 'string' &&
    typeof nutrition.calories === 'number' &&
    nutrition.calories >= 0 &&
    typeof nutrition.protein === 'number' &&
    nutrition.protein >= 0 &&
    typeof nutrition.carbs === 'number' &&
    nutrition.carbs >= 0 &&
    typeof nutrition.fat === 'number' &&
    nutrition.fat >= 0 &&
    typeof nutrition.servingSize === 'string' &&
    typeof nutrition.servingUnit === 'string'
  );
}

/**
 * Type guard to check if a value is a valid EnrichedIngredient
 */
export function isEnrichedIngredient(value: unknown): value is EnrichedIngredient {
  if (!isIngredient(value)) {
    return false;
  }

  const enriched = value as Record<string, unknown>;

  return (
    typeof enriched.nutrition === 'object' &&
    enriched.nutrition !== null &&
    isFatSecretNutrition(enriched.nutrition) &&
    typeof enriched.scaledNutrition === 'object' &&
    enriched.scaledNutrition !== null &&
    typeof (enriched.scaledNutrition as Record<string, unknown>).calories === 'number' &&
    typeof (enriched.scaledNutrition as Record<string, unknown>).protein === 'number' &&
    typeof (enriched.scaledNutrition as Record<string, unknown>).carbs === 'number' &&
    typeof (enriched.scaledNutrition as Record<string, unknown>).fat === 'number'
  );
}

/**
 * Type guard to check if a value is a valid AdvancedAnalysisResult
 */
export function isAdvancedAnalysisResult(value: unknown): value is AdvancedAnalysisResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const result = value as Record<string, unknown>;

  if (typeof result.success !== 'boolean') {
    return false;
  }

  // If success is false, error should be present
  if (!result.success) {
    return typeof result.error === 'string';
  }

  // If success is true, data should be present and valid
  if (typeof result.data !== 'object' || result.data === null) {
    return false;
  }

  const data = result.data as Record<string, unknown>;

  return (
    typeof data.totalNutrition === 'object' &&
    data.totalNutrition !== null &&
    typeof (data.totalNutrition as Record<string, unknown>).calories === 'number' &&
    typeof (data.totalNutrition as Record<string, unknown>).protein === 'number' &&
    typeof (data.totalNutrition as Record<string, unknown>).carbs === 'number' &&
    typeof (data.totalNutrition as Record<string, unknown>).fat === 'number' &&
    Array.isArray(data.ingredients) &&
    data.ingredients.every(isEnrichedIngredient) &&
    Array.isArray(data.regions) &&
    data.regions.every(isFoodRegion) &&
    typeof data.confidence === 'number' &&
    data.confidence >= 0 &&
    data.confidence <= 100
  );
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates that a confidence score is within valid range
 */
export function validateConfidence(confidence: number): boolean {
  return typeof confidence === 'number' && confidence >= 0 && confidence <= 100;
}

/**
 * Validates that nutritional values are non-negative
 */
export function validateNutrition(nutrition: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}): boolean {
  return (
    typeof nutrition.calories === 'number' &&
    nutrition.calories >= 0 &&
    typeof nutrition.protein === 'number' &&
    nutrition.protein >= 0 &&
    typeof nutrition.carbs === 'number' &&
    nutrition.carbs >= 0 &&
    typeof nutrition.fat === 'number' &&
    nutrition.fat >= 0
  );
}

/**
 * Validates that a quantity is positive
 */
export function validateQuantity(quantity: number): boolean {
  return typeof quantity === 'number' && quantity > 0 && isFinite(quantity);
}

/**
 * Validates that a unit is a recognized measurement unit
 */
export function validateUnit(unit: string): boolean {
  const validUnits = ['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece', 'serving'];
  return validUnits.includes(unit.toLowerCase());
}

/**
 * Validates ingredient name is not empty and reasonable length
 */
export function validateIngredientName(name: string): boolean {
  return typeof name === 'string' && name.trim().length > 0 && name.length <= 200;
}

/**
 * Validates bounding box coordinates are within valid range (0-100%)
 */
export function validateBoundingBox(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): boolean {
  return (
    typeof box.x === 'number' &&
    box.x >= 0 &&
    box.x <= 100 &&
    typeof box.y === 'number' &&
    box.y >= 0 &&
    box.y <= 100 &&
    typeof box.width === 'number' &&
    box.width > 0 &&
    box.width <= 100 &&
    typeof box.height === 'number' &&
    box.height > 0 &&
    box.height <= 100 &&
    box.x + box.width <= 100 &&
    box.y + box.height <= 100
  );
}

/**
 * Sanitizes ingredient name by trimming and normalizing
 */
export function sanitizeIngredientName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Validates that processing time is reasonable (not negative or excessively large)
 */
export function validateProcessingTime(timeMs: number): boolean {
  return typeof timeMs === 'number' && timeMs >= 0 && timeMs < 300000; // Max 5 minutes
}

/**
 * Validates that stages completed array contains valid stage names
 */
export function validateStagesCompleted(stages: string[]): boolean {
  const validStages = ['segmentation', 'decomposition', 'lookup', 'aggregation'];
  return (
    Array.isArray(stages) &&
    stages.length > 0 &&
    stages.every((stage) => validStages.includes(stage))
  );
}
