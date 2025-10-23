export type MealMacroSummary = {
  protein: number;
  carbs: number;
  fat: number;
};

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type MealLogEntry = {
  id: string;
  name: string;
  calories: number;
  macros: MealMacroSummary;
  note?: string | null;
  imageUri?: string | null;
  timestamp: number;
  mealType: MealType;
};

export type AddMealInput = {
  name: string;
  calories: number;
  macros: MealMacroSummary;
  note?: string | null;
  servingSizeLabel?: string;
  mealType?: MealType;
  quantity?: number;
  imageUri?: string | null;
};

// ============================================================================
// Enhanced Type Definitions for Accurate Calorie Calculation
// ============================================================================

// Re-export Ingredient type from advanced-food-analysis-types for convenience
export type { Ingredient } from '@/lib/advanced-food-analysis-types';

/**
 * Ingredient enriched with nutritional data
 * Extends the base Ingredient type with nutritional information
 */
export type IngredientWithNutrition = {
  name: string;
  quantity: number;
  unit: 'g' | 'ml' | 'oz' | 'cup' | 'tbsp' | 'tsp' | 'piece';
  preparation?: string;
  confidence: number;
  
  // Validation metadata (from portion validation)
  category?: string;
  wasAdjusted?: boolean;
  adjustmentReason?: string;
  
  // Nutritional data
  nutritionPer100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  servingSize?: number;
  source: 'fatsecret' | 'usda' | 'estimated';
};

/**
 * Analysis result with enhanced transparency
 * Used by the accurate calorie calculation system
 */
export type AnalysisResult = {
  success: boolean;
  data?: {
    foodName: string;
    calories: number;  // Always calculated from macros
    protein: number;
    carbs: number;
    fat: number;
    servingSize: string;
    confidence: number;
    reasoning: string;
    
    // Added for transparency
    ingredients: IngredientWithNutrition[];
    adjustments: string[];
    warnings: string[];
  };
  error?: string;
};
