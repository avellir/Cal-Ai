export type NutritionValues = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** Values apply to basisAmount/basisUnit, never to an arbitrary portion. */
export type NutritionReference = {
  id: string;
  name: string;
  source: 'usda' | 'manual';
  sourceUrl?: string;
  basisAmount: number;
  basisUnit: 'g' | 'ml' | 'serving';
  nutrients: NutritionValues;
  servings: { name: string; grams: number }[];
  recipeAverage?: boolean;
  matchQuality?: 'exact' | 'approximate';
  matchReason?: string;
};

export type NutritionFoodContext = {
  foodName?: string;
  preparation?: string;
  dishName?: string;
  visualEvidence?: string;
};

export type NutritionLookupItem = {
  query: string;
  match: NutritionReference | null;
  candidates: NutritionReference[];
  reason?: string;
};
