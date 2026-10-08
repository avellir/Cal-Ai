import { lookupIngredientNutrition } from '@/services/localNutrition';
import { validateAdvancedAnalysis } from '@/services/advancedFoodValidation';
import type { AdvancedAnalysisResult } from '@/lib/advanced-food-analysis-types';

describe('local nutrition lookup', () => {
  it.each([
    ['boiled eggs', 'egg'], ['scrambled eggs', 'scrambled egg'], ['fried eggs', 'egg'],
    ['grilled chicken breasts', 'chicken breast'], ['cherry tomatoes', 'tomato'],
    ['roasted sweet potatoes', 'sweet potato'], ['penne', 'pasta'],
    ['penne pasta', 'pasta'], ['Parmesan cheese', 'parmesan'],
  ])('matches %s to the appropriate reference', (name, reference) => {
    expect(lookupIngredientNutrition({ name, quantity: 100, unit: 'g' }).foodId).toBe(`local:${reference}`);
  });

  it.each(['orange juice', 'chicken soup', 'tomato sauce', 'milk powder', 'dry pasta', 'cooked oats', 'rice and chicken',
    'coconut milk', 'almond milk', 'chocolate milk', 'milk chocolate', 'skim milk', 'egg white', 'egg whites', 'egg yolk', 'black pepper', 'peanut butter', 'fried chicken'])
  ('does not borrow component nutrition for %s', name => {
    expect(lookupIngredientNutrition({ name, quantity: 100, unit: 'g' }).source).toBe('generic');
  });

  it('scales the sourced scrambled-egg reference once and preserves mass conversions', () => {
    const result = lookupIngredientNutrition({ name: 'scrambled eggs', quantity: 160, unit: 'g' });
    expect(result.scaledNutrition).toEqual({ calories: 238, protein: 16, carbs: 2.6, fat: 17.6 });
    expect(lookupIngredientNutrition({ name: 'scrambled eggs', quantity: 0.16, unit: 'kg' }).scaledNutrition).toEqual(result.scaledNutrition);
  });

  it.each([0, -1, NaN, Infinity])('rejects invalid quantity %s', quantity => {
    expect(() => lookupIngredientNutrition({ name: 'egg', quantity, unit: 'g' })).toThrow('positive finite');
  });

  it('rejects unsupported units instead of assuming grams', () => {
    expect(() => lookupIngredientNutrition({ name: 'egg', quantity: 1, unit: 'bucket' })).toThrow('Unsupported');
  });
  it('uses reference values for known foods without an external request', () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const cheese = lookupIngredientNutrition({ name: 'cheese', quantity: 60, unit: 'g' });
    const greenBeans = lookupIngredientNutrition({ name: 'green bean', quantity: 70, unit: 'g' });

    expect(cheese.source).toBe('estimated');
    expect(cheese.scaledNutrition.calories).toBe(241);
    expect(greenBeans.source).toBe('estimated');
    expect(greenBeans.scaledNutrition.calories).toBe(22);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('marks unknown foods as generic rather than claiming a database match', () => {
    const result = lookupIngredientNutrition({ name: 'unknown dish', quantity: 160, unit: 'g' });

    expect(result.source).toBe('generic');
    expect(result.foodId).toBe('generic_estimate');
    expect(result.confidencePenalty).toBe(20);
  });

  it('matches whole food names so boiled egg is not mistaken for oil', () => {
    const result = lookupIngredientNutrition({ name: 'boiled egg', quantity: 100, unit: 'g' });

    expect(result.source).toBe('estimated');
    expect(result.foodId).toBe('local:egg');
    expect(result.scaledNutrition.calories).toBe(155);
  });

  it('warns about generic nutrition without suggesting FatSecret failed', () => {
    const nutrition = lookupIngredientNutrition({ name: 'unknown dish', quantity: 160, unit: 'g' });
    const result: AdvancedAnalysisResult = {
      success: true,
      data: {
        totalNutrition: nutrition.scaledNutrition,
        ingredients: [{
          name: 'unknown dish',
          quantity: 160,
          unit: 'g',
          confidence: 70,
          nutrition: {
            foodId: nutrition.foodId,
            foodName: nutrition.foodName,
            calories: nutrition.calories,
            protein: nutrition.protein,
            carbs: nutrition.carbs,
            fat: nutrition.fat,
            servingSize: nutrition.servingSize,
            servingUnit: nutrition.servingUnit,
          },
          scaledNutrition: nutrition.scaledNutrition,
          source: nutrition.source,
        }],
        regions: [],
        confidence: 90,
        warnings: [],
      },
    };

    const validated = validateAdvancedAnalysis(result);
    expect(validated.data?.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('no nutrition reference'),
    ]));
    expect(validated.data?.warnings?.join(' ')).not.toContain('FatSecret');
  });
});
