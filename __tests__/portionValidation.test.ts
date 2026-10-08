import { categorizeIngredient, validatePortionSize } from '@/services/portionValidation';

it.each([
  ['boiled eggs', 100], ['scrambled eggs', 160], ['cooked pasta', 250],
  ['salmon', 400], ['pizza crust', 100], ['basil', 2], ['raspberries', 10],
])('preserves the visible quantity for %s', (name, quantity) => {
  const result = validatePortionSize(name, quantity, 'g');
  expect(result.adjustedQuantity).toBe(quantity);
  expect(result.wasAdjusted).toBe(false);
  expect(result.confidencePenalty).toBe(0);
});

it('distinguishes an egg from a scrambled-egg serving when issuing a guideline warning', () => {
  expect(validatePortionSize('egg', 100, 'g').warning).toContain('45-60');
  expect(validatePortionSize('scrambled eggs', 100, 'g').warning).toBeUndefined();
});

it.each([['pizza crust', 'pizzaDough'], ['olive oil', 'oil'], ['basil', 'garnish']])
('classifies %s before broader category keywords', (name, category) => {
  expect(categorizeIngredient(name)).toBe(category);
});

it('preserves sub-gram toppings and original units', () => {
  expect(validatePortionSize('basil', 0.01, 'g').adjustedQuantity).toBe(0.01);
  expect(validatePortionSize('bread', 2, 'oz').adjustedQuantity).toBe(2);
});

it('caps only amounts above the supported ceiling and records an adjustment reason', () => {
  const result = validatePortionSize('salmon', 12000, 'g');
  expect(result).toEqual(expect.objectContaining({ adjustedQuantity: 10000, wasAdjusted: true }));
  expect(result.reason).toContain('supported');
  expect(result.confidencePenalty).toBeGreaterThan(0);
});

it.each([0, -1, NaN, Infinity])('rejects invalid portion %s', quantity => {
  expect(() => validatePortionSize('egg', quantity, 'g')).toThrow('Invalid quantity');
});
