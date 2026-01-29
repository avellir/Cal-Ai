import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { UserWeightEntry } from '@/lib/user-weight-entries-types';
import { addUserWeightEntry, getLatestUserWeightEntry } from '@/services/userWeightEntries';

type UserWeightLogStore = {
  latest: UserWeightEntry | null;
  isLoading: boolean;
  error: string | null;

  fetchLatest: (userId: string) => Promise<void>;
  addToday: (userId: string, weightKg: number) => Promise<boolean>;
  clear: () => void;
};

export const useUserWeightLogStore = create<UserWeightLogStore>()(
  persist(
    (set) => ({
      latest: null,
      isLoading: false,
      error: null,

      fetchLatest: async (userId: string) => {
        set({ isLoading: true, error: null });

        try {
          const { data, error } = await getLatestUserWeightEntry(userId);

          if (error) {
            set({ error, isLoading: false });
            return;
          }

          set({ latest: data, isLoading: false, error: null });
        } catch (err) {
          console.error('Unexpected error in fetchLatest:', err);
          set({ error: 'Failed to load weight. Please try again.', isLoading: false });
        }
      },

      addToday: async (userId: string, weightKg: number) => {
        set({ isLoading: true, error: null });

        try {
          const { data, error } = await addUserWeightEntry(userId, weightKg, new Date());

          if (error) {
            set({ error, isLoading: false });
            return false;
          }

          set({ latest: data, isLoading: false, error: null });
          return true;
        } catch (err) {
          console.error('Unexpected error in addToday:', err);
          set({ error: 'Failed to save weight. Please try again.', isLoading: false });
          return false;
        }
      },

      clear: () => set({ latest: null, isLoading: false, error: null }),
    }),
    {
      name: 'user-weight-log-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ latest: state.latest }),
    }
  )
);

