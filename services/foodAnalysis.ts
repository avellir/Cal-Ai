import type {
  AdvancedAnalysisResult,
  EnrichedIngredient,
} from '@/lib/advanced-food-analysis-types';
import {
  isEnrichedIngredient,
  isFoodRegion,
} from '@/lib/advanced-food-analysis-types';

import { analyzeFoodImageAdvanced } from './advancedFoodAnalysis';

export type SuccessfulAnalysisData = NonNullable<AdvancedAnalysisResult['data']>;

export type FoodAnalysisIngredientView = {
  name: string;
  matchedFoodName: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  source?: EnrichedIngredient['source'];
  wasAdjusted?: boolean;
  adjustmentReason?: string;
};

export async function analyzeFoodImage(
  imageUri: string,
  base64Image?: string
): Promise<AdvancedAnalysisResult> {
  return analyzeFoodImageAdvanced(imageUri, base64Image);
}

export async function analyzeAdvancedFoodImage(
  imageUri: string,
  base64Image?: string
): Promise<AdvancedAnalysisResult> {
  return analyzeFoodImage(imageUri, base64Image);
}

export function isSuccessfulAnalysisData(value: unknown): value is SuccessfulAnalysisData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const data = value as Record<string, unknown>;

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
    typeof data.confidence === 'number'
  );
}

export function getAnalysisDisplayName(data: SuccessfulAnalysisData): string {
  const uniqueDishNames = Array.from(
    new Set(
      data.regions
        .map(region => region.dishName?.trim())
        .filter((dishName): dishName is string => Boolean(dishName))
    )
  );

  if (uniqueDishNames.length > 0) {
    return uniqueDishNames.join(', ');
  }

  if (data.ingredients.length === 1) {
    return data.ingredients[0].nutrition.foodName || data.ingredients[0].name;
  }

  const regionDescriptions = data.regions
    .map(region => region.description.trim())
    .filter(Boolean);

  if (regionDescriptions.length > 0) {
    return regionDescriptions.join(', ');
  }

  const ingredientNames = data.ingredients
    .map(ingredient => ingredient.name.trim())
    .filter(Boolean);

  return ingredientNames.join(', ') || 'Food Item';
}

export function getAnalysisServingSizeLabel(data: SuccessfulAnalysisData): string {
  if (data.ingredients.length === 1) {
    const [ingredient] = data.ingredients;

    if (ingredient.unit === 'serving') {
      return ingredient.nutrition.servingSize || '1 serving';
    }
  }

  const uniqueUnits = Array.from(new Set(data.ingredients.map(ingredient => ingredient.unit)));
  if (uniqueUnits.length === 1 && (uniqueUnits[0] === 'g' || uniqueUnits[0] === 'ml')) {
    const totalQuantity = data.ingredients.reduce((sum, ingredient) => sum + ingredient.quantity, 0);
    return `${Math.round(totalQuantity)}${uniqueUnits[0]}`;
  }

  return '1 serving';
}

export function getAnalysisIngredientViews(
  data: SuccessfulAnalysisData
): FoodAnalysisIngredientView[] {
  return data.ingredients.map(ingredient => ({
    name: ingredient.name,
    matchedFoodName: ingredient.nutrition.foodName,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    calories: ingredient.scaledNutrition.calories,
    protein: ingredient.scaledNutrition.protein,
    carbs: ingredient.scaledNutrition.carbs,
    fat: ingredient.scaledNutrition.fat,
    confidence: ingredient.confidence,
    source: ingredient.source,
    wasAdjusted: ingredient.wasAdjusted,
    adjustmentReason: ingredient.adjustmentReason,
  }));
}

export function getAnalysisAdjustments(data: SuccessfulAnalysisData): string[] {
  const derivedIngredientAdjustments = data.ingredients.flatMap(ingredient =>
    ingredient.wasAdjusted && ingredient.adjustmentReason
      ? [`${ingredient.name}: ${ingredient.adjustmentReason}`]
      : []
  );

  return Array.from(
    new Set([...(data.adjustments ?? []), ...derivedIngredientAdjustments])
  );
}

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
