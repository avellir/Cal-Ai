import type { ActivityLevel, Units } from '@/app/types/settings';
import type { Sex } from '@/lib/user-goals-types';

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Lightly Active',
  moderate: 'Moderately Active',
  active: 'Active',
  veryActive: 'Very Active',
};

export const ACTIVITY_LEVEL_SUBTITLES: Record<ActivityLevel, string> = {
  sedentary: 'Affects your calorie calculation',
  light: 'Affects your calorie calculation',
  moderate: 'Affects your calorie calculation',
  active: 'Affects your calorie calculation',
  veryActive: 'Affects your calorie calculation',
};

export const SEX_OPTIONS: Array<{ label: string; value: Sex }> = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
];

export const UNIT_OPTIONS: Array<{ label: string; value: Units }> = [
  { label: 'Metric', value: 'metric' },
  { label: 'Imperial', value: 'imperial' },
];

export function calculateAge(dobIsoString: string): number {
  const birthdate = new Date(dobIsoString);
  if (Number.isNaN(birthdate.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  const monthDiff = today.getMonth() - birthdate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

