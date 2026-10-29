import { isIngredient, type Ingredient } from '@/lib/advanced-food-analysis-types';

export type VisionIngredient = {
  name: string; confidence: number; weight_grams?: number;
  amount?: number; unit?: 'g' | 'ml'; amount_min?: number; amount_max?: number;
  weight_min_grams?: number; weight_max_grams?: number;
  visual_evidence?: string; food_name?: string; preparation?: string;
  representation?: 'whole_dish' | 'component'; visible_count?: number | null;
  visible_fraction?: number | null; item_type?: string | null; identity_uncertain?: boolean;
  identity_alternatives?: string[]; nutrition_identity_known?: boolean;
  extra_with_whole_dish?: boolean; is_added_fat?: boolean;
};

/** Reads both contracts; a legacy mass is never relabelled as volume. */
export function ingredientFromVision(item: VisionIngredient, regionIndex: number): Ingredient {
  const modern = item.amount !== undefined || item.unit !== undefined;
  const quantity = modern ? item.amount : item.weight_grams;
  const unit = modern ? item.unit : 'g';
  const min = modern ? item.amount_min : item.weight_min_grams;
  const max = modern ? item.amount_max : item.weight_max_grams;
  if (modern && (item.weight_grams !== undefined || !['g', 'ml'].includes(String(unit)) || min === undefined || max === undefined)) {
    throw new Error('Food analysis returned an invalid amount/unit. Please try another photo.');
  }
  const ingredient: Ingredient = {
    name: item.name, foodName: item.food_name, preparation: item.preparation,
    quantity: quantity!, unit: unit!, confidence: item.confidence, regionIndex,
    representation: item.representation, visibleCount: item.visible_count, visibleFraction: item.visible_fraction,
    itemType: item.item_type, identityUncertain: item.identity_uncertain,
    identityAlternatives: item.identity_alternatives, nutritionIdentityKnown: item.nutrition_identity_known,
    extraWithWholeDish: item.extra_with_whole_dish, isAddedFat: item.is_added_fat,
    visualEvidence: item.visual_evidence, quantitySource: 'photo', originalEstimate: { quantity: quantity!, unit: unit! },
  };
  if (min !== undefined || max !== undefined) {
    ingredient.estimatedAmountRange = { min: min!, max: max!, unit: unit as 'g' | 'ml' };
    ingredient.photoAmountRange = ingredient.estimatedAmountRange;
    if (unit === 'g') ingredient.estimatedWeightRange = { min: min!, max: max! };
  }
  if (!isIngredient(ingredient) || ingredient.quantity > 10000) throw new Error('Food analysis returned invalid ingredients. Please try another photo.');
  return ingredient;
}
