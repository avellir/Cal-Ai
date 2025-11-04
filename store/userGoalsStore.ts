/**
 * User Goals Store
 * 
 * Zustand store for managing personalized nutrition goals state.
 * Handles fetching, saving, and clearing user goals with Supabase integration.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import type { GoalFlowData, UserGoal } from '@/lib/user-goals-types';
import { getUserGoals, saveUserGoals } from '@/services/userGoals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Daily nutrition targets extracted from user goals
 */
export type DailyTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/**
 * User Goals Store State and Actions
 */
type UserGoalsStore = {
  // State
  goals: UserGoal | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchGoals: (userId: string) => Promise<void>;
  saveGoals: (data: GoalFlowData, userId: string) => Promise<boolean>;
  clearGoals: () => void;
  
  // Computed selectors
  hasGoals: () => boolean;
  getDailyTargets: () => DailyTargets | null;
};

/**
 * Create user goals store with persistence
 * 
 * Persists goals to AsyncStorage for offline access
 */
export const useUserGoalsStore = create<UserGoalsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      goals: null,
      isLoading: false,
      error: null,
      
      /**
       * Fetch user goals from Supabase
       * 
       * Requirement 8.1: Retrieve goals for authenticated user
       * 
       * @param userId - User ID from authentication
       */
      fetchGoals: async (userId: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const { data, error } = await getUserGoals(userId);
          
          if (error) {
            set({ error, isLoading: false });
            return;
          }
          
          set({ goals: data, isLoading: false, error: null });
        } catch (err) {
          console.error('Unexpected error in fetchGoals:', err);
          set({ 
            error: 'Failed to load goals. Please try again.', 
            isLoading: false 
          });
        }
      },
      
      /**
       * Save user goals to Supabase
       * 
       * Creates new record or updates existing one.
       * 
       * Requirements: 8.2, 8.3, 8.4, 8.5, 8.6
       * 
       * @param data - Goal flow data with calculated nutrition values
       * @param userId - User ID from authentication
       * @returns true if save was successful, false otherwise
       */
      saveGoals: async (data: GoalFlowData, userId: string): Promise<boolean> => {
        set({ isLoading: true, error: null });
        
        try {
          const { data: savedGoal, error } = await saveUserGoals(userId, data);
          
          if (error) {
            set({ error, isLoading: false });
            return false;
          }
          
          // Update local state with saved data
          set({ goals: savedGoal, isLoading: false, error: null });
          return true;
        } catch (err) {
          console.error('Unexpected error in saveGoals:', err);
          set({ 
            error: 'Failed to save goals. Please try again.', 
            isLoading: false 
          });
          return false;
        }
      },
      
      /**
       * Clear user goals from store
       * 
       * Resets state to initial values
       */
      clearGoals: () => {
        set({ goals: null, error: null, isLoading: false });
      },
      
      /**
       * Check if user has goals set
       * 
       * @returns true if goals exist, false otherwise
       */
      hasGoals: (): boolean => {
        return get().goals !== null;
      },
      
      /**
       * Get daily nutrition targets from goals
       * 
       * Extracts calorie and macro targets for easy access
       * 
       * @returns DailyTargets object or null if no goals set
       */
      getDailyTargets: (): DailyTargets | null => {
        const { goals } = get();
        
        if (!goals) {
          return null;
        }
        
        return {
          calories: goals.dailyCalories,
          protein: goals.dailyProteinG,
          carbs: goals.dailyCarbsG,
          fat: goals.dailyFatG,
        };
      },
    }),
    {
      name: 'user-goals-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist goals, not loading/error states
      partialize: (state) => ({ goals: state.goals }),
    }
  )
);
