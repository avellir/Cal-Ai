import type { AddMealInput } from '@/lib/meal-log-types';
import { supabase } from '@/lib/supabase';
import { getMealInputFromAnalysis, type SuccessfulAnalysisData } from '@/services/foodAnalysis';
import { fetchLoggedMeals, logMeal } from '@/services/mealLog';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/services/advancedFoodAnalysis', () => ({ analyzeFoodImageAdvanced: jest.fn() }));
jest.mock('@/services/mealPhotoStorage', () => ({
  uploadMealPhoto: jest.fn(),
  deleteMealPhoto: jest.fn(),
  getSignedPhotoUrl: jest.fn(),
}));

const userId = '00000000-0000-4000-a000-000000000001';
const analysis: SuccessfulAnalysisData = {
  totalNutrition: { calories: 500, protein: 30.5, carbs: 60.25, fat: 15.75 },
  ingredients: [],
  regions: [{ description: 'A bowl of food', dishName: 'Test bowl', confidence: 85 }],
  confidence: 85,
};

type StoredFood = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_unit: string | null;
};
type StoredMeal = {
  id: string;
  logged_at: string;
  meal_type: string;
  notes: string | null;
  image_url: null;
};

let food: StoredFood;
let meal: StoredMeal;
let quantity: number;

// Echo inserted values back as a database join, rather than hardcoding nutrition
// in the response: a second application of the multiplier must fail these tests.
const joinedEntry = () => ({
  id: 'entry-1',
  quantity,
  serving_size_override: null,
  food_items: food,
});

beforeEach(() => {
  jest.clearAllMocks();
  quantity = 1;
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    switch (table) {
      case 'profiles':
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: userId }, error: null }) }) }),
        };
      case 'food_items':
        return {
          insert: (row: Omit<StoredFood, 'id'>) => {
            food = { ...row, id: 'food-1' };
            return { select: () => ({ single: async () => ({ data: food, error: null }) }) };
          },
        };
      case 'logged_meals':
        return {
          insert: (row: Pick<StoredMeal, 'meal_type' | 'notes'> & { logged_at?: string }) => {
            meal = { ...row, id: 'meal-1', logged_at: row.logged_at ?? '2026-09-25T12:00:00Z', image_url: null };
            return { select: () => ({ single: async () => ({ data: meal, error: null }) }) };
          },
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [{ ...meal, meal_entries: [joinedEntry()] }], error: null }),
            }),
          }),
        };
      case 'meal_entries':
        return {
          insert: (row: { quantity: number }) => {
            quantity = row.quantity;
            return { select: () => ({ single: async () => ({ data: joinedEntry(), error: null }) }) };
          },
        };
      default:
        throw new Error(`Unexpected table: ${table}`);
    }
  });
});

describe('analysis portions through meal save and reload', () => {
  it.each([
    [0.5, 250],
    [1, 500],
    [1.5, 750],
    [2, 1000],
  ])('saves a %sx portion as %s calories', async (multiplier, expectedCalories) => {
    const input = getMealInputFromAnalysis(analysis, multiplier);
    const saved = await logMeal(userId, input);
    const [reloaded] = await fetchLoggedMeals(userId);

    expect(food.calories).toBe(500);
    expect(quantity).toBe(multiplier);
    for (const result of [saved, reloaded]) {
      expect(result.calories).toBe(expectedCalories);
      expect(result.macros.protein).toBeCloseTo(30.5 * multiplier);
      expect(result.macros.carbs).toBeCloseTo(60.25 * multiplier);
      expect(result.macros.fat).toBeCloseTo(15.75 * multiplier);
      expect(result.name).toBe('Test bowl');
      expect(result.note).toBe(multiplier === 1 ? '1 serving' : `1 serving (${multiplier}×)`);
    }
  });

  it.each([[0.5, 250], [1.5, 751], [2, 1001]])('rounds a fractional estimate at %sx to %s calories after scaling', async (multiplier, expectedCalories) => {
    const input = getMealInputFromAnalysis({
      ...analysis,
      totalNutrition: { ...analysis.totalNutrition, calories: 500.5 },
    }, multiplier);
    const saved = await logMeal(userId, input);
    const [reloaded] = await fetchLoggedMeals(userId);

    expect(food.calories).toBe(500.5);
    expect(saved.calories).toBe(expectedCalories);
    expect(reloaded.calories).toBe(expectedCalories);
  });

  it('defaults omitted quantity to one serving', async () => {
    const input: AddMealInput = { name: 'Manual meal', calories: 400, macros: { protein: 20, carbs: 50, fat: 10 } };
    expect((await logMeal(userId, input)).calories).toBe(400);
    expect(quantity).toBe(1);
  });

  it('preserves the edited meal date/type and base nutrition through saving and reloading', async () => {
    const loggedAt = '2026-09-20T12:30:00.000Z';
    const input = getMealInputFromAnalysis(analysis, 2, undefined, { loggedAt, mealType: 'lunch' });
    const saved = await logMeal(userId, { ...input, name: 'Edited bowl', calories: 600 });
    const [reloaded] = await fetchLoggedMeals(userId);
    for (const result of [saved, reloaded]) {
      expect(result.timestamp).toBe(new Date(loggedAt).getTime());
      expect(result.mealType).toBe('lunch');
      expect(result.name).toBe('Edited bowl');
      expect(result.calories).toBe(1200);
    }
  });

  it.each([0, -1, NaN, Infinity])('rejects invalid quantity %s before writing any records', async (multiplier) => {
    await expect(logMeal(userId, getMealInputFromAnalysis(analysis, multiplier)))
      .rejects.toThrow('Meal quantity must be a positive finite number.');
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
