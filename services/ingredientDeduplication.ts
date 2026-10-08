import type { Ingredient } from '@/lib/advanced-food-analysis-types';
import { normalizeFoodName } from '@/services/foodNames';

export interface DeduplicationResult {
  uniqueIngredients: Ingredient[];
  mergedCount: number;
  mergeLog: string[];
}

export function normalizeIngredientName(name: string): string {
  return normalizeFoodName(name);
}

// Similar spelling or containment does not establish the same food. Preserve
// rice varieties, preparation, chicken cuts, sauces and composite dishes.
export function areIngredientsSimilar(name1: string, name2: string): { isSimilar: boolean; reason: string } {
  const first = normalizeIngredientName(name1);
  const isSimilar = first.length > 0 && first === normalizeIngredientName(name2);
  return { isSimilar, reason: isSimilar ? 'same normalized food identity' : 'different food identities' };
}

export function deduplicateIngredients(ingredients: Ingredient[]): DeduplicationResult {
  const groups: Ingredient[][] = [];
  const mergeLog: string[] = [];
  for (const ingredient of ingredients) {
    const group = groups.find(items => areIngredientsSimilar(items[0].name, ingredient.name).isSimilar &&
      convertToSameUnit(ingredient.quantity, ingredient.unit, items[0].unit) !== null);
    if (group) {
      group.push(ingredient);
      mergeLog.push('Combined repeated label: ' + ingredient.name + '; preserved region quantities and adjustment reasons.');
    } else {
      groups.push([ingredient]);
    }
  }
  const uniqueIngredients = groups.map(items => {
    const current = items[0];
    const regionQuantities = new Map<number, number>();
    let unscopedQuantity = 0;
    for (const item of items) {
      const quantity = convertToSameUnit(item.quantity, item.unit, current.unit)!;
      if (item.regionIndex === undefined) {
        unscopedQuantity += quantity;
      } else {
        // Each recognition region reports one total for a food. Repeated labels
        // in that same region describe the same amount; different regions add.
        regionQuantities.set(item.regionIndex, Math.max(regionQuantities.get(item.regionIndex) ?? 0, quantity));
      }
    }
    const reasons = [...new Set(items.flatMap(item => item.wasAdjusted && item.adjustmentReason ? [item.adjustmentReason] : []))].sort();
    return {
      ...current,
      name: items.map(item => item.name).sort((a, b) => b.length - a.length || a.localeCompare(b))[0],
      quantity: unscopedQuantity + [...regionQuantities.values()].reduce((sum, value) => sum + value, 0),
      confidence: Math.min(...items.map(item => item.confidence)),
      regionIndex: items.every(item => item.regionIndex === current.regionIndex) ? current.regionIndex : undefined,
      wasAdjusted: items.some(item => item.wasAdjusted) || undefined,
      adjustmentReason: reasons.length ? reasons.join('; ') : undefined,
    };
  });
  return { uniqueIngredients, mergedCount: ingredients.length - groups.length, mergeLog };
}

export function convertToSameUnit(quantity: number, fromUnit: string, toUnit: string): number | null {
  const from = fromUnit.toLowerCase().trim();
  const to = toUnit.toLowerCase().trim();
  if (from === to) return quantity;
  const mass: Record<string, number> = { g: 1, oz: 28.35, kg: 1000 };
  const volume: Record<string, number> = { ml: 1, cup: 240, tbsp: 15, tsp: 5, l: 1000 };
  for (const units of [mass, volume]) {
    if (units[from] && units[to]) return quantity * units[from] / units[to];
  }
  return null;
}
