import { areIngredientsSimilar, deduplicateIngredients } from '@/services/ingredientDeduplication';
import type { Ingredient } from '@/lib/advanced-food-analysis-types';

const item = (name: string, quantity: number, regionIndex?: number): Ingredient => ({
  name, quantity, regionIndex, unit: 'g', confidence: 90,
});

it.each([
  ['tomato', 'tomato sauce'], ['bread', 'breaded chicken'], ['white rice', 'brown rice'],
  ['chicken breast', 'chicken thigh'], ['raw chicken', 'cooked chicken'], ['olive oil', 'olives'],
])('keeps different foods distinct: %s / %s', (first, second) => {
  expect(areIngredientsSimilar(first, second).isSimilar).toBe(false);
});

it('deduplicates repeated labels within a region and adds separate regions', () => {
  const result = deduplicateIngredients([item('boiled eggs', 100, 0), item('boiled egg', 90, 0), item('boiled eggs', 50, 1)]);
  expect(result.uniqueIngredients).toHaveLength(1);
  expect(result.uniqueIngredients[0].quantity).toBe(150);
  expect(result.mergedCount).toBe(2);
});

it('preserves adjustment provenance regardless of entry order', () => {
  const entries = [item('salmon', 100, 0), { ...item('salmon', 200, 1), wasAdjusted: true, adjustmentReason: 'Confirmed adjustment' }];
  for (const input of [entries, [...entries].reverse()]) {
    expect(deduplicateIngredients(input).uniqueIngredients[0]).toEqual(expect.objectContaining({
      quantity: 300, wasAdjusted: true, adjustmentReason: 'Confirmed adjustment',
    }));
  }
});

it('converts compatible mass units and keeps volume separate', () => {
  const result = deduplicateIngredients([item('milk', 100), { ...item('milk', 0.1), unit: 'kg' }, { ...item('milk', 100), unit: 'ml' }]);
  expect(result.uniqueIngredients.map(ingredient => [ingredient.unit, ingredient.quantity])).toEqual([['g', 200], ['ml', 100]]);
});
