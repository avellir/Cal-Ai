// Individual ingredient detected in the image
export type IngredientData = {
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type NutritionData = {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  ingredients: IngredientData[]; // Per-ingredient breakdown
  visualEvidence: string[];
  confidence: number;
  reasoning: string;
  warnings?: string[];
};

export type AnalysisResult = {
  success: boolean;
  data?: NutritionData;
  error?: string;
};

import { analyzeFoodImageAdvanced } from './advancedFoodAnalysis';
import { convertToGrams } from './fatSecretApi';

/**
 * Analyzes a food image using the Advanced Food Analysis Pipeline
 * Delegates to services/advancedFoodAnalysis.ts and maps result to legacy format
 */
export async function analyzeFoodImage(imageUri: string): Promise<AnalysisResult> {
  try {
    console.log('Starting advanced food analysis for image:', imageUri);

    const advancedResult = await analyzeFoodImageAdvanced(imageUri);

    if (!advancedResult.success || !advancedResult.data) {
      return {
        success: false,
        error: advancedResult.error || 'Unknown error in advanced analysis'
      };
    }

    // Map AdvancedAnalysisResult to legacy NutritionData
    const data = advancedResult.data;

    // Construct food name from regions
    const foodName = data.regions.map(r => r.description).join(', ') || 'Food Item';

    // Map ingredients
    const ingredients: IngredientData[] = data.ingredients.map(ing => {
      // Convert quantity to grams for display
      const grams = convertToGrams(ing.quantity, ing.unit);

      return {
        name: ing.name,
        grams,
        // Note: ing.scaledNutrition is what matters for macros.
        calories: ing.scaledNutrition.calories,
        protein: ing.scaledNutrition.protein,
        carbs: ing.scaledNutrition.carbs,
        fat: ing.scaledNutrition.fat
      };
    });

    // Calculate total grams for serving size representation
    // Sum the converted grams directly
    const totalGrams = ingredients.reduce((sum, ing) => sum + ing.grams, 0);

    const nutritionData: NutritionData = {
      foodName,
      calories: data.totalNutrition.calories,
      protein: data.totalNutrition.protein,
      carbs: data.totalNutrition.carbs,
      fat: data.totalNutrition.fat,
      servingSize: totalGrams > 0 ? `${Math.round(totalGrams)}g` : '1 serving',
      ingredients,
      visualEvidence: data.regions.map(r => `${r.description} (${r.confidence}% conf)`),
      confidence: data.confidence,
      reasoning: 'Analyzed via Advanced Multi-Stage Pipeline (Segmentation -> Decomposition -> FatSecret Verification)',
      warnings: data.warnings
    };

    return {
      success: true,
      data: nutritionData
    };

  } catch (error) {
    console.error('Food analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * @deprecated Temporary alias for callers migrated to advanced pipeline naming.
 * Use analyzeFoodImage while advanced analysis consolidates.
 */
export async function analyzeAdvancedFoodImage(imageUri: string): Promise<AnalysisResult> {
  return analyzeFoodImage(imageUri);
}

// Re-export shared utilities if needed by other legacy files
// (None found in initial scan, but keeping clean)

/**
 * Returns user-friendly confidence message based on confidence score
 * Provides contextual guidance for different confidence thresholds
 */
export function getConfidenceMessage(confidence: number): string {
  if (confidence < 40) {
    return 'Low confidence. Please retake the photo with better lighting and a clearer view of the food.';
  } else if (confidence < 60) {
    return 'Moderate confidence. Please verify the nutritional values and adjust if needed.';
  } else if (confidence < 75) {
    return 'Good estimate. The nutritional values should be reasonably accurate.';
  } else {
    return 'High confidence. The analysis is based on clear visual information.';
  }
}
