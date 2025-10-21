import { create } from 'zustand';

import type { AddMealInput, MealLogEntry } from '@/lib/meal-log-types';
import { fetchLoggedMeals, logMeal } from '@/services/mealLog';

type MealLogStatus = 'idle' | 'loading';

type MealLogState = {
  meals: MealLogEntry[];
  status: MealLogStatus;
  error: string | null;
  fetchMeals: (userId: string) => Promise<void>;
  addMeal: (userId: string, entry: AddMealInput) => Promise<MealLogEntry>;
  reset: () => void;
};

export const useMealLogStore = create<MealLogState>((set) => ({
  meals: [],
  status: 'idle',
  error: null,
  fetchMeals: async (userId: string) => {
    set({ status: 'loading', error: null });
    try {
      const meals = await fetchLoggedMeals(userId);
      set({ meals, status: 'idle' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load meals';
      set({ status: 'idle', error: message });
      throw error;
    }
  },
  addMeal: async (userId: string, entry: AddMealInput) => {
    try {
      const savedMeal = await logMeal(userId, entry);
      set((state) => ({
        meals: [savedMeal, ...state.meals],
        error: null,
      }));
      return savedMeal;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save meal';
      set({ error: message });
      throw error;
    }
  },
  reset: () => set({ meals: [], status: 'idle', error: null }),
}));
