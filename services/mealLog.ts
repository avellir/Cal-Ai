import type { AddMealInput, MealLogEntry, MealType } from '@/lib/meal-log-types';
import { supabase } from '@/lib/supabase';

type MealEntryRow = {
  id: string;
  quantity: number | null;
  serving_size_override: number | null;
  food_items: {
    id: string;
    name: string;
    calories: number | string | null;
    protein: number | string | null;
    carbs: number | string | null;
    fat: number | string | null;
    serving_unit: string | null;
  } | null;
} | null;

type MealRow = {
  id: string;
  logged_at: string | null;
  meal_type: MealType | null;
  notes: string | null;
  meal_entries: MealEntryRow[] | null;
};

const DEFAULT_MEAL_TYPE: MealType = 'snack';
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertSupabaseUserId(userId: string) {
  if (!UUID_REGEX.test(userId)) {
    throw new Error(
      'Supabase session missing. Sign in with a real Supabase account (e.g., magic link) to sync meals.'
    );
  }
}

export async function ensureProfile(userId: string) {
  assertSupabaseUserId(userId);

  const { data: existingById, error: fetchError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (existingById?.id) {
    return existingById.id;
  }

  const { data: existingByUserId, error: byUserError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (byUserError) {
    throw byUserError;
  }

  if (existingByUserId?.id) {
    if (existingByUserId.id === userId) {
      return existingByUserId.id;
    }

    const { data: migratedProfile, error: migrateError } = await supabase
      .from('profiles')
      .update({ id: userId, user_id: userId })
      .eq('id', existingByUserId.id)
      .select('id')
      .single();

    if (migrateError) {
      throw migrateError;
    }

    return migratedProfile.id;
  }

  const { data: insertedProfile, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      user_id: userId,
    })
    .select('id')
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedProfile.id;
}

export async function fetchLoggedMeals(userId: string): Promise<MealLogEntry[]> {
  const profileId = await ensureProfile(userId);

  const { data, error } = await supabase
    .from('logged_meals')
    .select(
      `
        id,
        logged_at,
        meal_type,
        notes,
        meal_entries (
          id,
          quantity,
          serving_size_override,
          food_items (
            id,
            name,
            calories,
            protein,
            carbs,
            fat,
            serving_unit
          )
        )
      `
    )
    .eq('profile_id', profileId)
    .order('logged_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapMealRowToEntry);
}

export async function logMeal(userId: string, input: AddMealInput): Promise<MealLogEntry> {
  const profileId = await ensureProfile(userId);

  const { data: foodItem, error: foodInsertError } = await supabase
    .from('food_items')
    .insert({
      owner_id: profileId,
      name: input.name,
      brand: null,
      serving_size: null,
      serving_unit: input.servingSizeLabel ?? null,
      calories: input.calories,
      protein: input.macros.protein,
      carbs: input.macros.carbs,
      fat: input.macros.fat,
    })
    .select('id, name, calories, protein, carbs, fat, serving_unit')
    .single();

  if (foodInsertError) {
    throw foodInsertError;
  }

  const { data: meal, error: mealInsertError } = await supabase
    .from('logged_meals')
    .insert({
      profile_id: profileId,
      meal_type: input.mealType ?? DEFAULT_MEAL_TYPE,
      notes: input.note ?? input.servingSizeLabel ?? null,
    })
    .select('id, logged_at, meal_type, notes')
    .single();

  if (mealInsertError) {
    throw mealInsertError;
  }

  const { data: mealEntry, error: entryInsertError } = await supabase
    .from('meal_entries')
    .insert({
      meal_id: meal.id,
      food_id: foodItem.id,
      quantity: input.quantity ?? 1,
    })
    .select(
      `
        id,
        quantity,
        serving_size_override,
        food_items (
          id,
          name,
          calories,
          protein,
          carbs,
          fat,
          serving_unit
        )
      `
    )
    .single();

  if (entryInsertError) {
    throw entryInsertError;
  }

  const mappedEntry = mapMealRowToEntry({
    id: meal.id,
    logged_at: meal.logged_at ?? new Date().toISOString(),
    meal_type: (meal.meal_type ?? DEFAULT_MEAL_TYPE) as MealType,
    notes: meal.notes,
    meal_entries: [mealEntry],
  });

  // Include the imageUri from input (stored locally, not in database)
  return {
    ...mappedEntry,
    imageUri: input.imageUri ?? null,
  };
}

export async function deleteMeal(userId: string, mealId: string): Promise<void> {
  await ensureProfile(userId);

  // Delete the logged meal (cascade will handle meal_entries)
  const { error } = await supabase
    .from('logged_meals')
    .delete()
    .eq('id', mealId);

  if (error) {
    throw error;
  }
}

function mapMealRowToEntry(row: MealRow): MealLogEntry {
  const entries = row.meal_entries ?? [];
  const firstFood = entries.find((entry) => entry?.food_items)?.food_items ?? null;

  let caloriesTotal = 0;
  const macros = entries.reduce(
    (acc, entry) => {
      if (!entry?.food_items) {
        return acc;
      }

      const quantity = typeof entry.quantity === 'number' ? entry.quantity : 1;
      const toNumber = (value: number | string | null | undefined) => {
        if (value == null) {
          return 0;
        }
        return typeof value === 'number' ? value : Number(value) || 0;
      };

      const calories = toNumber(entry.food_items.calories) * (quantity || 1);
      const protein = toNumber(entry.food_items.protein) * (quantity || 1);
      const carbs = toNumber(entry.food_items.carbs) * (quantity || 1);
      const fat = toNumber(entry.food_items.fat) * (quantity || 1);

      caloriesTotal += calories;

      acc.protein += protein;
      acc.carbs += carbs;
      acc.fat += fat;
      return acc;
    },
    { protein: 0, carbs: 0, fat: 0 }
  );

  const timestamp = row.logged_at ? new Date(row.logged_at).getTime() : Date.now();

  return {
    id: row.id,
    name: firstFood?.name ?? 'Logged meal',
    calories: caloriesTotal,
    macros,
    note: row.notes ?? firstFood?.serving_unit ?? null,
    imageUri: null,
    timestamp,
    mealType: (row.meal_type ?? DEFAULT_MEAL_TYPE) as MealType,
  };
}
