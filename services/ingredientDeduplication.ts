/**
 * Ingredient Deduplication Module
 * 
 * Ensures each food item is counted exactly once by:
 * - Merging duplicate ingredients with similar names
 * - Handling edge cases (olive oil vs olives, white rice vs brown rice)
 * - Combining quantities with unit compatibility checks
 * - Providing detailed logging for all merge operations
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import type { Ingredient } from '@/lib/advanced-food-analysis-types';

/**
 * Result of deduplication operation with detailed logging
 */
export interface DeduplicationResult {
  uniqueIngredients: Ingredient[];
  mergedCount: number;
  mergeLog: string[];
}

/**
 * Edge cases: Foods that sound similar but are different
 * These should NOT be merged even if names are similar
 */
const EDGE_CASE_PAIRS = [
  ['olive oil', 'olives'],
  ['olive', 'olive oil'],
  ['sesame oil', 'sesame seeds'],
  ['sesame', 'sesame oil'],
  ['peanut oil', 'peanuts'],
  ['peanut', 'peanut oil'],
  ['coconut oil', 'coconut'],
  ['sunflower oil', 'sunflower seeds'],
  ['rice', 'rice vinegar'],
  ['rice', 'rice wine'],
  ['soy sauce', 'soybeans'],
  ['soy', 'soy sauce'],
];

/**
 * Food type modifiers that indicate different varieties
 * If one name has these and the other doesn't, they're different foods
 */
const TYPE_MODIFIERS = [
  'white', 'brown', 'black', 'red', 'green', 'yellow',
  'wild', 'basmati', 'jasmine', 'arborio',
  'cheddar', 'mozzarella', 'parmesan', 'feta', 'swiss',
  'whole wheat', 'sourdough', 'rye', 'multigrain',
  'ground', 'minced', 'diced', 'sliced', 'shredded',
];

/**
 * Preparation methods that should be removed during normalization
 * These don't change the core ingredient identity
 */
const PREPARATION_METHODS = [
  'grilled', 'fried', 'baked', 'roasted', 'steamed', 'boiled',
  'sauteed', 'sautéed', 'pan-fried', 'deep-fried', 'stir-fried',
  'raw', 'cooked', 'fresh', 'frozen', 'canned', 'dried',
  'marinated', 'seasoned', 'spiced', 'glazed', 'breaded',
];

/**
 * Deduplicates ingredients by merging similar items
 * 
 * @param ingredients - Array of ingredients to deduplicate
 * @returns DeduplicationResult with unique ingredients and merge log
 */
export function deduplicateIngredients(ingredients: Ingredient[]): DeduplicationResult {
  if (ingredients.length === 0) {
    return {
      uniqueIngredients: [],
      mergedCount: 0,
      mergeLog: [],
    };
  }

  const merged: Ingredient[] = [];
  const processed = new Set<number>();
  const mergeLog: string[] = [];
  let totalMerges = 0;

  for (let i = 0; i < ingredients.length; i++) {
    if (processed.has(i)) continue;

    const current = ingredients[i];
    let totalQuantity = current.quantity;
    let lowestConfidence = current.confidence;
    const duplicateIndices = [i];
    const mergedNames: string[] = [current.name];

    // Find duplicates
    for (let j = i + 1; j < ingredients.length; j++) {
      if (processed.has(j)) continue;

      const other = ingredients[j];

      // Check if ingredients are similar
      const similarity = areIngredientsSimilar(current.name, other.name);
      
      if (similarity.isSimilar) {
        // Check unit compatibility before merging
        const convertedQuantity = convertToSameUnit(other.quantity, other.unit, current.unit);
        
        if (convertedQuantity !== null) {
          totalQuantity += convertedQuantity;
          lowestConfidence = Math.min(lowestConfidence, other.confidence);
          duplicateIndices.push(j);
          mergedNames.push(other.name);
          processed.add(j);
          totalMerges++;

          // Log the merge
          mergeLog.push(
            `Merged "${other.name}" (${other.quantity}${other.unit}) into "${current.name}" ` +
            `(reason: ${similarity.reason})`
          );
        } else {
          // Log incompatible units
          mergeLog.push(
            `Cannot merge "${other.name}" (${other.quantity}${other.unit}) with "${current.name}" ` +
            `(${current.quantity}${current.unit}) - incompatible units`
          );
        }
      }
    }

    // Choose the most specific name from merged items
    const bestName = chooseMostSpecificName(mergedNames);

    // Add merged ingredient
    merged.push({
      ...current,
      name: bestName,
      quantity: totalQuantity,
      confidence: lowestConfidence,
    });
    processed.add(i);

    // Log summary if duplicates were found
    if (duplicateIndices.length > 1) {
      mergeLog.push(
        `✓ Final: "${bestName}" with total ${totalQuantity.toFixed(1)}${current.unit} ` +
        `(merged ${duplicateIndices.length} entries, confidence: ${lowestConfidence})`
      );
    }
  }

  return {
    uniqueIngredients: merged,
    mergedCount: totalMerges,
    mergeLog,
  };
}

/**
 * Similarity check result with reasoning
 */
interface SimilarityResult {
  isSimilar: boolean;
  reason: string;
}

/**
 * Check if two ingredient names refer to the same food
 * Implements improved name normalization and edge case handling
 * 
 * @param name1 - First ingredient name
 * @param name2 - Second ingredient name
 * @param threshold - Similarity threshold (0-1), default 0.8
 * @returns SimilarityResult indicating if similar and why
 */
export function areIngredientsSimilar(
  name1: string,
  name2: string,
  threshold: number = 0.8
): SimilarityResult {
  // Normalize both names
  const n1 = normalizeIngredientName(name1);
  const n2 = normalizeIngredientName(name2);

  // Exact match after normalization
  if (n1 === n2) {
    return {
      isSimilar: true,
      reason: 'exact match after normalization',
    };
  }

  // Check edge cases first - these should NOT be merged
  if (isEdgeCase(n1, n2)) {
    return {
      isSimilar: false,
      reason: 'edge case - similar names but different foods',
    };
  }

  // Check for type modifiers that indicate different varieties
  if (hasDifferentTypeModifiers(n1, n2)) {
    return {
      isSimilar: false,
      reason: 'different food types (e.g., white rice vs brown rice)',
    };
  }

  // One name contains the other (e.g., "chicken" and "chicken breast")
  if (n1.includes(n2)) {
    return {
      isSimilar: true,
      reason: `"${n1}" contains "${n2}"`,
    };
  }

  if (n2.includes(n1)) {
    return {
      isSimilar: true,
      reason: `"${n2}" contains "${n1}"`,
    };
  }

  // Calculate Levenshtein distance for fuzzy matching
  const distance = levenshteinDistance(n1, n2);
  const maxLength = Math.max(n1.length, n2.length);
  const similarity = 1 - distance / maxLength;

  if (similarity >= threshold) {
    return {
      isSimilar: true,
      reason: `high similarity score (${(similarity * 100).toFixed(0)}%)`,
    };
  }

  return {
    isSimilar: false,
    reason: `low similarity score (${(similarity * 100).toFixed(0)}%)`,
  };
}

/**
 * Normalize ingredient name for comparison
 * Removes preparation methods, extra whitespace, and standardizes format
 * 
 * @param name - Raw ingredient name
 * @returns Normalized name
 */
export function normalizeIngredientName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Remove everything after comma (preparation method descriptions)
  normalized = normalized.replace(/,.*$/, '');

  // Remove preparation methods
  for (const method of PREPARATION_METHODS) {
    const regex = new RegExp(`\\b${method}\\b`, 'gi');
    normalized = normalized.replace(regex, '');
  }

  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Check if two names are an edge case pair that should not be merged
 * 
 * @param name1 - First normalized name
 * @param name2 - Second normalized name
 * @returns True if this is an edge case pair
 */
function isEdgeCase(name1: string, name2: string): boolean {
  for (const [food1, food2] of EDGE_CASE_PAIRS) {
    if (
      (name1.includes(food1) && name2.includes(food2)) ||
      (name1.includes(food2) && name2.includes(food1))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Check if two names have different type modifiers
 * e.g., "white rice" vs "brown rice" should not be merged
 * 
 * @param name1 - First normalized name
 * @param name2 - Second normalized name
 * @returns True if they have different type modifiers
 */
function hasDifferentTypeModifiers(name1: string, name2: string): boolean {
  const modifiers1 = TYPE_MODIFIERS.filter(mod => name1.includes(mod));
  const modifiers2 = TYPE_MODIFIERS.filter(mod => name2.includes(mod));

  // If one has a modifier and the other doesn't, they're different
  if (modifiers1.length > 0 && modifiers2.length === 0) return true;
  if (modifiers1.length === 0 && modifiers2.length > 0) return true;

  // If both have modifiers but they're different, they're different foods
  if (modifiers1.length > 0 && modifiers2.length > 0) {
    const hasCommonModifier = modifiers1.some(m => modifiers2.includes(m));
    if (!hasCommonModifier) return true;
  }

  return false;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching of ingredient names
 * 
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create 2D array for dynamic programming
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Choose the most specific name from a list of merged ingredient names
 * Prefers longer, more descriptive names
 * 
 * @param names - Array of ingredient names
 * @returns Most specific name
 */
function chooseMostSpecificName(names: string[]): string {
  if (names.length === 1) return names[0];

  // Sort by length (descending) and return the longest
  // Longer names are typically more specific (e.g., "chicken breast" vs "chicken")
  return names.sort((a, b) => b.length - a.length)[0];
}

/**
 * Convert quantity from one unit to another
 * Returns null if conversion is not possible
 * 
 * @param quantity - Quantity to convert
 * @param fromUnit - Source unit
 * @param toUnit - Target unit
 * @returns Converted quantity or null if incompatible
 */
export function convertToSameUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string
): number | null {
  if (fromUnit === toUnit) return quantity;

  // Weight conversions
  const weightConversions: Record<string, Record<string, number>> = {
    g: { oz: 1 / 28.35, kg: 1 / 1000 },
    oz: { g: 28.35, kg: 28.35 / 1000 },
    kg: { g: 1000, oz: 1000 / 28.35 },
  };

  // Volume conversions
  const volumeConversions: Record<string, Record<string, number>> = {
    ml: { cup: 1 / 240, tbsp: 1 / 15, tsp: 1 / 5, l: 1 / 1000 },
    cup: { ml: 240, tbsp: 16, tsp: 48, l: 0.24 },
    tbsp: { ml: 15, cup: 1 / 16, tsp: 3, l: 0.015 },
    tsp: { ml: 5, cup: 1 / 48, tbsp: 1 / 3, l: 0.005 },
    l: { ml: 1000, cup: 1000 / 240, tbsp: 1000 / 15, tsp: 1000 / 5 },
  };

  // Try weight conversion
  if (weightConversions[fromUnit]?.[toUnit]) {
    return quantity * weightConversions[fromUnit][toUnit];
  }

  // Try volume conversion
  if (volumeConversions[fromUnit]?.[toUnit]) {
    return quantity * volumeConversions[fromUnit][toUnit];
  }

  // Cannot convert between weight and volume, or incompatible units
  return null;
}
