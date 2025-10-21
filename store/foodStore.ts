import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FoodLog = {
  id: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  imageUri?: string;
  timestamp: number;
};

type FoodStore = {
  foodLogs: FoodLog[];
  addFoodLog: (log: Omit<FoodLog, 'id' | 'timestamp'>) => void;
  getRecentLog: () => FoodLog | null;
  clearLogs: () => void;
};

export const useFoodStore = create<FoodStore>()(
  persist(
    (set, get) => ({
      foodLogs: [],
      
      addFoodLog: (log) => {
        const newLog: FoodLog = {
          ...log,
          id: Date.now().toString(),
          timestamp: Date.now(),
        };
        
        set((state) => ({
          foodLogs: [newLog, ...state.foodLogs],
        }));
      },
      
      getRecentLog: () => {
        const logs = get().foodLogs;
        return logs.length > 0 ? logs[0] : null;
      },
      
      clearLogs: () => {
        set({ foodLogs: [] });
      },
    }),
    {
      name: 'food-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

