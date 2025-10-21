import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type UserProfile = {
  age?: number;
  height?: number; // in cm
  weight?: number; // in kg
};

type UserProfileStore = {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
  clearProfile: () => void;
  isProfileComplete: () => boolean;
};

export const useUserProfileStore = create<UserProfileStore>()(
  persist(
    (set, get) => ({
      profile: {},
      
      updateProfile: (updates) => {
        set((state) => ({
          profile: { ...state.profile, ...updates },
        }));
      },
      
      clearProfile: () => {
        set({ profile: {} });
      },
      
      isProfileComplete: () => {
        const { age, height, weight } = get().profile;
        return !!(age && height && weight);
      },
    }),
    {
      name: 'user-profile-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);