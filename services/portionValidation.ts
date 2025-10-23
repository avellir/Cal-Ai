/**
 * Portion Validation Module
 * 
 * Applies realistic constraints to AI-estimated portions before nutritional lookup.
 * Implements hard limits based on food categories to prevent unrealistic portion estimates.
 * 
 * Implements error handling and user feedback (Requirements 5.4, 5.5, 6.4)
 */


export type FoodCategory = 
  | 'protein' 
  | 'grain' 
  | 'vegetable' 
  | 'fruit' 
  | 'dairy' 
  | 'fat' 
  | 'condiment' 
  | 'spread'
  | 'leafyGreen'
  | 'oil'
  | 'unknown';

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
}

interface ImageContext {
  plateSize?: number;
  referenceObjects?: string[];
}

/**
 * Portion constraints for different food categories
 * All values in grams or milliliters
 */
const PORTION_CONSTRAINTS: Record<FoodCategory, PortionConstraint> = {
  spread: { min: 5, max: 100, typical: 30 },
  condiment: { min: 2, max: 50, typical: 15 },
  leafyGreen: { min: 10, max: 150, typical: 50 },
  protein: { min: 30, max: 300, typical: 120 },
  grain: { min: 30, max: 300, typical: 150 },
  oil: { min: 2, max: 30, typical: 10 },
  vegetable: { min: 20, max: 250, typical: 100 },
  fruit: { min: 30, max: 300, typical: 120 },
  dairy: { min: 30, max: 300, typical: 150 },
  fat: { min: 5, max: 50, typical: 15 },
  unknown: { min: 10, max: 500, typical: 100 },
};

/**
 * Total meal weight constraints
 */
const MEAL_CONSTRAINTS = {
  min: 200,  // grams
  max: 1000, // grams
};

/**
 * Keywords for categorizing ingredients by name
 */
const CATEGORY_KEYWORDS: Record<FoodCategory, string[]> = {
  spread: [
    'hummus', 'guacamole', 'cream cheese', 'peanut butter', 'almond butter',
    'tahini', 'butter', 'margarine', 'spread', 'dip', 'paste', 'jam', 'jelly',
    'nutella', 'mayo', 'mayonnaise'
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
    'breast', 'thigh', 'drumstick', 'bacon', 'sausage', 'ham', 'egg'
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
  unknown: [],
};

/**
 * Categorize an ingredient based on its name
 */
export function categorizeIngredient(ingredientName: string): FoodCategory {
  const nameLower = ingredientName.toLowerCase();
  
  // Check each category's keywords
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (nameLower.includes(keyword)) {
        return category as FoodCategory;
      }
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
  
  // Get constraints for this category
  const constraints = PORTION_CONSTRAINTS[category];
  
  // Normalize quantity to grams/ml
  let normalizedQuantity: number;
  try {
    normalizedQuantity = normalizeToGrams(quantity, unit, category);
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
  
  if (normalizedQuantity < constraints.min) {
    // Below minimum - adjust to minimum
    adjustedQuantity = constraints.min;
    wasAdjusted = true;
    reason = `${ingredientName}: Portion size (${normalizedQuantity.toFixed(0)}${unit === 'ml' ? 'ml' : 'g'}) was below realistic minimum. Adjusted to ${constraints.min}${unit === 'ml' ? 'ml' : 'g'} for ${category}.`;
    confidencePenalty = calculateConfidencePenalty(normalizedQuantity, adjustedQuantity, category);
  } else if (normalizedQuantity > constraints.max) {
    // Above maximum - adjust to typical value (more conservative than max)
    adjustedQuantity = constraints.typical;
    wasAdjusted = true;
    reason = `${ingredientName}: Portion size (${normalizedQuantity.toFixed(0)}${unit === 'ml' ? 'ml' : 'g'}) exceeded realistic maximum. Adjusted to typical value of ${constraints.typical}${unit === 'ml' ? 'ml' : 'g'} for ${category}.`;
    confidencePenalty = calculateConfidencePenalty(normalizedQuantity, adjustedQuantity, category);
  } else {
    reason = `${ingredientName}: Portion size within acceptable range for ${category}.`;
  }
  
  // Convert back to original unit if needed
  const finalQuantity = unit === 'g' || unit === 'ml' 
    ? adjustedQuantity 
    : adjustedQuantity / normalizeToGrams(1, unit, category);
  
  return {
    adjustedQuantity: Math.round(finalQuantity * 10) / 10, // Round to 1 decimal
    wasAdjusted,
    confidencePenalty,
    reason,
    category,
  };
}

/**
 * Validate total meal weight across all ingredients
 * 
 * @param ingredients - Array of ingredients with quantities
 * @returns Validation result indicating if total weight is realistic
 */
export function validateTotalMealWeight(
  ingredients: Array<{ quantity: number; unit: Unit; category: FoodCategory }>
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
  ingredients: Array<{ name: string; quantity: number; unit: Unit }>,
  imageContext?: ImageContext
): ValidationResult[] {
  return ingredients.map(ingredient => 
    validatePortionSize(ingredient.name, ingredient.quantity, ingredient.unit, imageContext)
  );
}
