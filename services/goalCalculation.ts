/**
 * Goal Calculation Service
 * 
 * Implements nutritional calculations for personalized nutrition goals:
 * - BMR (Basal Metabolic Rate) using Mifflin-St Jeor equation
 * - TDEE (Total Daily Energy Expenditure)
 * - Daily calorie targets based on fitness goals (uses activity + sex)
 * - Macronutrient targets (protein, carbs, fat)
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

const KCAL_PER_KG_WEIGHT_CHANGE = 7700;

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
 * Minimum safe daily calorie intake
 * Requirement 9.6
 */
const MINIMUM_CALORIES_BY_SEX: Record<Sex, number> = {
  female: 1200,
  male: 1500,
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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
 * Uses a percent-based adjustment of TDEE (more adaptive across body sizes):
 * - Lose weight: ~20% deficit (clamped)
 * - Gain weight: ~10% surplus (clamped)
 * 
 * Ensures minimum safe calorie intake (sex-based)
 * 
 * Requirements 9.3, 9.4, 9.5, 9.6
 * 
 * @param tdee - Total Daily Energy Expenditure
 * @param goalType - Fitness goal ('lose' or 'gain')
 * @param sex - Biological sex ('male' or 'female')
 * @returns Daily calorie target (rounded to nearest whole number)
 */
export function calculateDailyCalories(
  tdee: number,
  goalType: GoalType,
  sex: Sex = 'male'
): number {
  const adjustment =
    goalType === 'lose'
      ? clamp(tdee * 0.2, 250, 800)
      : clamp(tdee * 0.1, 150, 500);

  const minimum = MINIMUM_CALORIES_BY_SEX[sex] ?? MINIMUM_CALORIES_BY_SEX.male;
  const targetCalories = Math.max(goalType === 'lose' ? tdee - adjustment : tdee + adjustment, minimum);

  // Round to nearest whole number (Requirement 9.5)
  return Math.round(targetCalories);
}

/**
 * Calculate macronutrient targets from daily calories and user inputs
 * 
 * Strategy:
 * - Protein is set by activity level and goal (g/kg), then clamped to a calories share
 * - Fat is set to a calories share with a minimum g/kg
 * - Carbs are the remaining calories
 * 
 * All values rounded to nearest whole number
 * 
 * Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 * 
 * @param dailyCalories - Target daily calorie intake
 * @param weightKg - Current weight in kilograms
 * @param goalType - Fitness goal ('lose' or 'gain')
 * @param activityLevel - Activity level
 * @returns Object with protein, carbs, and fat in grams
 */
export function calculateMacros(
  dailyCalories: number,
  weightKg: number,
  goalType: GoalType,
  activityLevel: ActivityLevel = 'sedentary'
): {
  protein: number;
  carbs: number;
  fat: number;
} {
  const proteinGPerKgByActivity: Record<ActivityLevel, number> = {
    sedentary: 1.4,
    light: 1.6,
    moderate: 1.8,
    active: 2.0,
    veryActive: 2.2,
  };

  const proteinBonus = goalType === 'lose' ? 0.2 : 0;
  const desiredProteinG = weightKg * clamp((proteinGPerKgByActivity[activityLevel] ?? 1.6) + proteinBonus, 1.2, 2.4);
  const proteinCaloriesCap = dailyCalories * (goalType === 'lose' ? 0.45 : 0.4);
  const proteinCalories = Math.min(desiredProteinG * CALORIES_PER_GRAM.protein, proteinCaloriesCap);
  const protein = Math.max(0, Math.round(proteinCalories / CALORIES_PER_GRAM.protein));

  const minFatG = weightKg * 0.6;
  const desiredFatCaloriesShare = goalType === 'lose' ? 0.25 : 0.3;
  const fatCaloriesCap = dailyCalories * 0.35;
  let fatCalories = clamp(dailyCalories * desiredFatCaloriesShare, minFatG * CALORIES_PER_GRAM.fat, fatCaloriesCap);
  let fat = Math.max(0, Math.round(fatCalories / CALORIES_PER_GRAM.fat));

  // Fit macros into the calorie budget. If we run out, reduce fat first, then protein.
  let remainingCalories = dailyCalories - (protein * CALORIES_PER_GRAM.protein) - (fat * CALORIES_PER_GRAM.fat);
  if (remainingCalories < 0) {
    const maxFatCalories = Math.max(0, dailyCalories - (protein * CALORIES_PER_GRAM.protein));
    const minFatCalories = Math.max(0, minFatG * CALORIES_PER_GRAM.fat);
    fatCalories = Math.max(minFatCalories, maxFatCalories);
    fat = Math.max(0, Math.floor(fatCalories / CALORIES_PER_GRAM.fat));
    remainingCalories = dailyCalories - (protein * CALORIES_PER_GRAM.protein) - (fat * CALORIES_PER_GRAM.fat);
  }

  if (remainingCalories < 0) {
    const maxProteinCalories = Math.max(0, dailyCalories - (fat * CALORIES_PER_GRAM.fat));
    const nextProtein = Math.max(0, Math.floor(maxProteinCalories / CALORIES_PER_GRAM.protein));
    remainingCalories = dailyCalories - (nextProtein * CALORIES_PER_GRAM.protein) - (fat * CALORIES_PER_GRAM.fat);
    return { protein: nextProtein, carbs: 0, fat };
  }

  const carbs = Math.max(0, Math.floor(remainingCalories / CALORIES_PER_GRAM.carbs));

  return { protein, carbs, fat };
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
  const dailyCalories = calculateDailyCalories(tdee, goalType, sex);
  
  // Step 4: Calculate macros
  const macros = calculateMacros(dailyCalories, weightKg, goalType, activityLevel);
  
  // Step 5: Estimate timeline
  const weightDifferenceKg = Math.abs(targetWeightKg - weightKg);
  const adjustment =
    goalType === 'lose'
      ? clamp(tdee * 0.2, 250, 800)
      : clamp(tdee * 0.1, 150, 500);
  const estimatedWeeklyChangeKg = (adjustment * 7) / KCAL_PER_KG_WEIGHT_CHANGE;
  const estimatedWeeksToGoal = Math.max(1, Math.ceil(weightDifferenceKg / Math.max(estimatedWeeklyChangeKg, 0.01)));
  
  return {
    dailyCalories,
    dailyProtein: macros.protein,
    dailyCarbs: macros.carbs,
    dailyFat: macros.fat,
    estimatedWeeksToGoal,
  };
}
