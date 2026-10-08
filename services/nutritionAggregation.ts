/**
 * Nutrition Aggregation Service
 * 
 * Utilities for aggregating daily meal nutrition data.
 * Calculates calories and macros for a selected local calendar day.
 * 
 * Requirements: 11.2, 12.2, 12.3, 12.4
 */

import type { MealLogEntry } from '@/lib/meal-log-types';
import { getLocalDayBounds } from '@/lib/mealDates';

/**
 * Aggregated daily nutrition totals
 */
export type DailyNutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/**
 * Select one local day's meals, newest first, without mutating the store.
 */
export function getMealsForDate(meals: MealLogEntry[], date: Date): MealLogEntry[] {
  const { start, end } = getLocalDayBounds(date);
  return meals
    .filter(meal => meal.timestamp >= start && meal.timestamp < end)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Aggregate daily meal nutrition
 * 
 * Sums calories, protein, carbs, and fat for a selected day (today by default).
 * 
 * Requirements: 11.2, 12.2, 12.3, 12.4
 * 
 * @param meals - Array of meal log entries
 * @param date - Local calendar day to aggregate (today by default)
 * @returns Aggregated nutrition totals for the selected day
 */
export function aggregateDailyNutrition(meals: MealLogEntry[], date: Date = new Date()): DailyNutritionTotals {
  const selectedMeals = getMealsForDate(meals, date);
  
  // Sum up all nutrition values
  const totals = selectedMeals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.macros.protein,
      carbs: acc.carbs + meal.macros.carbs,
      fat: acc.fat + meal.macros.fat,
    }),
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    }
  );
  
  return totals;
}
