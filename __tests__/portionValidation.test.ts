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

it('compares the total with a range scaled by the visible egg count', () => {
  expect(validatePortionSize('egg', 100, 'g', { visibleCount: 1 }).warning).toContain('45-60');
  expect(validatePortionSize('scrambled eggs', 100, 'g', { visibleCount: 2 }).warning).toBeUndefined();
  expect(validatePortionSize('Fried chicken eggs', 150, 'g', { visibleCount: 3 }).warning).toBeUndefined();
  const contradictory = validatePortionSize('Fried chicken eggs', 300, 'g', { visibleCount: 3 });
  expect(contradictory.warning).toContain('135-180');
  expect(contradictory.adjustedQuantity).toBe(300);
});

it.each([50, 150, 300, 3000])('does not infer an egg count from its own %sg estimate', grams => {
  const result = validatePortionSize('fried eggs', grams, 'g');
  expect(result.warning).toContain('Count unknown');
  expect(result.warning).not.toContain('inferred');
  expect(result.warning).not.toContain('within');
  expect(result.adjustedQuantity).toBe(grams);
});

it.each([0, -1, NaN, Infinity, 1.5])('does not trust an invalid visible count %s', visibleCount => {
  expect(validatePortionSize('eggs', 150, 'g', { visibleCount }).warning).toContain('Count unknown');
});

it('uses the counted visible fraction without scaling the estimated quantity again', () => {
  const result = validatePortionSize('chicken breast', 60, 'g', { visibleCount: 1, visibleFraction: 0.5 });
  expect(result.warning).toBeUndefined();
  expect(result.adjustedQuantity).toBe(60);
});

it('handles a quarter of a whole item without multiplying its estimated grams', () => {
  const result = validatePortionSize('chicken breast', 30, 'g', { visibleCount: 1, visibleFraction: 0.25 });
  expect(result.warning).toBeUndefined();
  expect(result.adjustedQuantity).toBe(30);
  expect(validatePortionSize('chicken breast', 100, 'g', { visibleCount: 1, visibleFraction: 0.25 }).warning).toContain('20-37.5');
});

it('still warns about a single oversized egg, chicken breast and plain broccoli side', () => {
  expect(validatePortionSize('egg', 200, 'g', { visibleCount: 1 }).warning).toContain('45-60');
  expect(validatePortionSize('chicken breast', 600, 'g', { visibleCount: 1 }).warning).toContain('80-150');
  expect(validatePortionSize('plain broccoli', 1000, 'g', { representation: 'component' }).warning).toContain('15-150');
});

it.each(['egg fried rice', 'chicken salad', 'loaded fries'])
('recognizes the prepared dish %s despite ingredient keywords', name => {
  expect(categorizeIngredient(name)).toBe('completeDish');
  expect(validatePortionSize(name, 700, 'g').warning).toBeUndefined();
});

it.each(['Chicken vegetable stew', 'Broccoli cheese casserole', 'Chicken soup', 'Chicken curry'])
('classifies %s before ingredient words and skips ingredient-sized guidelines', name => {
  expect(categorizeIngredient(name)).toBe('completeDish');
  expect(validatePortionSize(name, 700, 'g').warning).toBeUndefined();
});

it('respects canonical whole-dish identity and keeps shared-portion confirmation', () => {
  const result = validatePortionSize('broccoli and cheese', 1200, 'g', {
    representation: 'whole_dish', servingConfirmationRequired: true,
  });
  expect(result.category).toBe('completeDish');
  expect(result.warning).toContain('Confirm the consumed portion');
  expect(result.warning).not.toContain('15-150');
  expect(result.adjustedQuantity).toBe(1200);
});

it('does not turn a bulk food serving or a volume into a count of units', () => {
  expect(validatePortionSize('cooked rice', 300, 'g', { visibleCount: 3 }).warning).toContain('20-150');
  expect(validatePortionSize('yogurt', 100, 'g').warning).not.toContain('Count inferred');
  expect(validatePortionSize('egg', 150, 'ml').warning).not.toContain('Count inferred');
});

it.each(['parsley', 'dill', 'chives', 'fresh herbs', 'microgreens'])
('accepts a small %s garnish while still reviewing a large amount', name => {
  expect(categorizeIngredient(name)).toBe('garnish');
  expect(validatePortionSize(name, 0.5, 'g').warning).toBeUndefined();
  expect(validatePortionSize(name, 100, 'g').warning).toContain('0-40');
  expect(validatePortionSize(name, 100, 'g').adjustedQuantity).toBe(100);
});

it('does not apply the herb exception to olives or herb-flavored oils', () => {
  expect(validatePortionSize('olives', 1, 'g').warning).toBeDefined();
  expect(categorizeIngredient('basil olive oil')).toBe('oil');
  expect(validatePortionSize('basil olive oil', 100, 'g').warning).toBeDefined();
});

it('uses independent counts for grouped meatballs and asks when that count is missing', () => {
  expect(validatePortionSize('Cooked meatballs', 160, 'g', { visibleCount: 4 }).warning).toBeUndefined();
  expect(validatePortionSize('Meatballs', 160, 'g').warning).toContain('Count unknown');
  expect(validatePortionSize('Meatballs', 800, 'g', { visibleCount: 4 }).warning).toContain('40-320');
});

it('requires scoop evidence before treating ice cream as a countable item', () => {
  expect(validatePortionSize('Vanilla ice cream', 240, 'g', { itemType: 'scoop' }).warning).toContain('Count unknown');
  expect(validatePortionSize('Ice cream', 240, 'g', { itemType: 'scoop', visibleCount: 4 }).warning).toBeUndefined();
  expect(validatePortionSize('Ice cream scoops', 600, 'g', { visibleCount: 4 }).warning).toContain('120-480');
  expect(validatePortionSize('Ice cream', 240, 'g').warning).not.toContain('Count unknown');
});

it.each(['pizza sauce', 'salad dressing', 'mixed salad greens', 'curry powder', 'curry paste', 'soup stock'])
('keeps %s as a component when its name describes a dish ingredient', name => {
  expect(categorizeIngredient(name)).not.toBe('completeDish');
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
