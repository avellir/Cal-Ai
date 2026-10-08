/**
 * Portion Validation Module
 * 
 * Checks AI-estimated portions before nutritional lookup.
 * Serving guidelines produce warnings; only the supported schema ceiling caps quantities.
 * 
 * Implements error handling and user feedback (Requirements 5.4, 5.5, 6.4)
 */


import type { FoodCategory } from '@/lib/advanced-food-analysis-types';
import { containsFoodPhrase, normalizeFoodName } from '@/services/foodNames';

export type Unit = 'g' | 'ml' | 'oz' | 'cup' | 'tbsp' | 'tsp' | 'piece';

interface PortionConstraint {
  min: number;      // Minimum realistic portion in grams/ml
  max: number;      // Maximum realistic portion in grams/ml
  typical: number;  // Typical portion size in grams/ml
}

export interface ValidationResult {
  adjustedQuantity: number;
  wasAdjusted: boolean;
  confidencePenalty: number;
  reason: string;
  category: FoodCategory;
  warning?: string;
}

interface ImageContext {
  plateSize?: number;
  referenceObjects?: string[];
}

/**
 * Portion constraints for different food categories
 * All values in grams or milliliters
 * Single-serving heuristics for review, not measured bounds for the photo.
 * Small toppings and multiple servings can legitimately fall outside these ranges.
 */
const PORTION_CONSTRAINTS: Record<FoodCategory, PortionConstraint> = {
  spread: { min: 5, max: 50, typical: 25 },      // Hummus, labneh, yogurt dips
  condiment: { min: 2, max: 30, typical: 10 },   // Sauces, dressings
  leafyGreen: { min: 10, max: 60, typical: 30 }, // Spinach, lettuce, arugula - reduced max
  protein: { min: 30, max: 180, typical: 100 },  // Chicken, eggs - REDUCED: typical plate portion
  grain: { min: 20, max: 150, typical: 80 },     // Bread, rice - reduced for realistic slices
  oil: { min: 2, max: 15, typical: 5 },          // Cooking oils
  vegetable: { min: 15, max: 150, typical: 60 }, // Cooked veggies - reduced
  fruit: { min: 30, max: 200, typical: 100 },    // Fruits
  dairy: { min: 15, max: 100, typical: 40 },     // Cheese, yogurt - REDUCED for side portions
  fat: { min: 5, max: 30, typical: 10 },         // Nuts, seeds
  garnish: { min: 5, max: 40, typical: 15 },     // Olives, pickles - reduced
  completeDish: { min: 200, max: 800, typical: 400 }, // Whole pizza, burger, sandwich
  pizzaDough: { min: 150, max: 350, typical: 250 },   // Pizza base/crust (Neapolitan ~250-300g)
  unknown: { min: 10, max: 150, typical: 60 },   // Unknown items - reduced
};

/**
 * Total meal weight constraints
 */
const MEAL_CONSTRAINTS = {
  min: 200,  // grams
  max: 1000, // grams
};

/**
 * Specific single-serving guidelines that override category warning ranges.
 * These never establish the quantity eaten or replace the visible portion.
 */
const SPECIFIC_ITEM_CONSTRAINTS: Record<string, PortionConstraint> = {
  // Eggs - AI tends to overestimate scrambled eggs
  'scrambled eggs': { min: 60, max: 120, typical: 100 },    // 2 eggs = ~100g
  'scrambled egg': { min: 50, max: 120, typical: 100 },
  'fried egg': { min: 45, max: 60, typical: 50 },           // 1 egg = ~50g
  'poached egg': { min: 45, max: 60, typical: 50 },
  'egg': { min: 45, max: 60, typical: 50 },
  
  // Chicken - sliced portions on plates are smaller than AI thinks
  'grilled chicken': { min: 80, max: 150, typical: 120 },
  'grilled chicken breast': { min: 80, max: 150, typical: 120 },
  'chicken breast': { min: 80, max: 150, typical: 120 },
  'sliced chicken': { min: 60, max: 120, typical: 100 },
  
  // Dairy - yogurt/labneh portions are typically small
  'yogurt': { min: 20, max: 60, typical: 40 },
  'labneh': { min: 20, max: 50, typical: 30 },
  'labne': { min: 20, max: 50, typical: 30 },
  'feta cheese': { min: 20, max: 60, typical: 30 },
  'feta': { min: 20, max: 60, typical: 30 },
  
  // Bread - 2 slices of sourdough
  'sourdough bread': { min: 40, max: 100, typical: 70 },    // 2 slices ~70g
  'sourdough': { min: 40, max: 100, typical: 70 },
  'bread slice': { min: 25, max: 40, typical: 35 },
  
  // Small items
  'kalamata olives': { min: 10, max: 30, typical: 20 },
  'olives': { min: 10, max: 30, typical: 20 },
  'pickled cucumber': { min: 15, max: 40, typical: 25 },
  'pickle': { min: 15, max: 40, typical: 25 },
  'radish': { min: 10, max: 30, typical: 15 },
  
  // Spreads/dips
  'hummus': { min: 15, max: 40, typical: 25 },
  'red pepper paste': { min: 10, max: 25, typical: 15 },
};

/**
 * Keywords for categorizing ingredients by name
 */
const CATEGORY_KEYWORDS: Record<FoodCategory, string[]> = {
  spread: [
    'hummus', 'guacamole', 'cream cheese', 'peanut butter', 'almond butter',
    'tahini', 'butter', 'margarine', 'spread', 'dip', 'paste', 'jam', 'jelly',
    'nutella', 'mayo', 'mayonnaise', 'labneh', 'labne', 'yogurt dip', 'tzatziki',
    'baba ganoush', 'muhammara'
  ],
  condiment: [
    'ketchup', 'mustard', 'sauce', 'salsa', 'dressing', 'vinegar', 'soy sauce',
    'hot sauce', 'sriracha', 'relish', 'chutney', 'aioli', 'gravy'
  ],
  leafyGreen: [
    'lettuce', 'spinach', 'arugula', 'kale', 'chard', 'collard', 'rocket',
    'mixed greens', 'salad greens', 'mesclun', 'watercress'
  ],
  protein: [
    'chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'turkey', 'lamb',
    'shrimp', 'prawn', 'tofu', 'tempeh', 'seitan', 'meat', 'steak', 'fillet',
    'breast', 'thigh', 'drumstick', 'bacon', 'sausage', 'ham', 'egg', 'eggs',
    'scrambled', 'omelette', 'omelet', 'fried egg', 'poached egg'
  ],
  grain: [
    'rice', 'pasta', 'noodles', 'quinoa', 'couscous', 'bulgur', 'barley',
    'bread', 'toast', 'roll', 'bagel', 'tortilla', 'wrap', 'pita', 'oats',
    'cereal', 'granola', 'muesli'
  ],
  oil: [
    'olive oil', 'vegetable oil', 'canola oil', 'coconut oil', 'sesame oil',
    'avocado oil', 'oil', 'cooking oil'
  ],
  vegetable: [
    'broccoli', 'carrot', 'tomato', 'cucumber', 'pepper', 'bell pepper',
    'capsicum', 'onion', 'garlic', 'mushroom', 'zucchini', 'eggplant',
    'cauliflower', 'cabbage', 'celery', 'asparagus', 'green beans', 'peas',
    'corn', 'potato', 'sweet potato', 'squash', 'pumpkin'
  ],
  fruit: [
    'apple', 'banana', 'orange', 'grape', 'berry', 'strawberry', 'blueberry',
    'raspberry', 'mango', 'pineapple', 'melon', 'watermelon', 'peach', 'pear',
    'plum', 'cherry', 'kiwi', 'avocado'
  ],
  dairy: [
    'milk', 'yogurt', 'cheese', 'cottage cheese', 'ricotta', 'mozzarella',
    'cheddar', 'parmesan', 'feta', 'cream', 'sour cream', 'ice cream'
  ],
  fat: [
    'nuts', 'almonds', 'walnuts', 'cashews', 'peanuts', 'seeds', 'chia',
    'flax', 'sunflower seeds', 'pumpkin seeds'
  ],
  garnish: [
    'basil', 'parsley', 'cilantro', 'dill', 'mint', 'chives', 'rosemary', 'thyme', 'herbs',
    'olive', 'olives', 'kalamata', 'pickle', 'pickles', 'pickled', 'gherkin',
    'caper', 'capers', 'radish', 'radishes', 'cornichon', 'jalapeño', 'jalapeno',
    'sun-dried tomato', 'sundried tomato', 'anchovy', 'anchovies', 'artichoke hearts'
  ],
  completeDish: [
    'pizza', 'burger', 'hamburger', 'cheeseburger', 'sandwich', 'wrap', 'burrito',
    'taco', 'quesadilla', 'calzone', 'stromboli', 'panini', 'sub', 'hoagie',
    'gyro', 'shawarma', 'kebab', 'hot dog', 'sloppy joe'
  ],
  pizzaDough: [
    'pizza dough', 'pizza crust', 'pizza base', 'flatbread', 'naan bread',
    'focaccia', 'dough', 'crust'
  ],
  unknown: [],
};

/**
 * Categorize an ingredient based on its name
 */
export function categorizeIngredient(ingredientName: string): FoodCategory {
  const priority: FoodCategory[] = ['pizzaDough', 'oil', 'spread', 'condiment',
    'leafyGreen', 'completeDish', 'protein', 'grain', 'vegetable', 'fruit', 'dairy', 'fat', 'garnish'];
  for (const category of priority) {
    if (CATEGORY_KEYWORDS[category].some(keyword => containsFoodPhrase(ingredientName, keyword))) {
      return category;
    }
  }

  return 'unknown';
}

/**
 * Convert various units to grams/milliliters for consistent validation
 */
function normalizeToGrams(quantity: number, unit: Unit, category: FoodCategory): number {
  // Already in base units
  if (unit === 'g' || unit === 'ml') {
    return quantity;
  }

  // Conversion factors (approximate)
  const conversions: Record<Unit, number> = {
    g: 1,
    ml: 1,
    oz: 28.35,      // 1 oz = 28.35g
    cup: 240,       // 1 cup = 240ml (for liquids) or ~150g (for solids, varies)
    tbsp: 15,       // 1 tbsp = 15ml
    tsp: 5,         // 1 tsp = 5ml
    piece: 100,     // Assume 1 piece = 100g (rough estimate)
  };

  return quantity * conversions[unit];
}

/**
 * Calculate confidence penalty based on adjustment severity
 */
function calculateConfidencePenalty(
  originalQuantity: number,
  adjustedQuantity: number,
  category: FoodCategory
): number {
  const adjustmentRatio = Math.abs(originalQuantity - adjustedQuantity) / originalQuantity;

  // More severe adjustments get higher penalties
  if (adjustmentRatio > 0.75) {
    return 30; // Adjusted by more than 75%
  } else if (adjustmentRatio > 0.5) {
    return 25; // Adjusted by 50-75%
  } else if (adjustmentRatio > 0.25) {
    return 20; // Adjusted by 25-50%
  } else {
    return 10; // Minor adjustment
  }
}

/**
 * Validate and adjust portion size based on realistic constraints
 * 
 * @param ingredientName - Name of the ingredient
 * @param quantity - Estimated quantity
 * @param unit - Unit of measurement
 * @param imageContext - Optional context from image analysis
 * @returns Validation result with adjusted quantity and confidence penalty
 * @throws Error if inputs are invalid
 */
export function validatePortionSize(
  ingredientName: string,
  quantity: number,
  unit: Unit,
  imageContext?: ImageContext
): ValidationResult {
  // Input validation
  if (!ingredientName || ingredientName.trim().length === 0) {
    const error = new Error('Validation failed for ingredientName: Ingredient name cannot be empty');
    error.name = 'ValidationError';
    throw error;
  }

  if (quantity <= 0 || !Number.isFinite(quantity)) {
    const error = new Error(`Validation failed for quantity: Invalid quantity: ${quantity}`);
    error.name = 'ValidationError';
    throw error;
  }

  if (!unit) {
    const error = new Error('Validation failed for unit: Unit of measurement is required');
    error.name = 'ValidationError';
    throw error;
  }

  // Categorize the ingredient
  const category = categorizeIngredient(ingredientName);

  // Check for specific item constraints first (more accurate than category defaults)
  const name = normalizeFoodName(ingredientName);
  const specificItems = Object.entries(SPECIFIC_ITEM_CONSTRAINTS);
  const exact = specificItems.find(([itemName]) => normalizeFoodName(itemName) === name);
  const specific = exact ?? specificItems.sort(([a], [b]) => b.length - a.length)
    .find(([itemName]) => containsFoodPhrase(name, itemName));
  let constraints = specific?.[1];
  
  // Fall back to category constraints if no specific match
  if (!constraints) {
    constraints = PORTION_CONSTRAINTS[category];
  }

  // Normalize quantity to grams/ml
  let normalizedQuantity: number;
  try {
    normalizedQuantity = normalizeToGrams(quantity, unit, category);
    if (!Number.isFinite(normalizedQuantity)) throw new Error('Unsupported portion unit');
  } catch (err) {
    const error = new Error(`Validation failed for unit: Failed to normalize unit ${unit}: ${err}`);
    error.name = 'ValidationError';
    throw error;
  }

  // Check if quantity is within acceptable range
  let adjustedQuantity = normalizedQuantity;
  let wasAdjusted = false;
  let reason = '';
  let confidencePenalty = 0;

  const warning = normalizedQuantity < constraints.min || normalizedQuantity > constraints.max
    ? `${ingredientName}: ${normalizedQuantity.toFixed(1)}${unit === 'ml' ? 'ml' : 'g'} is outside the single-serving guideline (${constraints.min}-${constraints.max}). Confirm the visible portion and number of servings.`
    : undefined;

  // Guidelines do not establish the amount eaten. Keep toppings and multi-serving
  // quantities; cap only values beyond the supported vision schema's ceiling.
  if (normalizedQuantity > 10000) {
    adjustedQuantity = 10000;
    wasAdjusted = true;
    reason = `${ingredientName}: Portion exceeded the supported 10000g/ml limit and was capped. Confirm the portion before saving.`;
    confidencePenalty = calculateConfidencePenalty(normalizedQuantity, adjustedQuantity, category);
  } else {
    reason = warning ?? `${ingredientName}: Portion size within the guideline for ${category}.`;
  }

  // Convert back to original unit if needed
  const finalQuantity = unit === 'g' || unit === 'ml'
    ? adjustedQuantity
    : adjustedQuantity / normalizeToGrams(1, unit, category);

  return {
    adjustedQuantity: wasAdjusted ? finalQuantity : quantity,
    wasAdjusted,
    confidencePenalty,
    reason,
    category,
    warning,
  };
}

/**
 * Validate total meal weight across all ingredients
 * 
 * @param ingredients - Array of ingredients with quantities
 * @returns Validation result indicating if total weight is realistic
 */
export function validateTotalMealWeight(
  ingredients: { quantity: number; unit: Unit; category: FoodCategory }[]
): { isValid: boolean; totalWeight: number; warning?: string } {
  // Sum up all ingredient weights in grams
  const totalWeight = ingredients.reduce((sum, ingredient) => {
    const normalized = normalizeToGrams(ingredient.quantity, ingredient.unit, ingredient.category);
    return sum + normalized;
  }, 0);

  if (totalWeight < MEAL_CONSTRAINTS.min) {
    return {
      isValid: false,
      totalWeight,
      warning: `Total meal weight (${totalWeight.toFixed(0)}g) is below typical minimum (${MEAL_CONSTRAINTS.min}g). Portions may be underestimated.`,
    };
  } else if (totalWeight > MEAL_CONSTRAINTS.max) {
    return {
      isValid: false,
      totalWeight,
      warning: `Total meal weight (${totalWeight.toFixed(0)}g) exceeds typical maximum (${MEAL_CONSTRAINTS.max}g). Portions may be overestimated.`,
    };
  }

  return {
    isValid: true,
    totalWeight,
  };
}

/**
 * Batch validate multiple ingredients
 * 
 * @param ingredients - Array of ingredients to validate
 * @returns Array of validation results
 */
export function validateIngredients(
  ingredients: { name: string; quantity: number; unit: Unit }[],
  imageContext?: ImageContext
): ValidationResult[] {
  return ingredients.map(ingredient =>
    validatePortionSize(ingredient.name, ingredient.quantity, ingredient.unit, imageContext)
  );
}
