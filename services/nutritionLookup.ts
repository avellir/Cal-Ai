import { supabase } from '@/lib/supabase';
import type { NutritionFoodContext, NutritionLookupItem, NutritionReference } from '@/lib/nutrition-types';

export function isNutritionReference(value: unknown): value is NutritionReference {
  if (!value || typeof value !== 'object') return false;
  const record = value as NutritionReference;
  return typeof record.id === 'string' && typeof record.name === 'string' &&
    (record.matchQuality === undefined || ['exact', 'approximate'].includes(record.matchQuality)) &&
    (record.matchReason === undefined || typeof record.matchReason === 'string') &&
    ['usda', 'manual'].includes(record.source) && ['g', 'ml', 'serving'].includes(record.basisUnit) &&
    Number.isFinite(record.basisAmount) && record.basisAmount > 0 &&
    !!record.nutrients && ['calories', 'protein', 'carbs', 'fat'].every(key => {
      const number = record.nutrients[key as keyof typeof record.nutrients];
      return typeof number === 'number' && Number.isFinite(number) && number >= 0;
    }) && Array.isArray(record.servings) && record.servings.every(serving =>
      typeof serving.name === 'string' && Number.isFinite(serving.grams) && serving.grams > 0);
}

async function invoke(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again to search nutrition.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), body.mode === 'resolve' ? 65_000 : 30_000);
  try {
    const { data, error } = await supabase.functions.invoke('nutrition-lookup', {
      body, headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal,
    });
    if (error) {
      const response = error.context;
      if (response && typeof response.json === 'function') {
        const detail = await response.json().catch(() => null);
        if (typeof detail?.error === 'string') throw new Error(detail.error);
      }
      throw new Error('Nutrition search is unavailable. Please try again.');
    }
    if (!data || typeof data !== 'object') throw new Error('Invalid nutrition response.');
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function lookupFoodNutrition(queries: string[], contexts?: NutritionFoodContext[]): Promise<NutritionLookupItem[]> {
  if (!queries.length) return [];
  const { results } = await invoke(contexts ? { mode: 'resolve', queries, contexts } : { mode: 'batch', queries });
  if (!Array.isArray(results)) throw new Error('Invalid nutrition response.');
  return queries.map((query, index) => {
    const result = contexts ? results[index] : results.find(item => item?.query === query);
    return {
      query, match: isNutritionReference(result?.match) ? result.match : null,
      candidates: Array.isArray(result?.candidates) ? result.candidates.filter(isNutritionReference) : [],
      reason: typeof result?.reason === 'string' ? result.reason : 'Choose a nutrition reference for this food.',
    };
  });
}

export async function searchNutrition(query: string): Promise<NutritionLookupItem> {
  return (await lookupFoodNutrition([query]))[0];
}

export async function getNutritionReference(id: string): Promise<NutritionReference> {
  const { reference } = await invoke({ mode: 'details', id });
  if (!isNutritionReference(reference)) throw new Error('This food has incomplete nutrition. Choose another record.');
  return reference;
}
