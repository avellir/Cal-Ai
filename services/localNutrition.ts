import type { NutritionReference, NutritionValues } from '@/lib/nutrition-types';

const MASS_TO_GRAMS: Record<string, number> = { g: 1, gram: 1, grams: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 };

/** No implicit ml-to-g conversion, typical piece weight, or generic nutrition. */
export function scaleNutrition(reference: NutritionReference, quantity: number, unit: string, servingIndex?: number): NutritionValues {
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(reference.basisAmount) || reference.basisAmount <= 0) {
    throw new Error('A positive finite amount and nutrition basis are required.');
  }
  let amount: number;
  if (unit === reference.basisUnit) {
    amount = quantity;
  } else if (reference.basisUnit === 'g' && MASS_TO_GRAMS[unit]) {
    amount = quantity * MASS_TO_GRAMS[unit];
  } else if (reference.basisUnit === 'g' && unit === 'ml') {
    const serving = reference.servings.find(item => Number.isFinite(item.volumeMl) && item.volumeMl! > 0 && Number.isFinite(item.grams) && item.grams > 0);
    if (!serving) throw new Error('Volume requires a documented volume-to-weight serving. Choose a volume reference, enter grams, or copy nutrition per 100 ml from a label.');
    amount = quantity * serving.grams / serving.volumeMl!;
  } else if (reference.basisUnit === 'g' && unit === 'serving' && servingIndex !== undefined) {
    const serving = reference.servings[servingIndex];
    if (!serving || !Number.isFinite(serving.grams) || serving.grams <= 0) throw new Error('Choose a serving with a known weight.');
    amount = quantity * serving.grams;
  } else {
    throw new Error('This food needs grams or a serving with a known weight. Volume cannot be treated as weight.');
  }
  const scale = amount / reference.basisAmount;
  const scaled = Object.fromEntries(Object.entries(reference.nutrients).map(([key, value]) => [key, value * scale])) as NutritionValues;
  if (Object.values(scaled).some(value => !Number.isFinite(value) || value < 0)) throw new Error('Nutrition must contain nonnegative finite values.');
  return scaled;
}
