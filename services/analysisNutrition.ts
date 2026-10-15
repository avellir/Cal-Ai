import type { AnalysisIngredient, AdvancedAnalysisResult, EnrichedIngredient, Ingredient } from '@/lib/advanced-food-analysis-types';
import type { NutritionReference, NutritionValues } from '@/lib/nutrition-types';
import { scaleNutrition } from '@/services/localNutrition';

export const emptyNutrition = (): NutritionValues => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });

export function unresolvedIngredient(ingredient: Ingredient, reason: string): AnalysisIngredient {
  return { ...ingredient, nutritionStatus: 'unresolved', nutrition: null, scaledNutrition: null, source: undefined, unresolvedReason: reason };
}

export function resolveIngredient(ingredient: Ingredient, reference: NutritionReference): EnrichedIngredient {
  const scaledNutrition = scaleNutrition(reference, ingredient.quantity, ingredient.unit, ingredient.servingIndex);
  return {
    name: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit,
    confidence: ingredient.confidence, regionIndex: ingredient.regionIndex,
    preparation: ingredient.preparation, originalEstimate: ingredient.originalEstimate,
    foodName: ingredient.foodName, visualEvidence: ingredient.visualEvidence,
    estimatedWeightRange: ingredient.estimatedWeightRange,
    quantitySource: ingredient.quantitySource, servingIndex: ingredient.servingIndex,
    category: ingredient.category, wasAdjusted: ingredient.wasAdjusted, adjustmentReason: ingredient.adjustmentReason,
    nutritionStatus: 'resolved', source: reference.source, scaledNutrition,
    nutrition: {
      foodId: reference.id, foodName: reference.name, ...reference.nutrients,
      servingSize: `${reference.basisAmount} ${reference.basisUnit}`, servingUnit: reference.basisUnit, reference,
    },
  };
}

export function hasCompleteNutrition(data: NonNullable<AdvancedAnalysisResult['data']>): boolean {
  if (!data.ingredients.length) return data.nutritionStatus === undefined; // Legacy manually-entered projections.
  return data.ingredients.every(ingredient =>
    ingredient.nutritionStatus !== 'unresolved' && ingredient.source !== 'generic');
}

export function recalculateAnalysis(data: NonNullable<AdvancedAnalysisResult['data']>, ingredients: AnalysisIngredient[]): NonNullable<AdvancedAnalysisResult['data']> {
  const totalNutrition = ingredients.reduce((sum, ingredient) => {
    if (!ingredient.scaledNutrition || ingredient.source === 'generic') return sum;
    for (const key of ['calories', 'protein', 'carbs', 'fat'] as const) sum[key] += ingredient.scaledNutrition[key];
    return sum;
  }, emptyNutrition());
  return {
    ...data, ingredients, totalNutrition,
    nutritionStatus: ingredients.length > 0 && ingredients.every(ingredient => ingredient.nutritionStatus !== 'unresolved' && ingredient.source !== 'generic') ? 'complete' : 'incomplete',
  };
}

export function correctIngredientAmount(ingredient: AnalysisIngredient, quantity: number, unit: string, servingIndex?: number): AnalysisIngredient {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Enter an amount greater than zero.');
  const updated = {
    ...ingredient, quantity, unit, servingIndex, quantitySource: 'user' as const,
    originalEstimate: ingredient.originalEstimate ?? { quantity: ingredient.quantity, unit: ingredient.unit },
    wasAdjusted: true, adjustmentReason: 'Amount corrected by you.',
  };
  if (!ingredient.nutrition?.reference) {
    if (!ingredient.nutrition) return updated;
    const reference: NutritionReference = {
      id: ingredient.nutrition.foodId, name: ingredient.nutrition.foodName, source: 'manual',
      basisAmount: ingredient.unit === 'serving' ? 1 : 100,
      basisUnit: ingredient.unit === 'serving' ? 'serving' : 'g',
      nutrients: { calories: ingredient.nutrition.calories, protein: ingredient.nutrition.protein, carbs: ingredient.nutrition.carbs, fat: ingredient.nutrition.fat }, servings: [],
    };
    return resolveIngredient(updated, reference);
  }
  return resolveIngredient(updated, ingredient.nutrition.reference);
}

/** Whole prepared-dish references replace the components of that region, never add to them. */
export function isWholeDishReference(reference: NutritionReference): boolean {
  return /\b(soup|borscht|curry|salad|sandwich|pizza|stew)\b/i.test(reference.name) &&
    !/\b(sauce|broth|dressing|powder)\b/i.test(reference.name);
}

export function replaceAnalysisIngredient(
  data: NonNullable<AdvancedAnalysisResult['data']>, index: number, replacement: AnalysisIngredient, wholeDish = false,
): NonNullable<AdvancedAnalysisResult['data']> {
  const original = data.ingredients[index];
  if (!original) throw new Error('This food is no longer available.');
  const ingredients = data.ingredients.flatMap((ingredient, current) => {
    if (current === index) return [replacement];
    if (wholeDish && original.regionIndex !== undefined && ingredient.regionIndex === original.regionIndex) return [];
    return [ingredient];
  });
  return recalculateAnalysis(data, ingredients);
}
