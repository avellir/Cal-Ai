import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { AddMealInput, MealLogEntry } from '@/lib/meal-log-types';
import { deleteMeal, fetchLoggedMeals, logMeal } from '@/services/mealLog';

const IMAGE_CACHE_KEY = 'meal-images-cache';

type MealLogStatus = 'idle' | 'loading';

type ImageCache = Record<string, string>; // mealId -> imageUri

type MealLogState = {
  meals: MealLogEntry[];
  status: MealLogStatus;
  error: string | null;
  imageCache: ImageCache;
  fetchMeals: (userId: string) => Promise<void>;
  addMeal: (userId: string, entry: AddMealInput) => Promise<MealLogEntry>;
  removeMeal: (userId: string, mealId: string) => Promise<void>;
  reset: () => void;
};

// Load image cache from AsyncStorage
async function loadImageCache(): Promise<ImageCache> {
  try {
    const cached = await AsyncStorage.getItem(IMAGE_CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

// Save image cache to AsyncStorage
async function saveImageCache(cache: ImageCache): Promise<void> {
  try {
    await AsyncStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to save image cache:', error);
  }
}

export const useMealLogStore = create<MealLogState>((set, get) => ({
  meals: [],
  status: 'idle',
  error: null,
  imageCache: {},
  fetchMeals: async (userId: string) => {
    set({ status: 'loading', error: null });
    try {
      // Load image cache first
      const imageCache = await loadImageCache();
      
      const meals = await fetchLoggedMeals(userId);
      
      // Merge cached images with fetched meals
      const mealsWithImages = meals.map((meal) => ({
        ...meal,
        imageUri: imageCache[meal.id] ?? meal.imageUri,
      }));
      
      set({ meals: mealsWithImages, status: 'idle', imageCache });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load meals';
      set({ status: 'idle', error: message });
      throw error;
    }
  },
  addMeal: async (userId: string, entry: AddMealInput) => {
    try {
      const savedMeal = await logMeal(userId, entry);
      
      // Cache the image URI if provided
      if (savedMeal.imageUri) {
        const currentCache = get().imageCache;
        const newCache = { ...currentCache, [savedMeal.id]: savedMeal.imageUri };
        await saveImageCache(newCache);
        set((state) => ({
          meals: [savedMeal, ...state.meals],
          imageCache: newCache,
          error: null,
        }));
      } else {
        set((state) => ({
          meals: [savedMeal, ...state.meals],
          error: null,
        }));
      }
      
      return savedMeal;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save meal';
      set({ error: message });
      throw error;
    }
  },
  removeMeal: async (userId: string, mealId: string) => {
    try {
      await deleteMeal(userId, mealId);
      
      // Remove from image cache
      const currentCache = get().imageCache;
      const { [mealId]: _, ...newCache } = currentCache;
      await saveImageCache(newCache);
      
      set((state) => ({
        meals: state.meals.filter((m) => m.id !== mealId),
        imageCache: newCache,
        error: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete meal';
      set({ error: message });
      throw error;
    }
  },
  reset: () => set({ meals: [], status: 'idle', error: null, imageCache: {} }),
}));
