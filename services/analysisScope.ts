import type { AdvancedAnalysisResult, AnalysisIngredient, FoodRegion } from '@/lib/advanced-food-analysis-types';
import { recalculateAnalysis } from '@/services/analysisNutrition';
import { normalizeFoodName } from '@/services/foodNames';
import { requiresIdentityConfirmation } from '@/lib/nutritionIdentity';

type AnalysisData = NonNullable<AdvancedAnalysisResult['data']>;

function overlap(a: FoodRegion, b: FoodRegion): number {
  const first = a.boundingBox, second = b.boundingBox;
  if (!first || !second) return 0;
  const intersection = Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x)) *
    Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y));
  const area = Math.min(first.width * first.height, second.width * second.height);
  return area > 0 ? intersection / area : 0;
}

/** Scope changes repartition detections; excluded foods never contribute to totals. */
function partition(data: AnalysisData): AnalysisData {
  const all = [...data.ingredients, ...(data.excludedIngredients ?? [])];
  const included = all.filter(item => item.regionIndex === undefined || data.regions[item.regionIndex]?.selected !== false);
  const excludedIngredients = all.filter(item => item.regionIndex !== undefined && data.regions[item.regionIndex]?.selected === false);
  return recalculateAnalysis({ ...data, excludedIngredients }, included);
}

export function initializeAnalysisScope(data: AnalysisData): AnalysisData {
  const regions = data.regions.map((region, index) => {
    const items = data.ingredients.filter(item => item.regionIndex === index);
    const reviewReasons = [...(region.reviewReasons ?? [])];
    const wholeDishes = items.filter(item => item.representation === 'whole_dish');
    const separateHerb = (item: AnalysisIngredient) => {
      const name = normalizeFoodName(item.foodName || item.name);
      return /^(mint|basil|parsley|oregano|fresh herb|herb)$/.test(name) &&
        wholeDishes.every(dish => !normalizeFoodName(dish.nutrition?.foodName || dish.foodName || dish.name).includes(name));
    };
    if (wholeDishes.length && items.some(item => item.representation === 'component' && !item.extraWithWholeDish && !separateHerb(item))) {
      reviewReasons.push('Check that the whole dish and its components do not count the same food twice.');
    }
    if (items.some(item => requiresIdentityConfirmation(item.name, { ...item, dishName: region.dishName }))) reviewReasons.push('Confirm uncertain food types and their portion estimates.');
    if (region.scope === 'uncertain') reviewReasons.push('Confirm whether this food belongs to your meal.');
    for (let other = 0; other < data.regions.length; other++) {
      if (other === index || overlap(region, data.regions[other]) < 0.65) continue;
      const duplicate = items.some(item => data.ingredients.some(candidate => candidate.regionIndex === other &&
        normalizeFoodName(candidate.foodName ?? candidate.name) === normalizeFoodName(item.foodName ?? item.name) &&
        candidate.preparation === item.preparation && candidate.unit === item.unit));
      if (duplicate) reviewReasons.push('Overlapping regions contain the same food. Exclude duplicates or correct their amounts.');
    }
    return {
      ...region,
      selected: region.selected ?? (region.scope === undefined || region.scope === 'main'),
      reviewReasons: [...new Set(reviewReasons)],
    };
  });
  return partition({ ...data, regions });
}

export function selectAnalysisRegion(data: AnalysisData, index: number, selected: boolean): AnalysisData {
  if (!data.regions[index]) throw new Error('This food region is no longer available.');
  return partition({ ...data, regions: data.regions.map((region, current) => current === index ? { ...region, selected } : region) });
}

export function confirmAnalysisRegion(data: AnalysisData, index: number): AnalysisData {
  if (!data.regions[index]) throw new Error('This food region is no longer available.');
  return { ...data, regions: data.regions.map((region, current) => current === index
    ? { ...region, servingConfirmed: true, reviewConfirmed: true } : region) };
}

export function hasPendingAnalysisReview(data: AnalysisData): boolean {
  return data.regions.some((region, index) => region.selected !== false && data.ingredients.some(item => item.regionIndex === index) &&
    (region.servingConfirmationRequired && !region.servingConfirmed || (region.reviewReasons?.length ?? 0) > 0 && !region.reviewConfirmed || needsFatReview(data, index)));
}

export function needsFatReview(data: AnalysisData, index: number): boolean {
  const region = data.regions[index];
  return !!region && region.selected !== false && !region.fatConfirmed && (region.fatAssessment === 'ambiguous' ||
    region.fatAssessment === 'visible_separate' && !data.ingredients.some(item => item.regionIndex === index && item.isAddedFat));
}

export function confirmAnalysisFat(data: AnalysisData, index: number): AnalysisData {
  if (!data.regions[index]) throw new Error('This food region is no longer available.');
  return { ...data, regions: data.regions.map((region, current) => current === index ? { ...region, fatConfirmed: true } : region) };
}

export function addAnalysisFat(data: AnalysisData, index: number, ingredient: AnalysisIngredient): AnalysisData {
  if (!data.regions[index] || !Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) throw new Error('Enter the amount of oil or dressing consumed.');
  const next = confirmAnalysisFat(data, index);
  return recalculateAnalysis(next, [...next.ingredients, { ...ingredient, regionIndex: index,
    quantitySource: 'user', isAddedFat: true, extraWithWholeDish: true, representation: 'component' }]);
}
