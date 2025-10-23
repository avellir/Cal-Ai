/**
 * Stage 4: Nutritional Aggregation
 * 
 * Aggregates nutritional data from enriched ingredients and generates
 * comprehensive ingredient breakdowns grouped by food region.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.4
 */

import type { EnrichedIngredient, FoodRegion } from '@/lib/advanced-food-analysis-types';

// ============================================================================
// Task 6.1: Nutrition Aggregation Logic
// ============================================================================

/**
 * Aggregates nutrition from all enriched ingredients
 * 
 * Implements requirements:
 * - 4.1: Sum calories from all identified ingredients
 * - 4.2: Sum protein, carbohydrates, and fat from all ingredients
 * - 4.3: Round total calories to nearest 5 for values over 50
 * - 4.4: Round total macronutrients to nearest whole gram
 * 
 * @param enrichedIngredients - Array of ingredients with nutrition data
 * @returns Total nutrition and weighted average confidence score
 */
export function aggregateNutrition(enrichedIngredients: EnrichedIngredient[]): {
  totalNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  confidence: number;
} {
  // Handle empty array
  if (enrichedIngredients.length === 0) {
    return {
      totalNutrition: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
      confidence: 0,
    };
  }

  // Sum all nutritional values from scaled nutrition
  const rawTotals = enrichedIngredients.reduce(
    (acc, ingredient) => ({
      calories: acc.calories + ingredient.scaledNutrition.calories,
      protein: acc.protein + ingredient.scaledNutrition.protein,
      carbs: acc.carbs + ingredient.scaledNutrition.carbs,
      fat: acc.fat + ingredient.scaledNutrition.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Requirement 4.3: Round calories to nearest 5 for values over 50
  const roundedCalories = rawTotals.calories > 50
    ? Math.round(rawTotals.calories / 5) * 5
    : Math.round(rawTotals.calories);

  // Requirement 4.4: Round macronutrients to nearest whole gram
  const totalNutrition = {
    calories: roundedCalories,
    protein: Math.round(rawTotals.protein),
    carbs: Math.round(rawTotals.carbs),
    fat: Math.round(rawTotals.fat),
  };

  // Calculate weighted average confidence
  // Weight each ingredient's confidence by its calorie contribution
  const totalCalories = enrichedIngredients.reduce(
    (sum, ing) => sum + ing.scaledNutrition.calories,
    0
  );

  let confidence: number;
  if (totalCalories === 0) {
    // If no calories, use simple average
    confidence = enrichedIngredients.reduce(
      (sum, ing) => sum + ing.confidence,
      0
    ) / enrichedIngredients.length;
  } else {
    // Weighted average by calorie contribution
    confidence = enrichedIngredients.reduce(
      (sum, ing) => sum + (ing.confidence * ing.scaledNutrition.calories / totalCalories),
      0
    );
  }

  return {
    totalNutrition,
    confidence: Math.round(confidence),
  };
}

// ============================================================================
// Task 6.2: Ingredient Breakdown Generation
// ============================================================================

/**
 * Ingredient with contribution percentages for display
 */
export type IngredientBreakdown = {
  name: string;
  quantity: number;
  unit: string;
  preparation?: string;
  regionId: string;
  confidence: number;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  contribution: {
    caloriesPercent: number;
    proteinPercent: number;
    carbsPercent: number;
    fatPercent: number;
  };
  displayQuantity: string; // User-friendly quantity with unit conversion
};

/**
 * Ingredients grouped by food region
 */
export type RegionBreakdown = {
  regionId: string;
  regionDescription: string;
  ingredients: IngredientBreakdown[];
  regionTotals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
};

/**
 * Generates ingredient breakdown with contributions to total nutrition
 * 
 * Implements requirements:
 * - 4.5: Provide breakdown showing each ingredient's contribution
 * - 5.1: Return list of all identified ingredients with quantities
 * - 5.2: Indicate which food region each ingredient belongs to
 * - 5.4: Use user-friendly units alongside metric measurements
 * 
 * @param enrichedIngredients - Array of ingredients with nutrition data
 * @param regions - Food regions from segmentation
 * @param totalNutrition - Total nutrition for calculating percentages
 * @returns Array of ingredients grouped by region with contribution data
 */
export function generateIngredientBreakdown(
  enrichedIngredients: EnrichedIngredient[],
  regions: FoodRegion[],
  totalNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }
): RegionBreakdown[] {
  // Group ingredients by region
  const ingredientsByRegion = new Map<string, EnrichedIngredient[]>();
  
  for (const ingredient of enrichedIngredients) {
    const regionIngredients = ingredientsByRegion.get(ingredient.regionId) || [];
    regionIngredients.push(ingredient);
    ingredientsByRegion.set(ingredient.regionId, regionIngredients);
  }

  // Create breakdown for each region
  const regionBreakdowns: RegionBreakdown[] = [];

  for (const region of regions) {
    const regionIngredients = ingredientsByRegion.get(region.regionId) || [];
    
    if (regionIngredients.length === 0) {
      continue; // Skip regions with no ingredients
    }

    // Calculate region totals
    const regionTotals = regionIngredients.reduce(
      (acc, ing) => ({
        calories: acc.calories + ing.scaledNutrition.calories,
        protein: acc.protein + ing.scaledNutrition.protein,
        carbs: acc.carbs + ing.scaledNutrition.carbs,
        fat: acc.fat + ing.scaledNutrition.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    // Format each ingredient with contribution percentages
    const formattedIngredients: IngredientBreakdown[] = regionIngredients.map(ingredient => {
      const contribution = calculateContribution(ingredient, totalNutrition);
      const displayQuantity = formatDisplayQuantity(ingredient.quantity, ingredient.unit);

      return {
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        preparation: ingredient.preparation,
        regionId: ingredient.regionId,
        confidence: ingredient.confidence,
        nutrition: {
          calories: ingredient.scaledNutrition.calories,
          protein: ingredient.scaledNutrition.protein,
          carbs: ingredient.scaledNutrition.carbs,
          fat: ingredient.scaledNutrition.fat,
        },
        contribution,
        displayQuantity,
      };
    });

    regionBreakdowns.push({
      regionId: region.regionId,
      regionDescription: region.description,
      ingredients: formattedIngredients,
      regionTotals,
    });
  }

  return regionBreakdowns;
}

/**
 * Calculates percentage contribution of an ingredient to total nutrition
 */
function calculateContribution(
  ingredient: EnrichedIngredient,
  totalNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }
): {
  caloriesPercent: number;
  proteinPercent: number;
  carbsPercent: number;
  fatPercent: number;
} {
  // Avoid division by zero
  const caloriesPercent = totalNutrition.calories > 0
    ? Math.round((ingredient.scaledNutrition.calories / totalNutrition.calories) * 100)
    : 0;

  const proteinPercent = totalNutrition.protein > 0
    ? Math.round((ingredient.scaledNutrition.protein / totalNutrition.protein) * 100)
    : 0;

  const carbsPercent = totalNutrition.carbs > 0
    ? Math.round((ingredient.scaledNutrition.carbs / totalNutrition.carbs) * 100)
    : 0;

  const fatPercent = totalNutrition.fat > 0
    ? Math.round((ingredient.scaledNutrition.fat / totalNutrition.fat) * 100)
    : 0;

  return {
    caloriesPercent,
    proteinPercent,
    carbsPercent,
    fatPercent,
  };
}

/**
 * Formats quantity with user-friendly unit conversions
 * 
 * Requirement 5.4: Use user-friendly units alongside metric measurements
 */
function formatDisplayQuantity(quantity: number, unit: string): string {
  const roundedQuantity = Math.round(quantity * 10) / 10; // Round to 1 decimal

  switch (unit.toLowerCase()) {
    case 'g':
      // Convert to oz if over 28g
      if (quantity >= 28) {
        const oz = Math.round((quantity / 28.35) * 10) / 10;
        return `${roundedQuantity}g (${oz}oz)`;
      }
      return `${roundedQuantity}g`;

    case 'ml':
      // Convert to fl oz if over 30ml
      if (quantity >= 30) {
        const floz = Math.round((quantity / 29.57) * 10) / 10;
        return `${roundedQuantity}ml (${floz}fl oz)`;
      }
      return `${roundedQuantity}ml`;

    case 'oz':
      // Convert to grams
      const grams = Math.round(quantity * 28.35 * 10) / 10;
      return `${roundedQuantity}oz (${grams}g)`;

    case 'cup':
      // Show ml equivalent
      const ml = Math.round(quantity * 240);
      return `${roundedQuantity} cup (${ml}ml)`;

    case 'tbsp':
      // Show ml equivalent
      const tbspMl = Math.round(quantity * 15);
      return `${roundedQuantity} tbsp (${tbspMl}ml)`;

    case 'tsp':
      // Show ml equivalent
      const tspMl = Math.round(quantity * 5);
      return `${roundedQuantity} tsp (${tspMl}ml)`;

    case 'piece':
      return `${Math.round(quantity)} piece${quantity !== 1 ? 's' : ''}`;

    default:
      return `${roundedQuantity} ${unit}`;
  }
}

/**
 * Formats ingredient breakdown for display in UI
 * Returns a human-readable summary of all ingredients
 */
export function formatIngredientSummary(regionBreakdowns: RegionBreakdown[]): string {
  const lines: string[] = [];

  for (const region of regionBreakdowns) {
    lines.push(`\n${region.regionDescription}:`);
    
    for (const ingredient of region.ingredients) {
      const prep = ingredient.preparation ? ` (${ingredient.preparation})` : '';
      const contribution = `${ingredient.contribution.caloriesPercent}% of calories`;
      lines.push(
        `  • ${ingredient.name}${prep}: ${ingredient.displayQuantity} - ` +
        `${ingredient.nutrition.calories} cal (${contribution})`
      );
    }

    lines.push(
      `  Region Total: ${region.regionTotals.calories} cal, ` +
      `${region.regionTotals.protein}g protein, ` +
      `${region.regionTotals.carbs}g carbs, ` +
      `${region.regionTotals.fat}g fat`
    );
  }

  return lines.join('\n');
}
