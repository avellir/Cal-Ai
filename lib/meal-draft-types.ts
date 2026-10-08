import type { AdvancedAnalysisResult } from '@/lib/advanced-food-analysis-types';
import type { AddMealInput, MealMacroSummary, MealType } from '@/lib/meal-log-types';

export type MealEditorValues = {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  quantity: string;
  date: string;
  time: string;
  mealType: MealType;
};

export type MealEditorErrors = Partial<Record<keyof MealEditorValues, string>>;

/** In-memory draft; durable recovery and server idempotency are separate work. */
export type MealDraft = {
  version: 1;
  id: string;
  userId: string;
  input: AddMealInput;
  originalAnalysis?: AdvancedAnalysisResult;
  nutritionOverride?: MealMacroSummary & { calories: number };
};
