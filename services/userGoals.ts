/**
 * User Goals Service
 * 
 * Supabase service functions for CRUD operations on user_goals table.
 * Handles fetching, creating, and updating personalized nutrition goals.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import { supabase } from '@/lib/supabase';
import type { GoalFlowData, UserGoal, UserGoalInput, UserGoalRow } from '@/lib/user-goals-types';
import { calculateAge } from '@/lib/user-goals-types';

/**
 * Service response type for error handling
 */
export type ServiceResponse<T> = {
  data: T | null;
  error: string | null;
};

/**
 * Convert database row to UserGoal type
 * Transforms snake_case to camelCase and calculates age
 */
function rowToUserGoal(row: UserGoalRow): UserGoal {
  return {
    id: row.id,
    userId: row.user_id,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    birthdate: row.birthdate,
    age: calculateAge(row.birthdate),
    sex: row.sex ?? 'male',
    activityLevel: row.activity_level ?? 'sedentary',
    goalType: row.goal_type,
    targetWeightKg: row.target_weight_kg,
    dailyCalories: row.daily_calories,
    dailyProteinG: row.daily_protein_g,
    dailyCarbsG: row.daily_carbs_g,
    dailyFatG: row.daily_fat_g,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetch user goals from Supabase
 * 
 * Requirement 8.1: Retrieve goals for authenticated user
 * 
 * @param userId - User ID from authentication
 * @returns ServiceResponse with UserGoal or error
 */
export async function getUserGoals(userId: string): Promise<ServiceResponse<UserGoal>> {
  try {
    const { data, error } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // Handle case where no goals exist (not an error)
      if (error.code === 'PGRST116') {
        return { data: null, error: null };
      }
      
      console.error('Error fetching user goals:', error);
      return { 
        data: null, 
        error: 'Failed to fetch goals. Please try again.' 
      };
    }

    return { 
      data: rowToUserGoal(data as UserGoalRow), 
      error: null 
    };
  } catch (err) {
    console.error('Unexpected error fetching user goals:', err);
    return { 
      data: null, 
      error: 'An unexpected error occurred. Please check your connection.' 
    };
  }
}

/**
 * Save or update user goals in Supabase
 * 
 * Uses upsert to create new record or update existing one.
 * 
 * Requirements: 8.2, 8.3, 8.4
 * 
 * @param userId - User ID from authentication
 * @param goalData - Goal flow data with calculated nutrition values
 * @returns ServiceResponse with saved UserGoal or error
 */
export async function saveUserGoals(
  userId: string,
  goalData: GoalFlowData
): Promise<ServiceResponse<UserGoal>> {
  try {
    // Prepare input data for database
    const input: UserGoalInput = {
      user_id: userId,
      height_cm: goalData.heightCm,
      weight_kg: goalData.weightKg,
      birthdate: goalData.birthdate.toISOString().split('T')[0], // YYYY-MM-DD format
      sex: goalData.sex,
      activity_level: goalData.activityLevel,
      goal_type: goalData.goalType,
      target_weight_kg: goalData.targetWeightKg,
      daily_calories: goalData.dailyCalories,
      daily_protein_g: goalData.dailyProtein,
      daily_carbs_g: goalData.dailyCarbs,
      daily_fat_g: goalData.dailyFat,
    };

    // Upsert: insert or update if user_id already exists
    const { data, error } = await supabase
      .from('user_goals')
      .upsert(input, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST204') {
        return {
          data: null,
          error:
            'Your Supabase schema is missing new columns (sex/activity_level). Apply migration 20260129000000_add_sex_activity_and_weight_entries.sql, then refresh the API schema cache and try again.',
        };
      }
      console.error('Error saving user goals:', error);
      return { 
        data: null, 
        error: 'Unable to save goals. Please check your connection.' 
      };
    }

    return { 
      data: rowToUserGoal(data as UserGoalRow), 
      error: null 
    };
  } catch (err) {
    console.error('Unexpected error saving user goals:', err);
    return { 
      data: null, 
      error: 'An unexpected error occurred. Please try again.' 
    };
  }
}

export type PatchUserGoalsInput = Partial<
  Pick<
    UserGoalInput,
    | 'height_cm'
    | 'weight_kg'
    | 'birthdate'
    | 'sex'
    | 'activity_level'
    | 'daily_calories'
    | 'daily_protein_g'
    | 'daily_carbs_g'
    | 'daily_fat_g'
  >
>;

/**
 * Patch user goals fields in Supabase
 *
 * Used for updating personal info fields (sex, activity, metrics) without re-running the full flow.
 */
export async function patchUserGoals(
  userId: string,
  updates: PatchUserGoalsInput
): Promise<ServiceResponse<UserGoal>> {
  try {
    const { data, error } = await supabase
      .from('user_goals')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST204') {
        return {
          data: null,
          error:
            'Your Supabase schema is missing new columns (sex/activity_level). Apply migration 20260129000000_add_sex_activity_and_weight_entries.sql, then refresh the API schema cache and try again.',
        };
      }
      console.error('Error patching user goals:', error);
      return {
        data: null,
        error: 'Unable to update. Please try again.',
      };
    }

    return {
      data: rowToUserGoal(data as UserGoalRow),
      error: null,
    };
  } catch (err) {
    console.error('Unexpected error patching user goals:', err);
    return {
      data: null,
      error: 'An unexpected error occurred. Please try again.',
    };
  }
}

/**
 * Delete user goals from Supabase
 * 
 * @param userId - User ID from authentication
 * @returns ServiceResponse with success status or error
 */
export async function deleteUserGoals(userId: string): Promise<ServiceResponse<boolean>> {
  try {
    const { error } = await supabase
      .from('user_goals')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting user goals:', error);
      return { 
        data: null, 
        error: 'Failed to delete goals. Please try again.' 
      };
    }

    return { data: true, error: null };
  } catch (err) {
    console.error('Unexpected error deleting user goals:', err);
    return { 
      data: null, 
      error: 'An unexpected error occurred. Please try again.' 
    };
  }
}
