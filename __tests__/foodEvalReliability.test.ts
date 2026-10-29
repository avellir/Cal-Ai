// eslint-disable-next-line @typescript-eslint/no-require-imports
const { cacheKey, evaluationMetrics } = require('../scripts/food-eval-reliability.cjs');

it('invalidates cache when image, full request, source, deployment or model changes', () => {
  const request = { mode: 'analyze', base64Image: 'original', dishLabel: 'plate' };
  const provenance = { sourceHash: 'source-1', deployment: 1, model: 'model-1' };
  const original = cacheKey(request, provenance);
  expect(cacheKey({ dishLabel: 'plate', base64Image: 'original', mode: 'analyze' }, provenance)).toBe(original);
  for (const body of [{ ...request, base64Image: 'different' }, { ...request, dishLabel: 'bowl' }]) expect(cacheKey(body, provenance)).not.toBe(original);
  for (const version of [{ ...provenance, sourceHash: 'source-2' }, { ...provenance, deployment: 2 }, { ...provenance, model: 'model-2' }]) expect(cacheKey(request, version)).not.toBe(original);
});

const data = {
  ingredients: [{ name: 'quail eggs', foodName: 'quail egg', quantity: 18, unit: 'g', visibleCount: 2, visibleFraction: 1, itemType: 'quail egg', nutritionStatus: 'resolved' }],
  excludedIngredients: [{ name: 'tea', quantity: 200, unit: 'ml' }],
  regions: [{ dishName: 'Egg bowl', selected: true }, { dishName: 'Tea', selected: false }], warnings: [],
};
it('separates annotated identity/count/scope checks from nutrition coverage and mass', () => {
  const metrics = evaluationMetrics(data, { weightGrams: 20, dishAliases: [['egg bowl']],
    ingredients: [{ aliases: ['quail egg'], visibleCount: 2, visibleFraction: 1, itemType: 'quail egg' }],
    scope: [{ aliases: ['tea'], included: false }], unexpectedWarningPatterns: ['outside the single-serving guideline'] });
  expect(metrics.mass.errorPercent).toBe(10);
  expect(metrics.volume).toBeNull();
  expect(metrics.identity[0].found).toBe(true);
  expect(metrics.counts[0]).toEqual(expect.objectContaining({ countCorrect: true, fractionCorrect: true, typeCorrect: true }));
  expect(metrics.scope[0].correct).toBe(true);
  expect(metrics.nutritionCoverage).toEqual({ resolved: 1, total: 1 });
  expect(metrics.falseWarnings[0].triggered).toBe(false);
});
it('does not count missing annotations or mix grams and millilitres into a weight error', () => {
  const metrics = evaluationMetrics({ ...data, ingredients: [...data.ingredients, { name: 'tea', quantity: 200, unit: 'ml', nutritionStatus: 'unresolved' }] }, { weightGrams: 218, volumeMl: 200 });
  expect(metrics.mass).toBeNull();
  expect(metrics.volume.actual).toBe(200);
  expect(metrics.identity).toBeNull();
  expect(metrics.counts).toBeNull();
  expect(metrics.scope).toBeNull();
  expect(metrics.falseWarnings).toBeNull();
  expect(metrics.nutritionCoverage).toEqual({ resolved: 1, total: 2 });
});
