import { analyzeFoodImageAdvanced } from '@/services/advancedFoodAnalysis';
import { extractNutritionFromLabel } from '@/services/advancedFoodEdgeCases';
import { runPhotoAnalysis } from '@/services/photoAnalysis';
import { lookupIngredientNutrition } from '@/services/localNutrition';
jest.mock('@/services/photoAnalysis', () => ({ runPhotoAnalysis: jest.fn() }));
jest.mock('@/services/localNutrition', () => ({ lookupIngredientNutrition: jest.fn() }));
const vision = runPhotoAnalysis as jest.Mock;
it('returns the canonical nutrition shape and preserves fallback source and warnings', async () => {
  vision.mockResolvedValue(JSON.stringify({ regions: [{ description: 'Rice and chicken bowl', dishName: 'Chicken bowl', confidence: 90,
    ingredients: [{ name: 'chicken', weight_grams: 140, confidence: 90 }, { name: 'rice', weight_grams: 150, confidence: 90 }],
  }], overallConfidence: 90, notes: 'Cooking oil cannot be measured from this photo.' }));
  (lookupIngredientNutrition as jest.Mock).mockImplementation(async ingredient => ({
    foodId: 'local', foodName: ingredient.name, calories: 100, protein: 10, carbs: 10, fat: 2,
    servingSize: '100 g', servingUnit: 'g', source: 'usda', confidencePenalty: 10,
    scaledNutrition: { calories: ingredient.quantity, protein: ingredient.quantity / 10, carbs: ingredient.quantity / 10, fat: ingredient.quantity / 50 },
  }));
  const result = await analyzeFoodImageAdvanced('file:///photo.jpg', 'jpeg');
  expect(result.success).toBe(true);
  expect(result.data?.ingredients).toHaveLength(2);
  expect(result.data?.ingredients[0]).toEqual(expect.objectContaining({ unit: 'g', source: 'usda' }));
  expect(result.data?.totalNutrition.calories).toBe(290);
  expect(result.data?.warnings).toContain('Cooking oil cannot be measured from this photo.');
});
it('preserves label serving text and refuses missing nutrition instead of inventing zeros', async () => {
  vision.mockResolvedValue(JSON.stringify({ servingSize: '1 cup (240ml)', calories: 120, protein: 8, carbs: 12, fat: 4, confidence: 95 }));
  const result = await extractNutritionFromLabel('jpeg');
  expect(result.success).toBe(true);
  expect(result.data?.ingredients[0].nutrition.servingSize).toBe('1 cup (240ml)');
  expect(result.data?.ingredients[0].unit).toBe('serving');
  vision.mockResolvedValue(JSON.stringify({ servingSize: '1 cup (240ml)', calories: null, protein: 8, carbs: 12, fat: 4, confidence: 50 }));
  expect((await extractNutritionFromLabel('jpeg')).success).toBe(false);
});
