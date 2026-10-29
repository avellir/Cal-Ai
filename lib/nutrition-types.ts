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
  source: 'fatsecret' | 'manual';
  sourceUrl?: string;
  basisAmount: number;
  basisUnit: 'g' | 'ml' | 'serving';
  nutrients: NutritionValues;
  servings: { name: string; grams: number; volumeMl?: number }[];
  recipeAverage?: boolean;
  matchQuality?: 'exact' | 'approximate';
  matchReason?: string;
};

export type NutritionFoodContext = {
  foodName?: string;
  preparation?: string;
  dishName?: string;
  visualEvidence?: string;
  unit?: 'g' | 'ml' | 'serving';
  representation?: 'whole_dish' | 'component';
  identityUncertain?: boolean;
  nutritionIdentityKnown?: boolean;
  identityAlternatives?: string[];
};

export type NutritionLookupFailure = {
  stage: 'search' | 'selection' | 'details';
  code: 'temporary' | 'authentication' | 'quota' | 'configuration' | 'invalid_response' | 'unavailable' | 'timeout' | 'cancelled';
  retryable: boolean;
  attempts: number;
};

export type NutritionLookupItem = {
  query: string;
  match: NutritionReference | null;
  candidates: NutritionReference[];
  reason?: string;
  failure?: NutritionLookupFailure;
};
