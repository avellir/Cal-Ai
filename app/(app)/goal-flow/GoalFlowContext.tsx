/**
 * Goal Flow Context
 * 
 * React Context for managing state across the goal flow screens.
 * Stores all step data and provides actions to update state.
 * 
 * Requirements: 1.3, 2.6, 3.5, 4.5, 5.8
 */

import type { ActivityLevel, GoalType, Sex, UnitSystem } from '@/lib/user-goals-types';
import { useUserGoalsStore } from '@/store/userGoalsStore';
import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Goal flow state type
 * Stores data collected from each step
 */
type GoalFlowState = {
  // Step 1: Height & Weight
  unitSystem: UnitSystem;
  heightCm: number | null;
  weightKg: number | null;

  // Step 2: Birthdate
  birthdate: Date | null;
  age: number | null;

  // Step 3: Personal details for calculations
  sex: Sex;
  activityLevel: ActivityLevel;

  // Step 4: Goal
  goalType: GoalType | null;

  // Step 5: Target Weight
  targetWeightKg: number | null;

  // Step 6: Calculated values
  dailyCalories: number | null;
  dailyProtein: number | null;
  dailyCarbs: number | null;
  dailyFat: number | null;
  estimatedWeeksToGoal: number | null;
};

/**
 * Goal flow context actions
 */
type GoalFlowActions = {
  setHeightWeight: (unitSystem: UnitSystem, heightCm: number, weightKg: number) => void;
  setBirthdate: (birthdate: Date, age: number) => void;
  setSexActivity: (sex: Sex, activityLevel: ActivityLevel) => void;
  setGoal: (goalType: GoalType) => void;
  setTargetWeight: (targetWeightKg: number) => void;
  setCalculatedValues: (
    dailyCalories: number,
    dailyProtein: number,
    dailyCarbs: number,
    dailyFat: number,
    estimatedWeeksToGoal: number
  ) => void;
  clearState: () => void;
  getState: () => GoalFlowState;
};

/**
 * Combined context type
 */
type GoalFlowContextType = GoalFlowState & GoalFlowActions;

/**
 * Initial state
 */
const initialState: GoalFlowState = {
  unitSystem: 'imperial',
  heightCm: null,
  weightKg: null,
  birthdate: null,
  age: null,
  sex: 'male',
  activityLevel: 'sedentary',
  goalType: null,
  targetWeightKg: null,
  dailyCalories: null,
  dailyProtein: null,
  dailyCarbs: null,
  dailyFat: null,
  estimatedWeeksToGoal: null,
};

/**
 * Create context
 */
const GoalFlowContext = createContext<GoalFlowContextType | undefined>(undefined);

/**
 * Goal Flow Provider Component
 * 
 * Wraps the goal flow screens and provides shared state
 */
export function GoalFlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GoalFlowState>(initialState);
  const { goals } = useUserGoalsStore();

  /**
   * Initialize state with existing goals if available
   * Requirement 13.2: Pre-fill goal flow with existing data
   */
  useEffect(() => {
    if (goals) {
      setState({
        unitSystem: 'metric', // Default to metric since we store in metric
        heightCm: goals.heightCm,
        weightKg: goals.weightKg,
        birthdate: new Date(goals.birthdate),
        age: goals.age,
        sex: goals.sex ?? 'male',
        activityLevel: goals.activityLevel ?? 'sedentary',
        goalType: goals.goalType,
        targetWeightKg: goals.targetWeightKg,
        dailyCalories: goals.dailyCalories,
        dailyProtein: goals.dailyProteinG,
        dailyCarbs: goals.dailyCarbsG,
        dailyFat: goals.dailyFatG,
        estimatedWeeksToGoal: null, // Will be recalculated
      });
    }
  }, [goals]);

  /**
   * Update height and weight from Step 1
   */
  const setHeightWeight = (unitSystem: UnitSystem, heightCm: number, weightKg: number) => {
    setState((prev) => ({
      ...prev,
      unitSystem,
      heightCm,
      weightKg,
    }));
  };

  /**
   * Update birthdate and age from Step 2
   */
  const setBirthdate = (birthdate: Date, age: number) => {
    setState((prev) => ({
      ...prev,
      birthdate,
      age,
    }));
  };

  const setSexActivity = (sex: Sex, activityLevel: ActivityLevel) => {
    setState((prev) => ({
      ...prev,
      sex,
      activityLevel,
    }));
  };

  /**
   * Update goal type from Step 3
   */
  const setGoal = (goalType: GoalType) => {
    setState((prev) => ({
      ...prev,
      goalType,
    }));
  };

  /**
   * Update target weight from Step 4
   */
  const setTargetWeight = (targetWeightKg: number) => {
    setState((prev) => ({
      ...prev,
      targetWeightKg,
    }));
  };

  /**
   * Update calculated values from Step 5
   */
  const setCalculatedValues = (
    dailyCalories: number,
    dailyProtein: number,
    dailyCarbs: number,
    dailyFat: number,
    estimatedWeeksToGoal: number
  ) => {
    setState((prev) => ({
      ...prev,
      dailyCalories,
      dailyProtein,
      dailyCarbs,
      dailyFat,
      estimatedWeeksToGoal,
    }));
  };

  /**
   * Clear all state (on completion or cancellation)
   */
  const clearState = () => {
    setState(initialState);
  };

  /**
   * Get current state
   */
  const getState = () => state;

  const value: GoalFlowContextType = {
    ...state,
    setHeightWeight,
    setBirthdate,
    setSexActivity,
    setGoal,
    setTargetWeight,
    setCalculatedValues,
    clearState,
    getState,
  };

  return (
    <GoalFlowContext.Provider value={value}>
      {children}
    </GoalFlowContext.Provider>
  );
}

/**
 * Hook to use goal flow context
 * 
 * @throws Error if used outside of GoalFlowProvider
 */
export function useGoalFlow(): GoalFlowContextType {
  const context = useContext(GoalFlowContext);

  if (context === undefined) {
    throw new Error('useGoalFlow must be used within a GoalFlowProvider');
  }

  return context;
}

export default GoalFlowProvider;
