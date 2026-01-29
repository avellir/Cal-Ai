/**
 * TypeScript types for personalized nutrition goals feature
 */

/**
 * Unit system for height and weight measurements
 */
export type UnitSystem = 'imperial' | 'metric';

/**
 * User's fitness goal type
 */
export type GoalType = 'lose' | 'gain';

/**
 * Data collected during the goal flow process
 * Used to store user inputs across all steps
 */
export type GoalFlowData = {
  // Step 1: Height & Weight
  unitSystem: UnitSystem;
  heightCm: number;
  weightKg: number;
  
  // Step 2: Birthdate
  birthdate: Date;
  age: number;

  // Step 3: Personal details for calculations
  sex: Sex;
  activityLevel: ActivityLevel;
  
  // Step 3: Goal
  goalType: GoalType;
  
  // Step 4: Target Weight
  targetWeightKg: number;
  
  // Calculated (Step 6)
  dailyCalories: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFat: number;
};

/**
 * User goal record from Supabase database
 * Represents a persisted nutrition goal
 */
export type UserGoal = {
  id: string;
  userId: string;
  heightCm: number;
  weightKg: number;
  birthdate: string; // ISO date string from database
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  targetWeightKg: number;
  dailyCalories: number;
  dailyProteinG: number;
  dailyCarbsG: number;
  dailyFatG: number;
  createdAt: string; // ISO timestamp string from database
  updatedAt: string; // ISO timestamp string from database
};

/**
 * Daily nutrition progress tracking
 * Calculates remaining macros based on consumed meals
 */
export type DailyNutritionProgress = {
  caloriesTarget: number;
  caloriesConsumed: number;
  caloriesRemaining: number;
  
  proteinTarget: number;
  proteinConsumed: number;
  proteinRemaining: number;
  
  carbsTarget: number;
  carbsConsumed: number;
  carbsRemaining: number;
  
  fatTarget: number;
  fatConsumed: number;
  fatRemaining: number;
  
  percentageConsumed: number;
};

/**
 * Database row type for user_goals table
 * Matches the Supabase schema exactly
 * Note: age is not stored, it's calculated from birthdate
 */
export type UserGoalRow = {
  id: string;
  user_id: string;
  height_cm: number;
  weight_kg: number;
  birthdate: string;
  sex: Sex;
  activity_level: ActivityLevel;
  goal_type: GoalType;
  target_weight_kg: number;
  daily_calories: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
  created_at: string;
  updated_at: string;
};

/**
 * Input type for creating or updating user goals
 * Used when saving goal flow data to database
 */
export type UserGoalInput = {
  user_id: string;
  height_cm: number;
  weight_kg: number;
  birthdate: string;
  sex: Sex;
  activity_level: ActivityLevel;
  goal_type: GoalType;
  target_weight_kg: number;
  daily_calories: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
};

/**
 * Activity level for TDEE calculation
 * Currently using 'sedentary' as default for MVP
 */
export type ActivityLevel = 
  | 'sedentary'    // Little or no exercise (1.2x)
  | 'light'        // Light exercise 1-3 days/week (1.375x)
  | 'moderate'     // Moderate exercise 3-5 days/week (1.55x)
  | 'active'       // Hard exercise 6-7 days/week (1.725x)
  | 'veryActive';  // Very hard exercise & physical job (1.9x)

/**
 * Sex/gender for BMR calculation
 * Currently using 'male' as default for MVP
 */
export type Sex = 'male' | 'female';

/**
 * Nutrition plan calculation result
 * Returned by the calculation service
 */
export type NutritionPlan = {
  dailyCalories: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFat: number;
  estimatedWeeksToGoal: number;
};


/**
 * Calculate age from birthdate
 * @param birthdate - Date object or ISO date string
 * @returns Age in years
 */
export function calculateAge(birthdate: Date | string): number {
  const birth = typeof birthdate === 'string' ? new Date(birthdate) : birthdate;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  // Adjust if birthday hasn't occurred this year yet
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}
