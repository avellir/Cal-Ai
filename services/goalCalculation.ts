/**
 * Goal Calculation Service
 * 
 * Implements nutritional calculations for personalized nutrition goals:
 * - BMR (Basal Metabolic Rate) using Mifflin-St Jeor equation
 * - TDEE (Total Daily Energy Expenditure)
 * - Daily calorie targets based on fitness goals
 * - Macronutrient distribution (protein, carbs, fat)
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 10.1, 10.2, 10.3, 10.4, 10.5
 */

import type { ActivityLevel, GoalType, NutritionPlan, Sex } from '@/lib/user-goals-types';

/**
 * Calorie constants for macronutrients
 */
const CALORIES_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

/**
 * Macro distribution percentages (30/40/30 split)
 * Requirement 10.1, 10.2, 10.3
 */
const MACRO_PERCENTAGES = {
  protein: 0.30,  // 30% of calories
  carbs: 0.40,    // 40% of calories
  fat: 0.30,      // 30% of calories
} as const;

/**
 * Activity level multipliers for TDEE calculation
 * Requirement 9.2
 */
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,        // Little or no exercise
  light: 1.375,          // Light exercise 1-3 days/week
  moderate: 1.55,        // Moderate exercise 3-5 days/week
  active: 1.725,         // Hard exercise 6-7 days/week
  veryActive: 1.9,       // Very hard exercise & physical job
};

/**
 * Calorie adjustment for weight goals (500 cal/day = ~1 lb/week)
 * Requirements 9.3, 9.4
 */
const CALORIE_ADJUSTMENT = 500;

/**
 * Minimum safe daily calorie intake
 * Requirement 9.6
 */
const MINIMUM_CALORIES = 1200;

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor equation
 * 
 * Formula: BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age) + s
 * where s = +5 for males, -161 for females
 * 
 * Requirement 9.1
 * 
 * @param weightKg - Weight in kilograms
 * @param heightCm - Height in centimeters
 * @param age - Age in years
 * @param sex - Biological sex ('male' or 'female')
 * @returns BMR in calories per day
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex = 'male'
): number {
  // Base calculation
  const baseBMR = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
  
  // Sex-specific adjustment
  const sexAdjustment = sex === 'male' ? 5 : -161;
  
  return baseBMR + sexAdjustment;
}

/**
 * Calculate Total Daily Energy Expenditure
 * 
 * TDEE = BMR × activity level multiplier
 * 
 * Requirement 9.2
 * 
 * @param bmr - Basal Metabolic Rate
 * @param activityLevel - Activity level (default: sedentary for MVP)
 * @returns TDEE in calories per day
 */
export function calculateTDEE(
  bmr: number,
  activityLevel: ActivityLevel = 'sedentary'
): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
}

/**
 * Calculate daily calorie target based on fitness goal
 * 
 * - Lose weight: TDEE - 500 calories (1 lb/week deficit)
 * - Gain weight: TDEE + 500 calories (1 lb/week surplus)
 * 
 * Ensures minimum safe calorie intake of 1200 calories
 * 
 * Requirements 9.3, 9.4, 9.5, 9.6
 * 
 * @param tdee - Total Daily Energy Expenditure
 * @param goalType - Fitness goal ('lose' or 'gain')
 * @returns Daily calorie target (rounded to nearest whole number)
 */
export function calculateDailyCalories(
  tdee: number,
  goalType: GoalType
): number {
  let targetCalories: number;
  
  if (goalType === 'lose') {
    // Create calorie deficit for weight loss
    targetCalories = tdee - CALORIE_ADJUSTMENT;
  } else {
    // Create calorie surplus for weight gain
    targetCalories = tdee + CALORIE_ADJUSTMENT;
  }
  
  // Apply safety minimum (Requirement 9.6)
  targetCalories = Math.max(targetCalories, MINIMUM_CALORIES);
  
  // Round to nearest whole number (Requirement 9.5)
  return Math.round(targetCalories);
}

/**
 * Calculate macronutrient distribution from daily calories
 * 
 * Uses 30/40/30 split:
 * - Protein: 30% of calories / 4 cal per gram
 * - Carbs: 40% of calories / 4 cal per gram
 * - Fat: 30% of calories / 9 cal per gram
 * 
 * All values rounded to nearest whole number
 * 
 * Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 * 
 * @param dailyCalories - Target daily calorie intake
 * @returns Object with protein, carbs, and fat in grams
 */
export function calculateMacros(dailyCalories: number): {
  protein: number;
  carbs: number;
  fat: number;
} {
  // Calculate grams for each macro (Requirements 10.1, 10.2, 10.3)
  const proteinGrams = (dailyCalories * MACRO_PERCENTAGES.protein) / CALORIES_PER_GRAM.protein;
  const carbsGrams = (dailyCalories * MACRO_PERCENTAGES.carbs) / CALORIES_PER_GRAM.carbs;
  const fatGrams = (dailyCalories * MACRO_PERCENTAGES.fat) / CALORIES_PER_GRAM.fat;
  
  // Round all values to nearest whole number (Requirement 10.4)
  return {
    protein: Math.round(proteinGrams),
    carbs: Math.round(carbsGrams),
    fat: Math.round(fatGrams),
  };
}

/**
 * Calculate complete nutrition plan from user data
 * 
 * This is the main pipeline that combines all calculations:
 * 1. Calculate BMR using Mifflin-St Jeor equation
 * 2. Calculate TDEE with activity level
 * 3. Adjust calories based on goal (lose/gain)
 * 4. Calculate macro distribution
 * 5. Estimate timeline to reach goal
 * 
 * @param weightKg - Current weight in kilograms
 * @param heightCm - Height in centimeters
 * @param age - Age in years
 * @param goalType - Fitness goal ('lose' or 'gain')
 * @param targetWeightKg - Target weight in kilograms
 * @param sex - Biological sex (default: 'male' for MVP)
 * @param activityLevel - Activity level (default: 'sedentary' for MVP)
 * @returns Complete nutrition plan with calories, macros, and timeline
 */
export function calculateNutritionPlan(
  weightKg: number,
  heightCm: number,
  age: number,
  goalType: GoalType,
  targetWeightKg: number,
  sex: Sex = 'male',
  activityLevel: ActivityLevel = 'sedentary'
): NutritionPlan {
  // Step 1: Calculate BMR
  const bmr = calculateBMR(weightKg, heightCm, age, sex);
  
  // Step 2: Calculate TDEE
  const tdee = calculateTDEE(bmr, activityLevel);
  
  // Step 3: Adjust for goal
  const dailyCalories = calculateDailyCalories(tdee, goalType);
  
  // Step 4: Calculate macros
  const macros = calculateMacros(dailyCalories);
  
  // Step 5: Estimate timeline
  // Weight difference in kg, converted to lbs, divided by 1 lb/week
  const weightDifferenceKg = Math.abs(targetWeightKg - weightKg);
  const weightDifferenceLbs = weightDifferenceKg * 2.20462; // kg to lbs
  const estimatedWeeksToGoal = Math.ceil(weightDifferenceLbs); // ~1 lb per week
  
  return {
    dailyCalories,
    dailyProtein: macros.protein,
    dailyCarbs: macros.carbs,
    dailyFat: macros.fat,
    estimatedWeeksToGoal,
  };
}
