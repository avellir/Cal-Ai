export type MealMacroSummary = {
  protein: number;
  carbs: number;
  fat: number;
};

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type MealLogEntry = {
  id: string;
  name: string;
  calories: number;
  macros: MealMacroSummary;
  note?: string | null;
  imageUri?: string | null;      // Local cached URI
  imageUrl?: string | null;      // Remote storage URL
  timestamp: number;
  mealType: MealType;
};

export type AddMealInput = {
  name: string;
  calories: number;
  macros: MealMacroSummary;
  note?: string | null;
  servingSizeLabel?: string;
  mealType?: MealType;
  quantity?: number;
  imageUri?: string | null;
};
