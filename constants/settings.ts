import type { ActivityLevel } from '@/lib/user-goals-types';

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

