/**
 * Nutrition Aggregation Service
 * 
 * Utilities for aggregating daily meal nutrition data.
 * Calculates total calories and macros from logged meals for the current day.
 * 
 * Requirements: 11.2, 12.2, 12.3, 12.4
 */

import type { MealLogEntry } from '@/lib/meal-log-types';

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
 * Check if a timestamp is from today
 * 
 * @param timestamp - Unix timestamp in milliseconds
 * @returns true if timestamp is from today, false otherwise
 */
function isToday(timestamp: number): boolean {
  const date = new Date(timestamp);
  const today = new Date();
  
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Aggregate daily meal nutrition
 * 
 * Sums calories, protein, carbs, and fat from all meals logged today.
 * Filters meals by current date before aggregating.
 * 
 * Requirements: 11.2, 12.2, 12.3, 12.4
 * 
 * @param meals - Array of meal log entries
 * @returns Aggregated nutrition totals for today
 */
export function aggregateDailyNutrition(meals: MealLogEntry[]): DailyNutritionTotals {
  // Filter meals to only include today's entries
  const todaysMeals = meals.filter((meal) => isToday(meal.timestamp));
  
  // Sum up all nutrition values
  const totals = todaysMeals.reduce(
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
