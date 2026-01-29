import { resolveImageUri, useMealLogStore } from '@/lib/meal-log-store';
import type { AddMealInput, MealLogEntry } from '@/lib/meal-log-types';

// AsyncStorage mock with resettable in-memory store
jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string | null> = {};
  const getItem = jest.fn(async (key: string) => store[key] ?? null);
  const setItem = jest.fn(async (key: string, value: string) => {
    store[key] = value;
  });
  const clearStore = () => {
    Object.keys(store).forEach((k) => delete store[k]);
  };
  return {
    __esModule: true,
    default: { getItem, setItem },
    __store: { getItem, setItem, clearStore, store },
  };
});

const asyncMock = jest.requireMock('@react-native-async-storage/async-storage') as {
  __store: {
    getItem: jest.Mock;
    setItem: jest.Mock;
    clearStore: () => void;
    store: Record<string, string | null>;
  };
};

// Mock meal log service to return a deterministic meal entry
const logMealMock = jest.fn(
  async (_userId: string, entry: AddMealInput): Promise<MealLogEntry> => ({
    id: 'meal-1',
    name: entry.name,
    calories: entry.calories,
    macros: entry.macros,
    note: entry.note ?? null,
    imageUri: entry.imageUri ?? null,
    imageUrl: null,
    timestamp: Date.now(),
    mealType: entry.mealType ?? 'snack',
  })
);

jest.mock('@/services/mealLog', () => ({
  logMeal: (...args: Parameters<typeof logMealMock>) => logMealMock(...args),
  deleteMeal: jest.fn(),
  fetchLoggedMeals: jest.fn(),
}));

describe('meal-log-store cache behavior', () => {
  beforeEach(() => {
    // Reset in-memory cache and store state
    asyncMock.__store.clearStore();
    asyncMock.__store.getItem.mockClear();
    asyncMock.__store.setItem.mockClear();
    jest.clearAllMocks();
    useMealLogStore.getState().reset();
  });

  describe('resolveImageUri', () => {
    it('prefers cached URI over remote URL (Property 5: cache preference)', () => {
      const result = resolveImageUri('local://image', 'https://remote/image.jpg');
      expect(result).toBe('local://image');
    });

    it('falls back to remote URL when cache is missing (Property 6: remote fallback)', () => {
      const result = resolveImageUri(null, 'https://remote/image.jpg');
      expect(result).toBe('https://remote/image.jpg');
    });
  });

  describe('addMeal cache storage', () => {
    it('stores local URI in cache after upload (Property 4: cache stores local URI)', async () => {
      const addMeal = useMealLogStore.getState().addMeal;

      await addMeal('user-1', {
        name: 'Test Meal',
        calories: 100,
        macros: { protein: 10, carbs: 10, fat: 10 },
        imageUri: 'local://image',
      });

      expect(logMealMock).toHaveBeenCalledTimes(1);
      // Cache persists to AsyncStorage
      expect(asyncMock.__store.setItem).toHaveBeenCalledWith(
        'meal-images-cache',
        JSON.stringify({ 'meal-1': 'local://image' })
      );
      // Cache is reflected in store state
      const state = useMealLogStore.getState();
      expect(state.imageCache['meal-1']).toBe('local://image');
      expect(state.meals[0]?.imageUri).toBe('local://image');
    });
  });
});
