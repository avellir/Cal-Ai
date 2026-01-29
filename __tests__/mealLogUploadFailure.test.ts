// Tests upload failure handling (Property 2: upload failure preserves local URI)

const profileId = 'profile-123';
const mealId = 'meal-456';

// Minimal Supabase client mock to satisfy the calls within logMeal
const loggedMealsUpdate = jest.fn(() => ({
  eq: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('@/services/mealPhotoStorage', () => ({
  uploadMealPhoto: jest.fn(async () => ({
    success: false,
    error: 'upload failed',
  })),
  deleteMealPhoto: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      switch (table) {
        case 'profiles': {
          const query: any = {};
          query.select = jest.fn(() => query);
          query.eq = jest.fn(() => query);
          query.maybeSingle = jest.fn(async () => ({ data: { id: profileId }, error: null }));
          return query;
        }
        case 'food_items': {
          const single = jest.fn(async () => ({
            data: {
              id: 'food-1',
              name: 'Test Meal',
              calories: 100,
              protein: 10,
              carbs: 10,
              fat: 10,
              serving_unit: null,
            },
            error: null,
          }));
          const selector = { single };
          const inserter = {
            select: jest.fn(() => selector),
          };
          return {
            insert: jest.fn(() => inserter),
          };
        }
        case 'logged_meals': {
          const single = jest.fn(async () => ({
            data: {
              id: mealId,
              logged_at: new Date().toISOString(),
              meal_type: 'snack',
              notes: null,
            },
            error: null,
          }));
          const selector = { single };
          const inserter = {
            select: jest.fn(() => selector),
          };
          return {
            insert: jest.fn(() => inserter),
            update: loggedMealsUpdate,
          };
        }
        case 'meal_entries': {
          const single = jest.fn(async () => ({
            data: {
              id: 'entry-1',
              quantity: 1,
              serving_size_override: null,
              food_items: {
                id: 'food-1',
                name: 'Test Meal',
                calories: 100,
                protein: 10,
                carbs: 10,
                fat: 10,
                serving_unit: null,
              },
            },
            error: null,
          }));
          const selector = { single };
          const inserter = {
            select: jest.fn(() => selector),
          };
          return {
            insert: jest.fn(() => inserter),
          };
        }
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    }),
  },
}));

import { logMeal } from '@/services/mealLog';

describe('logMeal upload failure handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserves local URI and does not set imageUrl when upload fails (Property 2)', async () => {
    // UUID must match the regex: version 1-5 at position 15, variant 8-b at position 20
    const result = await logMeal('00000000-0000-4000-a000-000000000001', {
      name: 'Test Meal',
      calories: 100,
      macros: { protein: 10, carbs: 10, fat: 10 },
      imageUri: 'local://image',
    });

    expect(result.imageUri).toBe('local://image');
    expect(result.imageUrl).toBeNull();
    // No update call should be made because upload failed
    expect(loggedMealsUpdate).not.toHaveBeenCalled();
  });
});
