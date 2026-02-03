import type { ActivityLevel as GoalsActivityLevel, Sex, UnitSystem } from '@/lib/user-goals-types';

export interface UserProfile {
  email: string;
  name: string;
  heightCm: number | null;
  biologicalSex: Sex | null;
  dateOfBirth: string | null;
}

export type ActivityLevel = GoalsActivityLevel;

export type Units = UnitSystem;

export interface SettingsData {
  profile: UserProfile;
  dailyTargetCalories: number | null;
  activityLevel: ActivityLevel | null;
  units: Units;
  notificationsEnabled: boolean;
}

