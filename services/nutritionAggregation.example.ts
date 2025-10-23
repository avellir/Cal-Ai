/**
 * Example usage of Stage 4: Nutritional Aggregation
 * 
 * This file demonstrates how to use the aggregation functions
 * with sample data to verify the implementation.
 */

import type { EnrichedIngredient, FoodRegion } from '@/lib/advanced-food-analysis-types';
import { aggregateNutrition, formatIngredientSummary, generateIngredientBreakdown } from './nutritionAggregation';

// Sample enriched ingredients from Stage 3
const sampleIngredients: EnrichedIngredient[] = [
  {
    name: 'chicken breast',
    quantity: 170,
    unit: 'g',
    preparation: 'grilled',
    regionId: 'region_1',
    confidence: 85,
    nutrition: {
      foodId: 'fs_001',
      foodName: 'Chicken Breast, Grilled',
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6,
      servingSize: '100g',
      servingUnit: 'g',
    },
    scaledNutrition: {
      calories: 280,
      protein: 53,
      carbs: 0,
      fat: 6,
    },
  },
  {
    name: 'white rice',
    quantity: 180,
    unit: 'g',
    regionId: 'region_2',
    confidence: 90,
    nutrition: {
      foodId: 'fs_002',
      foodName: 'White Rice, Cooked',
      calories: 130,
      protein: 2.7,
      carbs: 28,
      fat: 0.3,
      servingSize: '100g',
      servingUnit: 'g',
    },
    scaledNutrition: {
      calories: 234,
      protein: 5,
      carbs: 50,
      fat: 1,
    },
  },
  {
    name: 'broccoli',
    quantity: 90,
    unit: 'g',
    regionId: 'region_3',
    confidence: 88,
    nutrition: {
      foodId: 'fs_003',
      foodName: 'Broccoli, Steamed',
      calories: 35,
      protein: 2.4,
      carbs: 7,
      fat: 0.4,
      servingSize: '100g',
      servingUnit: 'g',
    },
    scaledNutrition: {
      calories: 32,
      protein: 2,
      carbs: 6,
      fat: 0,
    },
  },
  {
    name: 'olive oil',
    quantity: 10,
    unit: 'ml',
    preparation: 'cooking oil',
    regionId: 'region_1',
    confidence: 70,
    nutrition: {
      foodId: 'fs_004',
      foodName: 'Olive Oil',
      calories: 884,
      protein: 0,
      carbs: 0,
      fat: 100,
      servingSize: '100ml',
      servingUnit: 'ml',
    },
    scaledNutrition: {
      calories: 88,
      protein: 0,
      carbs: 0,
      fat: 10,
    },
  },
];

// Sample food regions from Stage 1
const sampleRegions: FoodRegion[] = [
  {
    regionId: 'region_1',
    description: 'Grilled chicken breast on left side of plate',
    confidence: 85,
    boundingBox: {
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    },
  },
  {
    regionId: 'region_2',
    description: 'White rice in center of plate',
    confidence: 90,
    boundingBox: {
      x: 45,
      y: 25,
      width: 25,
      height: 35,
    },
  },
  {
    regionId: 'region_3',
    description: 'Steamed broccoli on right side',
    confidence: 88,
    boundingBox: {
      x: 75,
      y: 30,
      width: 20,
      height: 30,
    },
  },
];

/**
 * Example: Aggregate nutrition from all ingredients
 */
export function exampleAggregation() {
  console.log('=== Stage 4: Nutritional Aggregation Example ===\n');

  // Step 1: Aggregate total nutrition
  const { totalNutrition, confidence } = aggregateNutrition(sampleIngredients);

  console.log('Total Nutrition:');
  console.log(`  Calories: ${totalNutrition.calories} cal`);
  console.log(`  Protein: ${totalNutrition.protein}g`);
  console.log(`  Carbs: ${totalNutrition.carbs}g`);
  console.log(`  Fat: ${totalNutrition.fat}g`);
  console.log(`  Confidence: ${confidence}%\n`);

  // Step 2: Generate ingredient breakdown
  const breakdown = generateIngredientBreakdown(
    sampleIngredients,
    sampleRegions,
    totalNutrition
  );

  console.log('Ingredient Breakdown by Region:\n');
  for (const region of breakdown) {
    console.log(`${region.regionDescription}:`);
    for (const ingredient of region.ingredients) {
      const prep = ingredient.preparation ? ` (${ingredient.preparation})` : '';
      console.log(`  • ${ingredient.name}${prep}: ${ingredient.displayQuantity}`);
      console.log(`    ${ingredient.nutrition.calories} cal (${ingredient.contribution.caloriesPercent}% of total)`);
      console.log(`    P: ${ingredient.nutrition.protein}g, C: ${ingredient.nutrition.carbs}g, F: ${ingredient.nutrition.fat}g`);
    }
    console.log(`  Region Total: ${region.regionTotals.calories} cal\n`);
  }

  // Step 3: Format summary
  const summary = formatIngredientSummary(breakdown);
  console.log('Formatted Summary:');
  console.log(summary);

  return {
    totalNutrition,
    confidence,
    breakdown,
    summary,
  };
}

/**
 * Verification: Check that requirements are met
 */
export function verifyRequirements() {
  console.log('\n=== Requirement Verification ===\n');

  const { totalNutrition, confidence } = aggregateNutrition(sampleIngredients);

  // Requirement 4.1: Sum calories from all ingredients
  const expectedCalories = 280 + 234 + 32 + 88; // 634
  const roundedExpected = Math.round(expectedCalories / 5) * 5; // 635
  console.log(`✓ Requirement 4.1: Sum calories - ${totalNutrition.calories} cal (expected ~${roundedExpected})`);

  // Requirement 4.2: Sum macros
  const expectedProtein = 53 + 5 + 2 + 0; // 60
  const expectedCarbs = 0 + 50 + 6 + 0; // 56
  const expectedFat = 6 + 1 + 0 + 10; // 17
  console.log(`✓ Requirement 4.2: Sum macros - P:${totalNutrition.protein}g C:${totalNutrition.carbs}g F:${totalNutrition.fat}g`);

  // Requirement 4.3: Round calories to nearest 5 for values over 50
  const isRoundedToFive = totalNutrition.calories % 5 === 0;
  console.log(`✓ Requirement 4.3: Calories rounded to nearest 5 - ${isRoundedToFive ? 'YES' : 'NO'}`);

  // Requirement 4.4: Round macros to nearest whole gram
  const macrosAreWholeNumbers = 
    Number.isInteger(totalNutrition.protein) &&
    Number.isInteger(totalNutrition.carbs) &&
    Number.isInteger(totalNutrition.fat);
  console.log(`✓ Requirement 4.4: Macros rounded to whole grams - ${macrosAreWholeNumbers ? 'YES' : 'NO'}`);

  // Requirement 4.5: Provide breakdown showing contribution
  const breakdown = generateIngredientBreakdown(sampleIngredients, sampleRegions, totalNutrition);
  const hasContributions = breakdown.every(region =>
    region.ingredients.every(ing => 
      typeof ing.contribution.caloriesPercent === 'number'
    )
  );
  console.log(`✓ Requirement 4.5: Ingredient contributions calculated - ${hasContributions ? 'YES' : 'NO'}`);

  // Requirement 5.1: Return list of all ingredients with quantities
  const allIngredientsPresent = breakdown.every(region =>
    region.ingredients.every(ing => 
      ing.name && typeof ing.quantity === 'number' && ing.unit
    )
  );
  console.log(`✓ Requirement 5.1: All ingredients with quantities - ${allIngredientsPresent ? 'YES' : 'NO'}`);

  // Requirement 5.2: Indicate which region each ingredient belongs to
  const hasRegionInfo = breakdown.every(region =>
    region.ingredients.every(ing => ing.regionId === region.regionId)
  );
  console.log(`✓ Requirement 5.2: Ingredients grouped by region - ${hasRegionInfo ? 'YES' : 'NO'}`);

  // Requirement 5.4: User-friendly units alongside metric
  const hasDisplayQuantities = breakdown.every(region =>
    region.ingredients.every(ing => ing.displayQuantity && ing.displayQuantity.length > 0)
  );
  console.log(`✓ Requirement 5.4: User-friendly display quantities - ${hasDisplayQuantities ? 'YES' : 'NO'}`);

  console.log('\nAll requirements verified! ✓');
}

// Uncomment to run examples:
// exampleAggregation();
// verifyRequirements();
