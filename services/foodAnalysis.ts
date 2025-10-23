export type NutritionData = {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  confidence: number;
  reasoning: string;
};

export type IdentifiedFoodItem = {
  foodName: string;
  description: string;
  portionHint: string;
  preparation?: string | null;
  confidence: number;
};

export type IdentificationSummary = {
  items: IdentifiedFoodItem[];
  overallConfidence: number;
  notes?: string;
};

export type AnalysisResult = {
  success: boolean;
  data?: NutritionData;
  error?: string;
  identification?: IdentificationSummary;
};

type ValidationResult = {
  isValid: boolean;
  adjustedData?: NutritionData;
  warnings: string[];
};

const enhancedPrompt = 'Analyze this food image and provide detailed nutritional information.\n\nCRITICAL INSTRUCTIONS:\n\n1. PORTION SIZE ESTIMATION:\n   - Use reference objects visible in the image (plates, utensils, hands)\n   - Standard plate = 10-11 inches diameter\n   - Cross-reference with Stage 1 portion hints\n   - Account for food density: 1 cup leafy greens does not equal 1 cup rice in weight\n\n2. PREPARATION METHOD ADJUSTMENTS:\n   - Fried foods: Add 10-20% calories for oil absorption\n     * Deep fried: +20% (e.g., fried chicken, french fries)\n     * Pan fried: +10-15% (e.g., pan-fried fish)\n   - Grilled/baked: Use base nutritional values\n   - Sauteed: Add ~1 tbsp oil (120 cal, 14g fat) per serving\n   - Steamed/boiled: Use base values, no additions\n\n3. COMPREHENSIVE ITEM ACCOUNTING:\n   - Include ALL visible food items from Stage 1\n   - Account for sauces, dressings, and condiments\n   - Estimate butter, oil, or cheese if visible\n   - Consider garnishes if substantial (>1 tbsp)\n\n4. USDA DATABASE STANDARDS:\n   - Base all estimates on USDA nutritional data\n   - Use median values for foods with recipe variations\n   - Round calories to nearest 10 for portions >100 cal\n   - Round macros (protein, carbs, fat) to nearest whole gram\n\n5. NUTRITIONAL VALIDATION:\n   - Verify: (protein * 4) + (carbs * 4) + (fat * 9) should equal total calories (+/-10%)\n   - If mismatch, adjust macros proportionally to match calories\n   - Protein: typically 10-35% of calories\n   - Carbs: typically 45-65% of calories\n   - Fat: typically 20-35% of calories\n\n6. CONFIDENCE SCORING:\n   - Reduce confidence if:\n     * Image quality is poor (blurry, dark, obscured)\n     * Portion size is ambiguous (no reference objects)\n     * Food type is unusual or mixed dish\n     * Preparation method is unclear\n   - High confidence (75-100): Clear image, standard food, visible portions\n   - Medium confidence (50-74): Some ambiguity in portion or preparation\n   - Low confidence (<50): Significant uncertainty in identification or quantity\n\n7. CONSERVATIVE ESTIMATES:\n   - When uncertain, estimate on the lower end for calories\n   - Better to underestimate than overestimate for user trust\n   - Note uncertainty in reasoning field\n\nIMPORTANT: Ensure nutritional consistency. Verify that (protein*4 + carbs*4 + fat*9) is within 10% of total calories.';

// ============================================================================
// Stage 1: Image Segmentation Prompt and Schema
// ============================================================================

/**
 * Segmentation prompt for detecting and isolating individual food regions
 * Used in the advanced multi-stage food analysis pipeline
 */
const segmentationPrompt = `Analyze this food image and identify all distinct food regions.

CRITICAL: Group similar items together! DO NOT create separate regions for each piece.

SEGMENTATION INSTRUCTIONS:
1. Detect visually separable food GROUPS (not individual pieces)
2. Assign each region a unique ID (region_1, region_2, etc.)
3. Describe each region's location (e.g., "left side of plate", "center bowl")
4. Provide approximate bounding box if possible (x, y, width, height as percentages)
5. Limit to 5-8 regions maximum - combine small items with their main dish

GROUPING RULES (VERY IMPORTANT):
- Multiple pieces of the same food = ONE region (e.g., all olives together, all chicken pieces together)
- Small garnishes/condiments = combine with main food they accompany
- Side items that are the same type = ONE region (e.g., all vegetables together if they're a side)

SEPARATION CRITERIA:
- Different food types (protein vs. vegetable vs. grain)
- Physical separation (different plates, bowls, or sections)
- Distinct visual boundaries (color, texture, shape)
- Combined sauces/garnishes with their primary food
- Treat mixed dishes (stir-fries, salads) as single regions

BOUNDING BOX GUIDELINES:
- x, y: Top-left corner position as percentage (0-100)
- width, height: Size as percentage (0-100)
- If exact boundaries unclear, provide approximate center region
- Omit bounding box if region cannot be spatially defined

CONFIDENCE SCORING:
- 80-100: Clear boundaries, distinct items, good lighting
- 60-79: Some overlap or mixed items
- 40-59: Poor separation or complex mixed dishes
- 0-39: Cannot reliably segment

EXAMPLES:
- Single plate with chicken, rice, and broccoli → 3 regions
- Bowl of stir-fry → 1 region (mixed dish)
- Burger with side of fries → 2 regions
- Salad with visible toppings → 1 region (treat as composite)

Return JSON with detected food regions.`;

/**
 * JSON schema for segmentation response
 * Enforces structured output from Gemini API for Stage 1
 */
function getSegmentationSchema() {
  return {
    type: 'object',
    properties: {
      regions: {
        type: 'array',
        description: 'Array of detected food regions',
        items: {
          type: 'object',
          properties: {
            regionId: {
              type: 'string',
              description: 'Unique identifier (e.g., region_1, region_2)',
            },
            description: {
              type: 'string',
              description: 'Location and appearance description',
            },
            boundingBox: {
              type: 'object',
              description: 'Optional bounding box coordinates as percentages',
              properties: {
                x: {
                  type: 'number',
                  description: 'Top-left X coordinate (0-100)',
                  minimum: 0,
                  maximum: 100,
                },
                y: {
                  type: 'number',
                  description: 'Top-left Y coordinate (0-100)',
                  minimum: 0,
                  maximum: 100,
                },
                width: {
                  type: 'number',
                  description: 'Width as percentage (0-100)',
                  minimum: 0,
                  maximum: 100,
                },
                height: {
                  type: 'number',
                  description: 'Height as percentage (0-100)',
                  minimum: 0,
                  maximum: 100,
                },
              },
              required: ['x', 'y', 'width', 'height'],
            },
            confidence: {
              type: 'number',
              description: 'Confidence score from 0-100',
              minimum: 0,
              maximum: 100,
            },
          },
          required: ['regionId', 'description', 'confidence'],
        },
      },
      overallConfidence: {
        type: 'number',
        description: 'Overall segmentation confidence from 0-100',
        minimum: 0,
        maximum: 100,
      },
      notes: {
        type: 'string',
        description: 'Any ambiguities, image quality issues, or assumptions made',
      },
    },
    required: ['regions', 'overallConfidence'],
  };
}

// ============================================================================
// Stage 2: Ingredient Decomposition Prompt and Schema
// ============================================================================

/**
 * Decomposition prompt for breaking down food regions into constituent ingredients
 * Used in Stage 2 of the advanced multi-stage food analysis pipeline
 */
function getDecompositionPrompt(region: import('@/lib/advanced-food-analysis-types').FoodRegion): string {
  return `Analyze the food region: "${region.description}"

CRITICAL: You MUST estimate the ACTUAL VISIBLE QUANTITY in the image. DO NOT use default values like 100g for everything!

INGREDIENT DECOMPOSITION INSTRUCTIONS:
1. Identify DISTINCT ingredient TYPES in this food region (DO NOT count individual pieces separately)
   - If you see multiple olives, list "olives" ONCE with total weight
   - If you see chicken pieces, list "chicken breast" ONCE with total weight
   - DO NOT create separate entries for each piece or item
2. For each ingredient TYPE, provide:
   - Specific name (e.g., "chicken breast, grilled" not just "chicken")
   - TOTAL estimated quantity for ALL pieces of that ingredient combined (in grams or milliliters)
   - Preparation method if visible (grilled, fried, baked, raw, steamed, sauteed)

CRITICAL ANTI-DUPLICATION RULES:
3. DO NOT list the same ingredient multiple times with different names:
   - WRONG: "chicken breast" AND "chicken breast, grilled" AND "grilled chicken"
   - RIGHT: "chicken breast, grilled" (ONE entry only)
   - WRONG: "olives" listed 5 times for 5 olives
   - RIGHT: "olives" listed ONCE with total weight (e.g., 30g for all 5 olives)
4. Combine all pieces of the same ingredient into ONE entry:
   - If you see 3 pieces of chicken → ONE entry with combined weight
   - If you see 10 olives → ONE entry with total weight
   - If you see multiple slices of bread → ONE entry with total weight

QUANTITY ESTIMATION - LOOK AT THE IMAGE SIZE:
5. VISUALLY ESTIMATE the portion size by comparing to reference objects:
   - Standard dinner plate: 10-11 inches (25-28 cm) diameter
   - If food covers 1/4 of plate → estimate accordingly
   - If food covers 1/2 of plate → estimate accordingly
   - If food covers full plate → estimate accordingly
   - Use utensils, hands, or containers as size references

6. Apply these VISUAL PORTION GUIDELINES (adjust based on what you SEE):
   
   CRITICAL SIZE REFERENCES:
   - Tablespoon (1 tbsp) = size of your thumb tip = ~15g for dense foods, ~15ml for liquids
   - Teaspoon (1 tsp) = size of fingertip = ~5g for dense foods, ~5ml for liquids
   - Golf ball = ~2 tablespoons = ~30g
   - Tennis ball = ~1/2 cup = ~60-80g
   - Baseball = ~1 cup = ~120-180g
   - Deck of cards = ~85g (3oz) of meat
   - Computer mouse = ~100g of meat
   - Your fist = ~1 cup = ~150-200g
   
   PROTEINS (compare to deck of cards or palm of hand):
   - Chicken breast: FULL piece (palm-sized) = ~150-170g, HALF piece = ~75-85g, SMALL portion (deck of cards) = ~85g
   - Beef steak: Palm-sized = ~170g, Deck of cards = ~85g
   - Fish fillet: Full piece = ~140g, Half = ~70g
   - Eggs: 1 large egg = ~50g, 2 eggs = ~100g
   
   GRAINS (cooked - compare to tennis ball or fist):
   - Rice: Tennis ball = ~90g, Baseball/fist = ~180g, Small scoop = ~45g
   - Pasta: Tennis ball = ~70g, Baseball = ~140g
   - Bread: 1 slice = ~30-40g, 2 slices = ~60-80g
   
   VEGETABLES (compare to tennis ball):
   - Leafy greens (spinach, lettuce): Large handful = ~30-50g, Small handful = ~15-25g
   - Broccoli/cauliflower: Few florets = ~30-50g, Tennis ball = ~90g
   - Tomato: Cherry tomato = ~15g, Slice = ~20g, Whole medium = ~120g
   - Bell pepper: Few strips = ~30g, Quarter = ~40g, Half = ~80g
   
   SPREADS/DIPS (VERY IMPORTANT - usually SMALL amounts):
   - Hummus: 1 tablespoon (thumb-sized dollop) = ~15g, 2 tablespoons = ~30g, 1/4 cup = ~60g
   - Peanut butter: 1 tablespoon = ~16g, 2 tablespoons = ~32g
   - Cream cheese: 1 tablespoon = ~15g, 2 tablespoons = ~30g
   - Guacamole: 2 tablespoons = ~30g, 1/4 cup = ~60g
   - Salsa: 2 tablespoons = ~30g
   
   CONDIMENTS (usually VERY SMALL):
   - Ketchup/mustard: Small squeeze = ~10g, 1 tablespoon = ~15g
   - Mayonnaise: 1 tablespoon = ~15g
   - Salad dressing: 1-2 tablespoons = ~15-30ml
   - Soy sauce: Drizzle = ~5ml, 1 tablespoon = ~15ml
   
   OILS (usually MINIMAL):
   - Cooking oil visible on food: Light coating = ~5-10ml, Glossy/fried = ~15-20ml
   - Butter pat: ~5g, 1 tablespoon = ~14g

7. CRITICAL VISUAL SIZE ESTIMATION (MOST IMPORTANT):
   
   STEP 1: Compare the food to the PLATE SIZE
   - Standard dinner plate = 10-11 inches (25-28cm) diameter
   - If food covers 1/8 of plate → SMALL portion (30-60g)
   - If food covers 1/4 of plate → MEDIUM portion (80-120g)
   - If food covers 1/2 of plate → LARGE portion (150-200g)
   
   STEP 2: Compare to REFERENCE OBJECTS in image
   - Utensils (fork/spoon = ~18cm long)
   - Hands/fingers if visible
   - Other foods with known sizes
   
   STEP 3: For SPREADS and DIPS - BE VERY CONSERVATIVE
   - Small dollop (thumb-sized) = 15-20g
   - Medium scoop (2 thumbs) = 30-40g
   - Large serving (golf ball) = 50-60g
   - NEVER estimate more than 100g unless it's clearly a large bowl/container
   
   STEP 4: For CONDIMENTS and SAUCES - MINIMAL amounts
   - Light drizzle = 5-10ml
   - Visible coating = 15-20ml
   - Pooling/excess = 30ml max
   
   STEP 5: When in doubt, UNDERESTIMATE rather than overestimate
   - It's better to estimate 50g and be slightly low than 400g and be way off
   - Most side items and condiments are 15-60g, NOT 100-400g

8. Account for cooking method and added ingredients:
   - Fried foods: add 10-20g cooking oil per serving
     * Deep fried (fried chicken, french fries): +20g oil
     * Pan fried (pan-fried fish, eggs): +10-15g oil
   - Sautéed vegetables: add 10-15ml oil (1 tablespoon)
   - Grilled/baked: no oil addition unless visible glaze/marinade
   - Steamed/boiled: no additions unless butter/sauce visible

9. Detect and estimate cooking oils:
   - Look for glossy surface, golden-brown color, or visible oil pooling
   - Fried items: estimate oil absorbed during cooking
   - Sautéed items: estimate oil used in pan

INGREDIENT NAMING FOR FATSECRET COMPATIBILITY:
10. Use common, searchable ingredient names:
   - "chicken breast" not "chicken" or "poultry"
   - "white rice" not "rice" or "steamed rice"
   - "olive oil" not "oil" or "cooking oil"
   - "bell pepper" not "pepper" or "capsicum"
   - "ground beef" not "beef" or "hamburger meat"
   - "cheddar cheese" not "cheese"
   - "whole wheat bread" not "bread"

11. Include preparation in name when relevant:
   - "chicken breast, grilled" for grilled chicken
   - "salmon, baked" for baked salmon
   - "potatoes, fried" for french fries
   - Use base name if preparation unclear

12. Include visible sauces, seasonings, and condiments:
   - Soy sauce, teriyaki sauce, BBQ sauce
   - Butter, margarine
   - Salad dressing, mayonnaise
   - Cheese, sour cream
   - Only include if substantial (>1 tablespoon or clearly visible)

DISH IDENTIFICATION:
13. If this is a prepared/mixed dish, provide the dish name:
   - Examples: "chicken stir-fry", "caesar salad", "beef tacos", "spaghetti bolognese"
   - Use common dish names that would be recognizable
   - Leave empty if it's just individual ingredients

CONFIDENCE SCORING:
14. Assign confidence based on:
    - 80-100: Clear view of ingredients, standard dish, good lighting
    - 60-79: Some ingredients obscured, mixed dish with uncertainty
    - 40-59: Poor visibility, complex mixed dish, unusual preparation
    - 0-39: Cannot reliably identify ingredients or quantities

EXAMPLES OF PROPER QUANTITY ESTIMATION:

Example 1 - Grilled chicken plate with sides:
  * chicken breast, grilled - 150g (full palm-sized piece, covers 1/4 of plate)
  * white rice, cooked - 90g (tennis ball size, covers 1/8 of plate)
  * broccoli florets - 40g (few florets, small handful)
  * hummus - 20g (small dollop, thumb-sized)
  * olive oil (for cooking) - 5ml (minimal visible)
  TOTAL: ~305g for entire meal

Example 2 - Breakfast plate:
  * scrambled eggs - 100g (2 eggs, covers 1/6 of plate)
  * whole wheat bread - 60g (2 slices)
  * spinach - 30g (small handful on side)
  * olives - 20g (4-5 olives, few pieces)
  * feta cheese - 15g (small crumble, tablespoon)
  TOTAL: ~225g for entire meal

Example 3 - Salad bowl:
  * lettuce - 50g (fills bowl but very light)
  * grilled chicken - 85g (deck of cards size, sliced on top)
  * cherry tomatoes - 30g (6-8 tomatoes)
  * cucumber - 40g (few slices)
  * salad dressing - 20ml (light drizzle, 1-2 tablespoons)
  TOTAL: ~225g for entire meal

NOTICE: Complete meals typically total 300-600g, NOT 1500-2000g!

FINAL CHECKLIST BEFORE RESPONDING:
✓ Each ingredient type appears ONLY ONCE in the list
✓ Multiple pieces of the same food are combined into ONE entry
✓ No duplicate entries with different names (e.g., "chicken" and "chicken breast")
✓ Quantities reflect ACTUAL visual size, not default 100g values
✓ Total ingredient count is reasonable (typically 3-8 items for a normal meal)
✓ SANITY CHECK: Total weight of ALL ingredients combined should be 300-800g for a normal meal
✓ SANITY CHECK: Spreads/dips (hummus, guacamole) should be 15-60g, NOT 200-400g
✓ SANITY CHECK: Condiments/sauces should be 5-30ml, NOT 100ml+
✓ SANITY CHECK: Side vegetables should be 30-100g, NOT 200-400g

REMEMBER: 
- DO NOT default to 100g! 
- Look at the ACTUAL VISUAL SIZE compared to the plate and reference objects
- When in doubt, UNDERESTIMATE - it's better to be slightly low than wildly high
- A spoonful of hummus is ~15-30g, NOT 400g!
- A handful of spinach is ~30g, NOT 170g!
- A few olives is ~20-40g, NOT 90g!

Return JSON with ingredient breakdown.`;
}

/**
 * JSON schema for decomposition response
 * Enforces structured output from Gemini API for Stage 2
 */
function getDecompositionSchema(regionId: string) {
  return {
    type: 'object',
    properties: {
      ingredients: {
        type: 'array',
        description: 'Array of identified ingredients with quantities',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Specific ingredient name (FatSecret-compatible)',
            },
            quantity: {
              type: 'number',
              description: 'Quantity as numeric value',
              minimum: 0,
            },
            unit: {
              type: 'string',
              description: 'Measurement unit',
              enum: ['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece'],
            },
            preparation: {
              type: 'string',
              description: 'Cooking/preparation method if visible',
            },
            confidence: {
              type: 'number',
              description: 'Confidence score from 0-100',
              minimum: 0,
              maximum: 100,
            },
          },
          required: ['name', 'quantity', 'unit', 'confidence'],
        },
      },
      dishName: {
        type: 'string',
        description: 'Name of prepared dish if applicable',
      },
      confidence: {
        type: 'number',
        description: 'Overall decomposition confidence from 0-100',
        minimum: 0,
        maximum: 100,
      },
    },
    required: ['ingredients', 'confidence'],
  };
}

// ============================================================================
// Legacy Identification Prompt (for backward compatibility)
// ============================================================================

const identificationPrompt = 'Stage 1 - Identify visible food items in the image with precision.\n\nVISUAL ANALYSIS INSTRUCTIONS:\n1. Identify ALL distinct food items you can clearly see\n2. For EACH item, analyze:\n   - Color, texture, and surface appearance (glossy = oil/sauce, charred = grilled, golden-brown = fried)\n   - Shape and structure (whole vs. chopped, intact vs. mixed)\n   - Visible ingredients or components\n   - Any garnishes, sauces, or condiments\n\nPORTION ESTIMATION TECHNIQUES:\n3. Use reference objects for size estimation:\n   - Standard dinner plates: 10-11 inches (25-28 cm) diameter\n   - Forks/spoons: ~7 inches (18 cm) length\n   - Hands: palm width ~3-4 inches (8-10 cm)\n   - Cups/bowls: standard cup ~8 oz (240 ml)\n4. Estimate coverage: "fills 1/3 of plate", "stacked 2 inches high", "size of a fist"\n5. Account for food density: leafy greens vs. dense proteins vs. liquids\n\nPREPARATION METHOD DETECTION:\n6. Look for visual indicators:\n   - Fried: golden-brown color, crispy texture, breading, glossy surface\n   - Grilled: char marks, grill lines, slightly dried edges\n   - Baked: even browning, dry surface\n   - Steamed: moist appearance, vibrant colors, no browning\n   - Raw: natural colors, no cooking marks\n   - Sauteed: light browning, glossy from oil\n\nPRIORITIZATION RULES:\n7. If more than 5 items visible, focus on the 5 largest by visual area\n8. Combine small condiments/sauces with their primary food item\n9. Ignore non-food items (napkins, utensils, decorations)\n\nCONFIDENCE SCORING GUIDELINES:\n- 80-100: Clear view, standard food, good lighting, visible reference objects\n- 60-79: Partially obscured, mixed dishes, or moderate lighting\n- 40-59: Poor lighting, unusual angle, or unfamiliar food combinations\n- 0-39: Blurry image, heavily obscured, or cannot identify food type';


// ============================================================================
// Stage 1: Image Segmentation Function
// ============================================================================

/**
 * Segments food image into distinct food regions
 * This is Stage 1 of the advanced multi-stage analysis pipeline
 * 
 * @param base64Image - Base64 encoded image data
 * @returns SegmentationResult with detected food regions
 */
export async function segmentFoodImage(base64Image: string): Promise<import('@/lib/advanced-food-analysis-types').SegmentationResult> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Google Gemini API key not configured');
  }

  const model =
    process.env.EXPO_PUBLIC_GOOGLE_GEMINI_MODEL ||
    process.env.GOOGLE_GEMINI_MODEL ||
    'gemini-2.5-flash-lite';

  const response = await runGeminiRequest({
    apiKey,
    model,
    parts: buildParts(segmentationPrompt, base64Image),
    temperature: 0.2,
    maxOutputTokens: 800,
    responseSchema: getSegmentationSchema(),
  });

  return parseSegmentation(response);
}

/**
 * Parse segmentation response from Gemini API
 * Schema enforcement guarantees structure, minimal validation needed
 */
function parseSegmentation(raw: string): import('@/lib/advanced-food-analysis-types').SegmentationResult {
  try {
    const parsed = JSON.parse(raw);

    // Validate required fields exist
    if (!parsed.regions || !Array.isArray(parsed.regions)) {
      throw new Error('Invalid segmentation response: missing regions array');
    }

    if (typeof parsed.overallConfidence !== 'number') {
      throw new Error('Invalid segmentation response: missing overallConfidence');
    }

    // Validate each region has required fields
    for (const region of parsed.regions) {
      if (!region.regionId || !region.description || typeof region.confidence !== 'number') {
        throw new Error('Invalid region data: missing required fields');
      }

      // Validate bounding box if present
      if (region.boundingBox) {
        const { x, y, width, height } = region.boundingBox;
        if (
          typeof x !== 'number' || x < 0 || x > 100 ||
          typeof y !== 'number' || y < 0 || y > 100 ||
          typeof width !== 'number' || width <= 0 || width > 100 ||
          typeof height !== 'number' || height <= 0 || height > 100
        ) {
          throw new Error('Invalid bounding box coordinates');
        }
      }
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse segmentation response:', error);

    // Fallback for parsing errors
    return {
      regions: [{
        regionId: 'region_1',
        description: 'Entire image (segmentation failed)',
        confidence: 40,
      }],
      overallConfidence: 40,
      notes: 'Segmentation parsing failed, treating entire image as single region',
    };
  }
}

// ============================================================================
// Stage 2: Ingredient Decomposition Function
// ============================================================================

/**
 * Decomposes a food region into constituent ingredients with quantities
 * This is Stage 2 of the advanced multi-stage analysis pipeline
 * 
 * @param base64Image - Base64 encoded image data
 * @param region - Food region to analyze
 * @returns DecompositionResult with identified ingredients
 */
export async function decomposeIngredients(
  base64Image: string,
  region: import('@/lib/advanced-food-analysis-types').FoodRegion
): Promise<import('@/lib/advanced-food-analysis-types').DecompositionResult> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Google Gemini API key not configured');
  }

  const model =
    process.env.EXPO_PUBLIC_GOOGLE_GEMINI_MODEL ||
    process.env.GOOGLE_GEMINI_MODEL ||
    'gemini-2.5-flash-lite';

  const prompt = getDecompositionPrompt(region);

  const response = await runGeminiRequest({
    apiKey,
    model,
    parts: buildParts(prompt, base64Image),
    temperature: 0.3, // Moderate temperature for accurate visual quantity estimation while maintaining consistency
    maxOutputTokens: 1000,
    responseSchema: getDecompositionSchema(region.regionId),
  });

  return parseDecomposition(response, region);
}

/**
 * Parse decomposition response from Gemini API
 * Schema enforcement guarantees structure, minimal validation needed
 * Handles preparation method adjustments
 */
function parseDecomposition(
  raw: string,
  region: import('@/lib/advanced-food-analysis-types').FoodRegion
): import('@/lib/advanced-food-analysis-types').DecompositionResult {
  try {
    const parsed = JSON.parse(raw);

    // Validate required fields exist
    if (!parsed.ingredients || !Array.isArray(parsed.ingredients)) {
      throw new Error('Invalid decomposition response: missing ingredients array');
    }

    if (typeof parsed.confidence !== 'number') {
      throw new Error('Invalid decomposition response: missing confidence');
    }

    // Validate each ingredient has required fields
    for (const ingredient of parsed.ingredients) {
      if (
        !ingredient.name ||
        typeof ingredient.quantity !== 'number' ||
        !ingredient.unit ||
        typeof ingredient.confidence !== 'number'
      ) {
        throw new Error('Invalid ingredient data: missing required fields');
      }

      // Validate quantity is positive
      if (ingredient.quantity <= 0) {
        console.warn(`Invalid quantity for ${ingredient.name}: ${ingredient.quantity}, setting to 1`);
        ingredient.quantity = 1;
      }

      // Validate unit is recognized
      const validUnits = ['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece'];
      if (!validUnits.includes(ingredient.unit)) {
        console.warn(`Invalid unit for ${ingredient.name}: ${ingredient.unit}, defaulting to 'g'`);
        ingredient.unit = 'g';
      }
    }

    // Apply preparation method adjustments
    const adjustedIngredients = applyPreparationAdjustments(parsed.ingredients);

    // Add regionId to each ingredient
    const ingredientsWithRegion = adjustedIngredients.map(ing => ({
      ...ing,
      regionId: region.regionId,
    }));

    return {
      ingredients: ingredientsWithRegion,
      dishName: parsed.dishName,
      confidence: parsed.confidence,
    };
  } catch (error) {
    console.error('Failed to parse decomposition response:', error);

    // Fallback for parsing errors - return minimal ingredient based on region description
    return {
      ingredients: [{
        name: region.description || 'unknown food',
        quantity: 100,
        unit: 'g',
        regionId: region.regionId,
        confidence: 30,
      }],
      confidence: 30,
    };
  }
}

/**
 * Apply preparation method adjustments to ingredients
 * Handles cooking oil additions and preparation-specific modifications
 */
function applyPreparationAdjustments(
  ingredients: import('@/lib/advanced-food-analysis-types').Ingredient[]
): import('@/lib/advanced-food-analysis-types').Ingredient[] {
  const adjusted = [...ingredients];

  // Check if cooking oil is already included
  const hasOil = ingredients.some(ing =>
    ing.name.toLowerCase().includes('oil') ||
    ing.name.toLowerCase().includes('butter')
  );

  // Track if oil was added for fried items
  let oilAddedForFried = false;

  // Detect fried items and add oil if not already present
  if (!hasOil) {
    const friedItems = ingredients.filter(ing =>
      ing.preparation?.toLowerCase().includes('fried') ||
      ing.preparation?.toLowerCase().includes('deep fried') ||
      ing.preparation?.toLowerCase().includes('pan fried')
    );

    if (friedItems.length > 0) {
      // Determine oil amount based on preparation method
      let oilAmount = 0;
      for (const item of friedItems) {
        if (item.preparation?.toLowerCase().includes('deep fried')) {
          oilAmount += 20; // 20g for deep fried items
        } else if (item.preparation?.toLowerCase().includes('pan fried')) {
          oilAmount += 12; // 12g for pan fried items
        } else {
          oilAmount += 15; // 15g default for fried items
        }
      }

      // Add cooking oil as separate ingredient
      if (oilAmount > 0) {
        adjusted.push({
          name: 'vegetable oil',
          quantity: oilAmount,
          unit: 'g',
          preparation: 'cooking oil',
          confidence: 70, // Medium confidence for estimated oil
        } as any); // regionId will be added later
        oilAddedForFried = true;
      }
    }

    // Detect sautéed items and add oil if not already present
    const sauteedItems = ingredients.filter(ing =>
      ing.preparation?.toLowerCase().includes('sauteed') ||
      ing.preparation?.toLowerCase().includes('sautéed') ||
      ing.preparation?.toLowerCase().includes('stir-fried')
    );

    if (sauteedItems.length > 0 && !oilAddedForFried) {
      // Add oil for sautéed items (typically 1 tablespoon = 15ml)
      adjusted.push({
        name: 'vegetable oil',
        quantity: 15,
        unit: 'ml',
        preparation: 'cooking oil',
        confidence: 70,
      } as any); // regionId will be added later
    }
  }

  return adjusted;
}

/**
 * Helper function to normalize ingredient names for FatSecret compatibility
 * Converts to lowercase, removes extra spaces, and standardizes common variations
 */
function normalizeIngredientName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Remove extra spaces
  normalized = normalized.replace(/\s+/g, ' ');

  // Standardize common variations
  const replacements: Record<string, string> = {
    'capsicum': 'bell pepper',
    'pepper (vegetable)': 'bell pepper',
    'spring onion': 'green onion',
    'scallion': 'green onion',
    'coriander': 'cilantro',
    'courgette': 'zucchini',
    'aubergine': 'eggplant',
    'rocket': 'arugula',
  };

  for (const [from, to] of Object.entries(replacements)) {
    if (normalized.includes(from)) {
      normalized = normalized.replace(from, to);
    }
  }

  return normalized;
}

/**
 * Validates and adjusts unrealistic ingredient quantities
 * Catches AI overestimations and applies reasonable limits
 */
function validateIngredientQuantities(
  ingredients: import('@/lib/advanced-food-analysis-types').Ingredient[]
): import('@/lib/advanced-food-analysis-types').Ingredient[] {
  return ingredients.map(ingredient => {
    const name = ingredient.name.toLowerCase();
    let adjustedQuantity = ingredient.quantity;
    let wasAdjusted = false;

    // Convert to grams for consistent checking
    let quantityInGrams = ingredient.quantity;
    if (ingredient.unit === 'oz') {
      quantityInGrams = ingredient.quantity * 28.35;
    } else if (ingredient.unit === 'ml') {
      quantityInGrams = ingredient.quantity; // Approximate for liquids
    }

    // Spreads and dips - typically 15-60g per serving
    if (
      name.includes('hummus') ||
      name.includes('guacamole') ||
      name.includes('peanut butter') ||
      name.includes('cream cheese') ||
      name.includes('tahini')
    ) {
      if (quantityInGrams > 100) {
        adjustedQuantity = 40;
        wasAdjusted = true;
        console.warn(
          `Adjusted ${ingredient.name} from ${ingredient.quantity}${ingredient.unit} to ${adjustedQuantity}g ` +
          `(spreads are typically 15-60g per serving)`
        );
      }
    }

    // Condiments and sauces - typically 5-30ml
    if (
      name.includes('ketchup') ||
      name.includes('mustard') ||
      name.includes('mayo') ||
      name.includes('soy sauce') ||
      name.includes('hot sauce') ||
      name.includes('salsa')
    ) {
      if (quantityInGrams > 50) {
        adjustedQuantity = 20;
        wasAdjusted = true;
        console.warn(
          `Adjusted ${ingredient.name} from ${ingredient.quantity}${ingredient.unit} to ${adjustedQuantity}ml ` +
          `(condiments are typically 5-30ml)`
        );
      }
    }

    // Leafy greens - typically 30-100g
    if (
      name.includes('lettuce') ||
      name.includes('spinach') ||
      name.includes('arugula') ||
      name.includes('kale') ||
      name.includes('mixed greens')
    ) {
      if (quantityInGrams > 150) {
        adjustedQuantity = 60;
        wasAdjusted = true;
        console.warn(
          `Adjusted ${ingredient.name} from ${ingredient.quantity}${ingredient.unit} to ${adjustedQuantity}g ` +
          `(leafy greens are typically 30-100g)`
        );
      }
    }

    // Small vegetables/garnishes - typically 20-80g
    if (
      name.includes('olive') ||
      name.includes('pickle') ||
      name.includes('radish') ||
      name.includes('cherry tomato')
    ) {
      if (quantityInGrams > 100) {
        adjustedQuantity = 40;
        wasAdjusted = true;
        console.warn(
          `Adjusted ${ingredient.name} from ${ingredient.quantity}${ingredient.unit} to ${adjustedQuantity}g ` +
          `(small vegetables are typically 20-80g)`
        );
      }
    }

    // Cheese - typically 15-50g
    if (name.includes('cheese') && !name.includes('cream cheese')) {
      if (quantityInGrams > 80) {
        adjustedQuantity = 40;
        wasAdjusted = true;
        console.warn(
          `Adjusted ${ingredient.name} from ${ingredient.quantity}${ingredient.unit} to ${adjustedQuantity}g ` +
          `(cheese is typically 15-50g)`
        );
      }
    }

    // Oils - typically 5-20ml
    if (name.includes('oil') || name.includes('butter')) {
      if (quantityInGrams > 30) {
        adjustedQuantity = 15;
        wasAdjusted = true;
        console.warn(
          `Adjusted ${ingredient.name} from ${ingredient.quantity}${ingredient.unit} to ${adjustedQuantity}ml ` +
          `(oils are typically 5-20ml)`
        );
      }
    }

    if (wasAdjusted) {
      return {
        ...ingredient,
        quantity: adjustedQuantity,
        confidence: Math.min(ingredient.confidence, 60), // Lower confidence for adjusted values
      };
    }

    return ingredient;
  });
}

/**
 * Deduplicates ingredients by merging similar items
 * Prevents counting the same food multiple times with different names
 */
function deduplicateIngredients(
  ingredients: import('@/lib/advanced-food-analysis-types').Ingredient[]
): import('@/lib/advanced-food-analysis-types').Ingredient[] {
  if (ingredients.length === 0) return ingredients;

  const merged: import('@/lib/advanced-food-analysis-types').Ingredient[] = [];
  const processed = new Set<number>();

  for (let i = 0; i < ingredients.length; i++) {
    if (processed.has(i)) continue;

    const current = ingredients[i];
    let totalQuantity = current.quantity;
    let lowestConfidence = current.confidence;
    const duplicateIndices = [i];

    // Find duplicates
    for (let j = i + 1; j < ingredients.length; j++) {
      if (processed.has(j)) continue;

      const other = ingredients[j];

      // Check if ingredients are duplicates (similar names)
      if (areIngredientsSimilar(current.name, other.name)) {
        // Convert to same unit if needed before adding
        const convertedQuantity = convertToSameUnit(other.quantity, other.unit, current.unit);
        if (convertedQuantity !== null) {
          totalQuantity += convertedQuantity;
          lowestConfidence = Math.min(lowestConfidence, other.confidence);
          duplicateIndices.push(j);
          processed.add(j);
        }
      }
    }

    // Add merged ingredient
    merged.push({
      ...current,
      quantity: totalQuantity,
      confidence: lowestConfidence,
    });
    processed.add(i);

    // Log if duplicates were found
    if (duplicateIndices.length > 1) {
      console.log(
        `Merged ${duplicateIndices.length} duplicate entries of "${current.name}" ` +
        `(total: ${totalQuantity}${current.unit})`
      );
    }
  }

  return merged;
}

/**
 * Check if two ingredient names refer to the same food
 */
function areIngredientsSimilar(name1: string, name2: string): boolean {
  const normalize = (name: string) =>
    name.toLowerCase()
      .replace(/,.*$/, '') // Remove everything after comma (preparation method)
      .replace(/\s+/g, ' ')
      .trim();

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  // Exact match after normalization
  if (n1 === n2) return true;

  // One name contains the other (e.g., "chicken" and "chicken breast")
  if (n1.includes(n2) || n2.includes(n1)) {
    // But not if they're completely different foods
    const differentFoods = ['oil', 'sauce', 'dressing', 'butter'];
    const isDifferent = differentFoods.some(food =>
      (n1.includes(food) && !n2.includes(food)) ||
      (!n1.includes(food) && n2.includes(food))
    );
    return !isDifferent;
  }

  return false;
}

/**
 * Convert quantity from one unit to another
 * Returns null if conversion is not possible
 */
function convertToSameUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string
): number | null {
  if (fromUnit === toUnit) return quantity;

  // Weight conversions
  if (fromUnit === 'g' && toUnit === 'oz') return quantity / 28.35;
  if (fromUnit === 'oz' && toUnit === 'g') return quantity * 28.35;

  // Volume conversions
  if (fromUnit === 'ml' && toUnit === 'cup') return quantity / 240;
  if (fromUnit === 'cup' && toUnit === 'ml') return quantity * 240;
  if (fromUnit === 'tbsp' && toUnit === 'ml') return quantity * 15;
  if (fromUnit === 'ml' && toUnit === 'tbsp') return quantity / 15;
  if (fromUnit === 'tsp' && toUnit === 'ml') return quantity * 5;
  if (fromUnit === 'ml' && toUnit === 'tsp') return quantity / 5;

  // Can't convert between weight and volume, or incompatible units
  return null;
}

/**
 * Process all food regions in parallel to extract ingredients
 * Handles partial failures gracefully by continuing with successful decompositions
 * 
 * @param base64Image - Base64 encoded image data
 * @param segmentation - Segmentation result with food regions
 * @returns Array of all ingredients from all regions
 */
export async function decomposeAllRegions(
  base64Image: string,
  segmentation: import('@/lib/advanced-food-analysis-types').SegmentationResult
): Promise<import('@/lib/advanced-food-analysis-types').Ingredient[]> {
  if (!segmentation.regions || segmentation.regions.length === 0) {
    console.warn('No regions to decompose');
    return [];
  }

  // Process all regions in parallel using Promise.allSettled for graceful failure handling
  const decompositionPromises = segmentation.regions.map(region =>
    decomposeIngredients(base64Image, region)
      .then(result => ({ status: 'fulfilled' as const, value: result, region }))
      .catch(error => ({
        status: 'rejected' as const,
        reason: error,
        region
      }))
  );

  const results = await Promise.all(decompositionPromises);

  // Collect all ingredients from successful decompositions
  const allIngredients: import('@/lib/advanced-food-analysis-types').Ingredient[] = [];
  const failedRegions: string[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      // Ingredients already have regionId added in parseDecomposition
      allIngredients.push(...result.value.ingredients);
    } else {
      // Log failure but continue with other regions
      console.error(
        `Failed to decompose region ${result.region.regionId}: ${result.region.description}`,
        result.reason
      );
      failedRegions.push(result.region.regionId);

      // Add a fallback ingredient for the failed region
      allIngredients.push({
        name: result.region.description || 'unknown food',
        quantity: 100,
        unit: 'g',
        regionId: result.region.regionId,
        confidence: 30,
      });
    }
  }

  // Validate quantities to catch unrealistic estimates
  const validated = validateIngredientQuantities(allIngredients);

  // Deduplicate ingredients to prevent counting same food multiple times
  const deduplicated = deduplicateIngredients(validated);

  // Log summary of decomposition
  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const totalCount = results.length;
  console.log(
    `Decomposition complete: ${successCount}/${totalCount} regions successful, ` +
    `${allIngredients.length} raw ingredients → ${validated.length} validated → ${deduplicated.length} final`
  );

  if (failedRegions.length > 0) {
    console.warn(`Failed regions: ${failedRegions.join(', ')}`);
  }

  return deduplicated;
}

// ============================================================================
// Main Orchestration Function - Advanced Multi-Stage Analysis
// ============================================================================

/**
 * Analyzes food image using advanced multi-stage pipeline
 * 
 * Orchestrates all four stages:
 * 1. Image Segmentation - Detect food regions
 * 2. Ingredient Decomposition - Identify ingredients with quantities
 * 3. Nutritional Lookup - Retrieve verified data from FatSecret
 * 4. Aggregation - Sum nutrients and generate breakdown
 * 
 * Requirements: 6.2, 6.3, 8.1, 8.4
 * 
 * @param imageUri - URI of the food image to analyze
 * @returns AdvancedAnalysisResult with comprehensive nutritional data
 */
export async function analyzeAdvancedFoodImage(
  imageUri: string
): Promise<import('@/lib/advanced-food-analysis-types').AdvancedAnalysisResult> {
  const startTime = Date.now();
  const stagesCompleted: string[] = [];

  try {
    // Convert image to base64
    const base64Image = await convertImageToBase64(imageUri);

    // ========================================================================
    // Stage 1: Image Segmentation
    // ========================================================================
    console.log('Stage 1: Starting image segmentation...');
    const segmentation = await segmentFoodImage(base64Image);
    stagesCompleted.push('segmentation');
    console.log(`Stage 1 complete: ${segmentation.regions.length} regions detected`);

    // ========================================================================
    // Edge Case Detection (Requirements 10.1-10.5)
    // ========================================================================
    const {
      detectEdgeCases,
      detectNoFood,
      detectSingleIngredient,
      detectPackagedFoodLabel,
      detectBeverage,
      detectComplexMixedDish,
      getNoFoodErrorMessage,
      extractSingleIngredientName,
      adjustBeverageUnits,
      limitToTopIngredients,
    } = await import('@/services/advancedFoodEdgeCases');

    // Requirement 10.5: No-food detection
    const noFoodDetection = detectNoFood(segmentation);
    if (noFoodDetection && noFoodDetection.confidence > 80) {
      console.log('Edge case detected: No food in image');
      return {
        success: false,
        error: getNoFoodErrorMessage(),
        metadata: {
          processingTimeMs: Date.now() - startTime,
          stagesCompleted,
          edgeCase: noFoodDetection,
        },
      };
    }

    // Requirement 10.2: Packaged food label detection - extract from label
    const packagedLabelDetection = detectPackagedFoodLabel(segmentation);
    if (packagedLabelDetection && packagedLabelDetection.confidence > 70) {
      console.log('Edge case detected: Packaged food label, extracting nutrition facts');

      const { extractNutritionFromLabel } = await import('@/services/advancedFoodEdgeCases');
      const region = segmentation.regions.find(r =>
        r.regionId === packagedLabelDetection.metadata?.regionId
      ) || segmentation.regions[0];

      const labelResult = await extractNutritionFromLabel(base64Image, region);

      // Add edge case metadata
      if (labelResult.success && labelResult.metadata) {
        labelResult.metadata.edgeCase = packagedLabelDetection;
      }

      return labelResult;
    }

    // Requirement 10.1: Single ingredient detection - skip decomposition
    const singleIngredientDetection = detectSingleIngredient(segmentation);
    if (singleIngredientDetection && singleIngredientDetection.confidence > 70) {
      console.log('Edge case detected: Single ingredient, skipping decomposition');

      const region = segmentation.regions[0];
      const ingredientName = extractSingleIngredientName(region);

      // Create a simple ingredient without decomposition
      const singleIngredient: import('@/lib/advanced-food-analysis-types').Ingredient = {
        name: ingredientName,
        quantity: 100, // Default quantity, will be adjusted by FatSecret serving size
        unit: 'g',
        regionId: region.regionId,
        confidence: region.confidence,
      };

      // Skip to Stage 3: Nutritional Lookup
      console.log('Stage 3: Starting nutritional lookup for single ingredient...');
      const { batchLookupNutrition } = await import('@/services/fatSecretApi');
      const enrichedIngredients = await batchLookupNutrition([singleIngredient]);
      stagesCompleted.push('lookup');

      if (enrichedIngredients.length === 0) {
        return {
          success: false,
          error: 'Could not retrieve nutritional data for the identified ingredient. Please try again.',
          metadata: {
            processingTimeMs: Date.now() - startTime,
            stagesCompleted,
            edgeCase: singleIngredientDetection,
          },
        };
      }

      // Stage 4: Aggregation
      console.log('Stage 4: Starting nutritional aggregation...');
      const { aggregateNutrition } = await import('@/services/nutritionAggregation');
      const { totalNutrition, confidence } = aggregateNutrition(enrichedIngredients);
      stagesCompleted.push('aggregation');

      const processingTimeMs = Date.now() - startTime;
      console.log(`Single ingredient analysis complete in ${processingTimeMs}ms`);

      return {
        success: true,
        data: {
          totalNutrition,
          ingredients: enrichedIngredients,
          regions: segmentation.regions,
          confidence,
        },
        metadata: {
          processingTimeMs,
          stagesCompleted,
          edgeCase: singleIngredientDetection,
        },
      };
    }

    // ========================================================================
    // Stage 2: Ingredient Decomposition (parallel processing)
    // ========================================================================
    console.log('Stage 2: Starting ingredient decomposition...');
    let ingredients = await decomposeAllRegions(base64Image, segmentation);
    stagesCompleted.push('decomposition');
    console.log(`Stage 2 complete: ${ingredients.length} ingredients identified`);

    // Requirement 6.3: Handle decomposition failures
    if (ingredients.length === 0) {
      return {
        success: false,
        error: 'Could not identify ingredients in the image. Please try a different photo with a clearer view of the food.',
        metadata: {
          processingTimeMs: Date.now() - startTime,
          stagesCompleted,
        },
      };
    }

    // ========================================================================
    // Edge Case Adjustments (Requirements 10.3, 10.4)
    // ========================================================================
    let edgeCaseMetadata: Record<string, unknown> = {};

    // Requirement 10.3: Beverage detection and unit adjustment
    const beverageDetection = detectBeverage(segmentation);
    if (beverageDetection) {
      console.log(`Edge case detected: ${beverageDetection.reason}`);
      ingredients = adjustBeverageUnits(ingredients);
      edgeCaseMetadata.beverage = beverageDetection;
    }

    // Requirement 10.4: Complex mixed dish - limit to top 5 ingredients
    const complexDishDetection = detectComplexMixedDish(segmentation);
    if (complexDishDetection && complexDishDetection.confidence > 65) {
      console.log(`Edge case detected: ${complexDishDetection.reason}`);
      const originalCount = ingredients.length;
      ingredients = limitToTopIngredients(ingredients, 5);
      console.log(`Limited ingredients from ${originalCount} to ${ingredients.length} for complex dish`);
      edgeCaseMetadata.complexDish = {
        ...complexDishDetection,
        originalIngredientCount: originalCount,
        limitedIngredientCount: ingredients.length,
      };
    }

    // ========================================================================
    // Stage 3: Nutritional Lookup (batched with FatSecret API)
    // ========================================================================
    console.log('Stage 3: Starting nutritional lookup...');
    const { batchLookupNutrition } = await import('@/services/fatSecretApi');
    const enrichedIngredients = await batchLookupNutrition(ingredients);
    stagesCompleted.push('lookup');
    console.log(`Stage 3 complete: ${enrichedIngredients.length} ingredients enriched with nutrition data`);

    // Requirement 6.1: Handle API failures with meaningful errors
    if (enrichedIngredients.length === 0) {
      return {
        success: false,
        error: 'Could not retrieve nutritional data for the identified ingredients. Please check your internet connection and try again.',
        metadata: {
          processingTimeMs: Date.now() - startTime,
          stagesCompleted,
        },
      };
    }

    // ========================================================================
    // Stage 4: Nutritional Aggregation
    // ========================================================================
    console.log('Stage 4: Starting nutritional aggregation...');
    const { aggregateNutrition, generateIngredientBreakdown } = await import('@/services/nutritionAggregation');

    const { totalNutrition, confidence } = aggregateNutrition(enrichedIngredients);
    const ingredientBreakdown = generateIngredientBreakdown(
      enrichedIngredients,
      segmentation.regions,
      totalNutrition
    );
    stagesCompleted.push('aggregation');
    console.log('Stage 4 complete: Nutritional aggregation finished');

    // ========================================================================
    // Validation and Final Result
    // ========================================================================
    const processingTimeMs = Date.now() - startTime;
    console.log(`Analysis complete in ${processingTimeMs}ms`);

    // Requirement 8.1: Track processing time
    // Requirement 8.4: Provide progress indicators (via metadata)
    const result: import('@/lib/advanced-food-analysis-types').AdvancedAnalysisResult = {
      success: true,
      data: {
        totalNutrition,
        ingredients: enrichedIngredients,
        regions: segmentation.regions,
        confidence,
      },
      metadata: {
        processingTimeMs,
        stagesCompleted,
        ...edgeCaseMetadata,
      },
    };

    // Validate the result for nutritional consistency
    return await validateAdvancedAnalysis(result);

  } catch (error) {
    // Requirement 6.2, 6.3: Provide meaningful error messages
    const {
      classifyError,
      getUserFriendlyErrorMessage,
      logError,
      AdvancedFoodAnalysisError
    } = await import('@/services/advancedFoodErrorHandling');

    // Log error for debugging
    logError(error, {
      stage: stagesCompleted[stagesCompleted.length - 1] || 'initialization',
      imageUri,
      timestamp: startTime,
    });

    const processingTimeMs = Date.now() - startTime;

    // Get user-friendly error message
    let userFriendlyError: string;

    if (error instanceof AdvancedFoodAnalysisError) {
      userFriendlyError = error.userMessage;
    } else {
      const category = classifyError(error);
      const lastStage = stagesCompleted[stagesCompleted.length - 1];
      userFriendlyError = getUserFriendlyErrorMessage(category, { stage: lastStage });
    }

    return {
      success: false,
      error: userFriendlyError,
      metadata: {
        processingTimeMs,
        stagesCompleted,
      },
    };
  }
}

/**
 * Validates advanced analysis result for nutritional consistency
 * Adjusts confidence based on fallback usage and calorie-to-macro ratios
 * 
 * Requirement 4.1, 5.5: Validate nutritional consistency
 * 
 * @param result - Analysis result to validate
 * @returns Validated result with adjusted confidence if needed
 */
async function validateAdvancedAnalysis(
  result: import('@/lib/advanced-food-analysis-types').AdvancedAnalysisResult
): Promise<import('@/lib/advanced-food-analysis-types').AdvancedAnalysisResult> {
  // Use the comprehensive validation module
  const { validateAdvancedAnalysis: validate } = await import('@/services/advancedFoodValidation');
  return validate(result);
}

/**
 * Progress callback type for tracking analysis stages
 * 
 * @param stage - Current stage name
 * @param progress - Progress percentage (0-100)
 * @param message - Optional status message
 */
export type ProgressCallback = (stage: string, progress: number, message?: string) => void;

/**
 * Analyzes food image with progress tracking for UI updates
 * 
 * Same as analyzeAdvancedFoodImage but emits progress events
 * for each stage to enable real-time UI feedback.
 * 
 * Requirement 8.4: Provide progress indicators for UI updates
 * 
 * @param imageUri - URI of the food image to analyze
 * @param onProgress - Callback function for progress updates
 * @returns AdvancedAnalysisResult with comprehensive nutritional data
 */
export async function analyzeAdvancedFoodImageWithProgress(
  imageUri: string,
  onProgress?: ProgressCallback
): Promise<import('@/lib/advanced-food-analysis-types').AdvancedAnalysisResult> {
  const startTime = Date.now();
  const stagesCompleted: string[] = [];

  try {
    // Convert image to base64
    onProgress?.('initialization', 0, 'Converting image...');
    const base64Image = await convertImageToBase64(imageUri);
    onProgress?.('initialization', 100, 'Image ready');

    // ========================================================================
    // Stage 1: Image Segmentation
    // ========================================================================
    onProgress?.('segmentation', 0, 'Detecting food regions...');
    console.log('Stage 1: Starting image segmentation...');

    const segmentation = await segmentFoodImage(base64Image);
    stagesCompleted.push('segmentation');

    onProgress?.('segmentation', 100, `Found ${segmentation.regions.length} food region(s)`);
    console.log(`Stage 1 complete: ${segmentation.regions.length} regions detected`);

    // ========================================================================
    // Edge Case Detection (Requirements 10.1-10.5)
    // ========================================================================
    const {
      detectNoFood,
      detectSingleIngredient,
      detectPackagedFoodLabel,
      detectBeverage,
      detectComplexMixedDish,
      getNoFoodErrorMessage,
      extractSingleIngredientName,
      adjustBeverageUnits,
      limitToTopIngredients,
    } = await import('@/services/advancedFoodEdgeCases');

    // Requirement 10.5: No-food detection
    const noFoodDetection = detectNoFood(segmentation);
    if (noFoodDetection && noFoodDetection.confidence > 80) {
      console.log('Edge case detected: No food in image');
      onProgress?.('error', 0, 'No food detected');
      return {
        success: false,
        error: getNoFoodErrorMessage(),
        metadata: {
          processingTimeMs: Date.now() - startTime,
          stagesCompleted,
          edgeCase: noFoodDetection,
        },
      };
    }

    // Requirement 10.2: Packaged food label detection - extract from label
    const packagedLabelDetection = detectPackagedFoodLabel(segmentation);
    if (packagedLabelDetection && packagedLabelDetection.confidence > 70) {
      console.log('Edge case detected: Packaged food label, extracting nutrition facts');
      onProgress?.('label_extraction', 0, 'Reading nutrition label...');

      const { extractNutritionFromLabel } = await import('@/services/advancedFoodEdgeCases');
      const region = segmentation.regions.find(r =>
        r.regionId === packagedLabelDetection.metadata?.regionId
      ) || segmentation.regions[0];

      const labelResult = await extractNutritionFromLabel(base64Image, region);

      // Add edge case metadata
      if (labelResult.success && labelResult.metadata) {
        labelResult.metadata.edgeCase = packagedLabelDetection;
        onProgress?.('complete', 100, 'Nutrition label extracted');
      } else {
        onProgress?.('error', 0, 'Could not read label');
      }

      return labelResult;
    }

    // Requirement 10.1: Single ingredient detection - skip decomposition
    const singleIngredientDetection = detectSingleIngredient(segmentation);
    if (singleIngredientDetection && singleIngredientDetection.confidence > 70) {
      console.log('Edge case detected: Single ingredient, skipping decomposition');
      onProgress?.('decomposition', 0, 'Single ingredient detected...');

      const region = segmentation.regions[0];
      const ingredientName = extractSingleIngredientName(region);

      // Create a simple ingredient without decomposition
      const singleIngredient: import('@/lib/advanced-food-analysis-types').Ingredient = {
        name: ingredientName,
        quantity: 100,
        unit: 'g',
        regionId: region.regionId,
        confidence: region.confidence,
      };

      onProgress?.('decomposition', 100, 'Single ingredient identified');

      // Skip to Stage 3: Nutritional Lookup
      onProgress?.('lookup', 0, 'Retrieving nutritional data...');
      console.log('Stage 3: Starting nutritional lookup for single ingredient...');
      const { batchLookupNutrition } = await import('@/services/fatSecretApi');
      const enrichedIngredients = await batchLookupNutrition([singleIngredient]);
      stagesCompleted.push('lookup');
      onProgress?.('lookup', 100, 'Nutritional data retrieved');

      if (enrichedIngredients.length === 0) {
        onProgress?.('error', 0, 'Could not retrieve nutritional data');
        return {
          success: false,
          error: 'Could not retrieve nutritional data for the identified ingredient. Please try again.',
          metadata: {
            processingTimeMs: Date.now() - startTime,
            stagesCompleted,
            edgeCase: singleIngredientDetection,
          },
        };
      }

      // Stage 4: Aggregation
      onProgress?.('aggregation', 0, 'Calculating totals...');
      console.log('Stage 4: Starting nutritional aggregation...');
      const { aggregateNutrition } = await import('@/services/nutritionAggregation');
      const { totalNutrition, confidence } = aggregateNutrition(enrichedIngredients);
      stagesCompleted.push('aggregation');
      onProgress?.('aggregation', 100, 'Analysis complete');

      const processingTimeMs = Date.now() - startTime;
      onProgress?.('complete', 100, `Completed in ${(processingTimeMs / 1000).toFixed(1)}s`);
      console.log(`Single ingredient analysis complete in ${processingTimeMs}ms`);

      return {
        success: true,
        data: {
          totalNutrition,
          ingredients: enrichedIngredients,
          regions: segmentation.regions,
          confidence,
        },
        metadata: {
          processingTimeMs,
          stagesCompleted,
          edgeCase: singleIngredientDetection,
        },
      };
    }

    // ========================================================================
    // Stage 2: Ingredient Decomposition (parallel processing)
    // ========================================================================
    onProgress?.('decomposition', 0, 'Identifying ingredients...');
    console.log('Stage 2: Starting ingredient decomposition...');

    let ingredients = await decomposeAllRegions(base64Image, segmentation);
    stagesCompleted.push('decomposition');

    onProgress?.('decomposition', 100, `Identified ${ingredients.length} ingredient(s)`);
    console.log(`Stage 2 complete: ${ingredients.length} ingredients identified`);

    // Handle decomposition failures
    if (ingredients.length === 0) {
      onProgress?.('error', 0, 'Could not identify ingredients');
      return {
        success: false,
        error: 'Could not identify ingredients in the image. Please try a different photo with a clearer view of the food.',
        metadata: {
          processingTimeMs: Date.now() - startTime,
          stagesCompleted,
        },
      };
    }

    // ========================================================================
    // Edge Case Adjustments (Requirements 10.3, 10.4)
    // ========================================================================
    let edgeCaseMetadata: Record<string, unknown> = {};

    // Requirement 10.3: Beverage detection and unit adjustment
    const beverageDetection = detectBeverage(segmentation);
    if (beverageDetection) {
      console.log(`Edge case detected: ${beverageDetection.reason}`);
      ingredients = adjustBeverageUnits(ingredients);
      edgeCaseMetadata.beverage = beverageDetection;
      onProgress?.('decomposition', 100, `Adjusted units for beverages`);
    }

    // Requirement 10.4: Complex mixed dish - limit to top 5 ingredients
    const complexDishDetection = detectComplexMixedDish(segmentation);
    if (complexDishDetection && complexDishDetection.confidence > 65) {
      console.log(`Edge case detected: ${complexDishDetection.reason}`);
      const originalCount = ingredients.length;
      ingredients = limitToTopIngredients(ingredients, 5);
      console.log(`Limited ingredients from ${originalCount} to ${ingredients.length} for complex dish`);
      edgeCaseMetadata.complexDish = {
        ...complexDishDetection,
        originalIngredientCount: originalCount,
        limitedIngredientCount: ingredients.length,
      };
      onProgress?.('decomposition', 100, `Limited to top ${ingredients.length} ingredients`);
    }

    // ========================================================================
    // Stage 3: Nutritional Lookup (batched with FatSecret API)
    // ========================================================================
    onProgress?.('lookup', 0, 'Retrieving nutritional data...');
    console.log('Stage 3: Starting nutritional lookup...');

    const { batchLookupNutritionWithProgress } = await import('@/services/fatSecretApi');

    // Use progress-aware batch lookup if available, otherwise use standard
    let enrichedIngredients;
    try {
      enrichedIngredients = await batchLookupNutritionWithProgress(
        ingredients,
        (current, total) => {
          const progress = Math.round((current / total) * 100);
          onProgress?.('lookup', progress, `Looking up ${current}/${total} ingredients...`);
        }
      );
    } catch (error) {
      // Fallback to standard batch lookup if progress version not available
      const { batchLookupNutrition } = await import('@/services/fatSecretApi');
      enrichedIngredients = await batchLookupNutrition(ingredients);
    }

    stagesCompleted.push('lookup');
    onProgress?.('lookup', 100, `Retrieved data for ${enrichedIngredients.length} ingredient(s)`);
    console.log(`Stage 3 complete: ${enrichedIngredients.length} ingredients enriched with nutrition data`);

    // Handle lookup failures
    if (enrichedIngredients.length === 0) {
      onProgress?.('error', 0, 'Could not retrieve nutritional data');
      return {
        success: false,
        error: 'Could not retrieve nutritional data for the identified ingredients. Please check your internet connection and try again.',
        metadata: {
          processingTimeMs: Date.now() - startTime,
          stagesCompleted,
        },
      };
    }

    // ========================================================================
    // Stage 4: Nutritional Aggregation
    // ========================================================================
    onProgress?.('aggregation', 0, 'Calculating totals...');
    console.log('Stage 4: Starting nutritional aggregation...');

    const { aggregateNutrition, generateIngredientBreakdown } = await import('@/services/nutritionAggregation');

    const { totalNutrition, confidence } = aggregateNutrition(enrichedIngredients);
    const ingredientBreakdown = generateIngredientBreakdown(
      enrichedIngredients,
      segmentation.regions,
      totalNutrition
    );

    stagesCompleted.push('aggregation');
    onProgress?.('aggregation', 100, 'Analysis complete');
    console.log('Stage 4 complete: Nutritional aggregation finished');

    // ========================================================================
    // Validation and Final Result
    // ========================================================================
    const processingTimeMs = Date.now() - startTime;
    onProgress?.('complete', 100, `Completed in ${(processingTimeMs / 1000).toFixed(1)}s`);
    console.log(`Analysis complete in ${processingTimeMs}ms`);

    const result: import('@/lib/advanced-food-analysis-types').AdvancedAnalysisResult = {
      success: true,
      data: {
        totalNutrition,
        ingredients: enrichedIngredients,
        regions: segmentation.regions,
        confidence,
      },
      metadata: {
        processingTimeMs,
        stagesCompleted,
        ...edgeCaseMetadata,
      },
    };

    // Validate the result for nutritional consistency
    return await validateAdvancedAnalysis(result);

  } catch (error) {
    // Provide meaningful error messages
    const {
      classifyError,
      getUserFriendlyErrorMessage,
      logError,
      AdvancedFoodAnalysisError
    } = await import('@/services/advancedFoodErrorHandling');

    // Log error for debugging
    logError(error, {
      stage: stagesCompleted[stagesCompleted.length - 1] || 'initialization',
      imageUri,
      timestamp: startTime,
    });

    const processingTimeMs = Date.now() - startTime;

    // Get user-friendly error message
    let userFriendlyError: string;

    if (error instanceof AdvancedFoodAnalysisError) {
      userFriendlyError = error.userMessage;
    } else {
      const category = classifyError(error);
      const lastStage = stagesCompleted[stagesCompleted.length - 1];
      userFriendlyError = getUserFriendlyErrorMessage(category, { stage: lastStage });
    }

    onProgress?.('error', 0, userFriendlyError);

    return {
      success: false,
      error: userFriendlyError,
      metadata: {
        processingTimeMs,
        stagesCompleted,
      },
    };
  }
}

// ============================================================================
// Legacy Analysis Function (for backward compatibility)
// ============================================================================

/**
 * Analyzes a food image using Google Gemini 2.5 Flash API
 * Returns nutritional information including calories, protein, carbs, and fat
 */
export async function analyzeFoodImage(imageUri: string): Promise<AnalysisResult> {
  try {
    // Convert image to base64
    const base64Image = await convertImageToBase64(imageUri);

    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Google Gemini API key not configured. Please add EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY to your .env file');
    }

    const model =
      process.env.EXPO_PUBLIC_GOOGLE_GEMINI_MODEL ||
      process.env.GOOGLE_GEMINI_MODEL ||
      'gemini-2.5-flash-lite';

    // Stage 1: Identify food items with enforced JSON schema
    const identificationResponse = await runGeminiRequest({
      apiKey,
      model,
      parts: buildParts(identificationPrompt, base64Image),
      temperature: 0.2,
      maxOutputTokens: 600,
      responseSchema: getIdentificationSchema(),
    });
    const identification = parseIdentification(identificationResponse);

    // Stage 2: Estimate nutrition with context from stage 1 and enforced JSON schema
    // Use temperature=0 for deterministic numeric output
    const stageTwoPrompt = buildEnhancedStageTwoPrompt(identification);
    const nutritionResponse = await runGeminiRequest({
      apiKey,
      model,
      parts: buildParts(stageTwoPrompt, base64Image),
      temperature: 0,
      maxOutputTokens: 1200,
      responseSchema: getNutritionSchema(),
    });
    const nutritionData = parseNutrition(nutritionResponse);

    // Validate nutritional data for consistency
    const validation = validateNutritionData(nutritionData);
    const finalData = validation.adjustedData || nutritionData;

    // Log validation warnings for debugging
    if (validation.warnings.length > 0) {
      console.warn('Nutrition validation warnings:', validation.warnings);
    }

    return {
      success: true,
      data: finalData,
      identification,
    };
  } catch (error) {
    console.error('Food analysis error:', error);

    // Provide more user-friendly error messages
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = 'API configuration error. Please check your settings.';
      } else if (error.message.includes('overloaded') || error.message.includes('rate limit')) {
        errorMessage = error.message; // Already user-friendly from retry logic
      } else if (error.message.includes('MAX_TOKENS')) {
        errorMessage = 'The image is too complex to analyze. Try taking a clearer photo with fewer items.';
      } else if (error.message.includes('blocked')) {
        errorMessage = 'The image could not be analyzed due to content restrictions.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message.includes('AI stopped early')) {
        errorMessage = 'Analysis was incomplete. Please try again with a different photo.';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Converts an image URI to base64 string
 */
async function convertImageToBase64(uri: string): Promise<string> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data:image/jpeg;base64, prefix if present
        const base64 = base64String.split(',')[1] || base64String;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    throw new Error('Failed to convert image to base64');
  }
}

type GeminiRequest = {
  apiKey: string;
  model: string;
  parts: Array<Record<string, unknown>>;
  temperature: number;
  maxOutputTokens: number;
  responseSchema?: Record<string, unknown>;
};

export async function runGeminiRequest({ apiKey, model, parts, temperature, maxOutputTokens, responseSchema }: GeminiRequest): Promise<string> {
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 30000; // 30 seconds timeout (Requirement 8.5)

  const makeRequest = async (tokens: number, retryCount: number = 0): Promise<{ text: string; finishReason?: string }> => {
    const generationConfig: Record<string, unknown> = {
      temperature,
      maxOutputTokens: tokens,
    };

    // Add JSON schema enforcement if provided
    if (responseSchema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = responseSchema;
    }

    // Create abort controller for timeout (Requirement 8.5)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts,
              },
            ],
            generationConfig,
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || 'Failed to analyze image';
        const statusCode = response.status;

        // Handle specific API errors
        if (errorMessage.includes('MAX_TOKENS') || errorMessage.includes('maximum number of tokens')) {
          throw new Error('MAX_TOKENS');
        }

        // Handle rate limiting and overload errors with retry (Requirement 6.4, 8.5)
        if (
          statusCode === 429 ||
          statusCode === 503 ||
          errorMessage.toLowerCase().includes('overloaded') ||
          errorMessage.toLowerCase().includes('rate limit')
        ) {
          if (retryCount < MAX_RETRIES) {
            // Exponential backoff: 1s, 2s, 4s
            const delayMs = Math.pow(2, retryCount) * 1000;
            console.warn(`API overloaded, retrying in ${delayMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return makeRequest(tokens, retryCount + 1);
          }
          throw new Error('The AI service is currently overloaded. Please try again in a few moments.');
        }

        // Handle server errors with retry (Requirement 6.4)
        if (statusCode >= 500 && statusCode < 600 && retryCount < MAX_RETRIES) {
          const delayMs = Math.pow(2, retryCount) * 1000;
          console.warn(`Gemini server error (${statusCode}), retrying in ${delayMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return makeRequest(tokens, retryCount + 1);
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      const text = extractTextFromResult(result);
      const finishReason = result?.candidates?.[0]?.finishReason;

      if (!text) {
        const blockReason = result?.promptFeedback?.blockReason;
        if (blockReason) {
          throw new Error(`AI response blocked: ${blockReason}`);
        }
        throw new Error(finishReason ? `AI stopped early: ${finishReason}` : 'No response from AI');
      }

      return { text, finishReason };
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle timeout errors (Requirement 8.5)
      if (error instanceof Error && error.name === 'AbortError') {
        if (retryCount < MAX_RETRIES) {
          const delayMs = Math.pow(2, retryCount) * 1000;
          console.warn(`Request timed out, retrying in ${delayMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return makeRequest(tokens, retryCount + 1);
        }
        throw new Error('Request timed out after multiple attempts. Please try again with a smaller or clearer image.');
      }

      // Handle network errors with retry (Requirement 6.4)
      if (
        error instanceof Error &&
        (error.message.includes('network') ||
          error.message.includes('fetch') ||
          error.message.includes('ENOTFOUND') ||
          error.message.includes('ECONNREFUSED')) &&
        retryCount < MAX_RETRIES
      ) {
        const delayMs = Math.pow(2, retryCount) * 1000;
        console.warn(`Network error, retrying in ${delayMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return makeRequest(tokens, retryCount + 1);
      }

      throw error;
    }
  };

  // First attempt with requested tokens
  try {
    const result = await makeRequest(maxOutputTokens);

    // If truncated due to MAX_TOKENS, try with more tokens (up to 2048)
    if (result.finishReason === 'MAX_TOKENS' && maxOutputTokens < 2048) {
      console.warn('Response truncated, retrying with more tokens');
      const newTokenLimit = Math.min(maxOutputTokens * 1.5, 2048);
      try {
        const retryResult = await makeRequest(newTokenLimit);
        return sanitizeModelResponse(retryResult.text);
      } catch (retryError) {
        console.warn('Retry failed, using original truncated response');
        // Continue with original truncated response
      }
    }

    return sanitizeModelResponse(result.text);
  } catch (error) {
    // Re-throw the original error
    throw error;
  }
}

export function buildParts(promptText: string, base64Image: string) {
  return [
    {
      text: promptText,
    },
    {
      inline_data: {
        mime_type: 'image/jpeg',
        data: base64Image,
      },
    },
  ];
}

function sanitizeModelResponse(content: string): string {
  let cleanedContent = content.trim();
  if (cleanedContent.startsWith('```json')) {
    cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (cleanedContent.startsWith('```')) {
    cleanedContent = cleanedContent.replace(/```\n?/g, '');
  }
  return cleanedContent.trim();
}

function extractTextFromResult(result: Record<string, unknown>): string | null {
  const candidates = Array.isArray(result['candidates'])
    ? (result['candidates'] as Array<Record<string, unknown>>)
    : [];

  for (const candidate of candidates) {
    const content = candidate['content'] as Record<string, unknown> | undefined;
    const parts = Array.isArray(content?.['parts'])
      ? (content?.['parts'] as Array<Record<string, unknown>>)
      : [];

    for (const part of parts) {
      const text = typeof part['text'] === 'string' ? (part['text'] as string) : null;
      if (text && text.trim().length > 0) {
        return text;
      }
    }
  }

  return null;
}

/**
 * Parse identification response - simplified since schema enforcement guarantees structure
 */
function parseIdentification(raw: string): IdentificationSummary {
  try {
    const parsed = JSON.parse(raw) as IdentificationSummary;

    // Schema enforcement ensures correct structure, just validate data exists
    if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      throw new Error('No items in response');
    }

    return parsed;
  } catch (error) {
    console.warn('Failed to parse identification response:', error);
    // Fallback only if schema enforcement somehow fails
    return {
      items: [{
        foodName: 'Unknown food item',
        description: 'Could not identify due to parsing error',
        portionHint: 'Unable to estimate',
        confidence: 30
      }],
      overallConfidence: 30,
      notes: 'Response parsing failed'
    };
  }
}

function buildEnhancedStageTwoPrompt(identification: IdentificationSummary): string {
  // Create a more detailed context summary
  const contextSummary = identification.items.map((item, index) => {
    return [
      `Item ${index + 1}: ${item.foodName}`,
      `  - Appearance: ${item.description}`,
      `  - Portion: ${item.portionHint}`,
      item.preparation ? `  - Preparation: ${item.preparation}` : '',
      `  - Confidence: ${item.confidence}%`,
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const imageQualityNote = identification.overallConfidence < 60
    ? '\nNOTE: Image quality or clarity is suboptimal. Adjust confidence accordingly.'
    : '';

  const ambiguityNote = identification.notes
    ? `\nSTAGE 1 NOTES: ${identification.notes}`
    : '';

  return [
    'Stage 2 - Estimate nutrition based on the image and Stage 1 findings.',
    '',
    '=== STAGE 1 IDENTIFICATION SUMMARY ===',
    contextSummary,
    imageQualityNote,
    ambiguityNote,
    '',
    '=== YOUR TASK ===',
    'Using the Stage 1 summary above AND the image, provide comprehensive nutritional analysis.',
    'Cross-reference the image to verify portion sizes and preparation methods identified in Stage 1.',
    'If you notice discrepancies between Stage 1 and what you see, trust your direct image analysis.',
    '',
    enhancedPrompt,
  ].join('\n');
}

/**
 * Parse nutrition response - simplified since schema enforcement guarantees structure
 */
function parseNutrition(raw: string): NutritionData {
  try {
    const parsed = JSON.parse(raw) as NutritionData;

    // Schema enforcement ensures correct structure, just validate required fields
    if (!parsed.foodName || typeof parsed.calories !== 'number') {
      throw new Error('Missing required fields');
    }

    return parsed;
  } catch (error) {
    console.warn('Failed to parse nutrition response:', error);
    // Fallback only if schema enforcement somehow fails
    return {
      foodName: 'Unknown food item',
      calories: 200,
      protein: 10,
      carbs: 20,
      fat: 8,
      servingSize: 'Estimated portion',
      confidence: 30,
      reasoning: 'Could not analyze due to parsing error - using estimated values'
    };
  }
}

/**
 * JSON schema for food identification response
 * Enforces structured output from Gemini API
 */
function getIdentificationSchema() {
  return {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            foodName: {
              type: 'string',
              description: 'Specific name of the food item',
            },
            description: {
              type: 'string',
              description: 'Appearance details: color, texture, visible ingredients, preparation indicators',
            },
            portionHint: {
              type: 'string',
              description: 'Size estimation with reference objects',
            },
            preparation: {
              type: 'string',
              description: 'Cooking method if detectable, or empty string if unknown',
            },
            confidence: {
              type: 'number',
              description: 'Confidence score from 0-100',
              minimum: 0,
              maximum: 100,
            },
          },
          required: ['foodName', 'description', 'portionHint', 'confidence'],
        },
      },
      overallConfidence: {
        type: 'number',
        description: 'Overall confidence score from 0-100',
        minimum: 0,
        maximum: 100,
      },
      notes: {
        type: 'string',
        description: 'Any ambiguities, image quality issues, or assumptions made',
      },
    },
    required: ['items', 'overallConfidence'],
  };
}

/**
 * JSON schema for nutrition analysis response
 * Enforces structured output from Gemini API
 */
function getNutritionSchema() {
  return {
    type: 'object',
    properties: {
      foodName: {
        type: 'string',
        description: 'Specific name(s) of all food items',
      },
      calories: {
        type: 'number',
        description: 'Total calories, rounded to nearest 10 if >100',
        minimum: 0,
      },
      protein: {
        type: 'number',
        description: 'Protein in grams, whole number',
        minimum: 0,
      },
      carbs: {
        type: 'number',
        description: 'Carbohydrates in grams, whole number',
        minimum: 0,
      },
      fat: {
        type: 'number',
        description: 'Fat in grams, whole number',
        minimum: 0,
      },
      servingSize: {
        type: 'string',
        description: 'Detailed weight/volume with breakdown. Prefer standard units: grams (g), cups, plates, pieces, oz. Examples: "180g cooked rice", "1 cup pasta", "½ plate", "2 slices bread"',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score from 0-100',
        minimum: 0,
        maximum: 100,
      },
      reasoning: {
        type: 'string',
        description: 'Brief explanation: portion estimation method, preparation adjustments, and assumptions (max 2 sentences)',
      },
    },
    required: ['foodName', 'calories', 'protein', 'carbs', 'fat', 'servingSize', 'confidence', 'reasoning'],
  };
}

/**
 * Returns user-friendly confidence message based on confidence score
 * Provides contextual guidance for different confidence thresholds
 */
export function getConfidenceMessage(confidence: number): string {
  if (confidence < 40) {
    return 'Low confidence. Please retake the photo with better lighting and a clearer view of the food.';
  } else if (confidence < 60) {
    return 'Moderate confidence. Please verify the nutritional values and adjust if needed.';
  } else if (confidence < 75) {
    return 'Good estimate. The nutritional values should be reasonably accurate.';
  } else {
    return 'High confidence. The analysis is based on clear visual information.';
  }
}

/**
 * Normalizes serving size descriptions to grams for consistency
 * Converts common measurements (cups, plates, pieces) to approximate gram weights
 * 
 * @param servingSize - Original serving size description
 * @returns Normalized weight in grams, or null if cannot normalize
 */
const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

function parseQuantityToken(raw?: string): number | null {
  if (!raw) return null;

  const token = raw.trim();
  if (!token) return null;

  if (UNICODE_FRACTIONS[token] !== undefined) {
    return UNICODE_FRACTIONS[token];
  }

  if (/^\d+\s*\/\s*\d+$/.test(token)) {
    const [numerator, denominator] = token.split('/').map(Number);
    if (denominator && !Number.isNaN(numerator) && !Number.isNaN(denominator)) {
      return numerator / denominator;
    }
    return null;
  }

  const normalized = token.replace(',', '.');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function clampNormalizedPortion(grams: number): number {
  if (!Number.isFinite(grams)) return grams;
  if (grams <= 0) return grams;

  // Hard cap to prevent runaway overestimates from ambiguous prompts
  return Math.min(grams, 600);
}

function normalizeServingToGrams(servingSize: string): number | null {
  const lower = servingSize.toLowerCase();
  const quantityPattern = '(\\d+(?:\\.\\d+)?|\\d+\\s*/\\s*\\d+|[¼½¾⅓⅔⅛⅜⅝⅞])';

  // Common conversions (approximate)
  const conversions: {
    pattern: RegExp;
    getGrams: (match: RegExpMatchArray) => number | null;
  }[] = [
    // Cups (cooked/raw)
    {
      pattern: new RegExp(`${quantityPattern}\\s*cups?\\s+(?:cooked|raw)?\\s*rice`, 'i'),
      getGrams: match => {
        const quantity = parseQuantityToken(match[1]) ?? 1;
        return 180 * quantity; // 1 cup cooked rice ≈ 180g
      },
    },
    {
      pattern: new RegExp(`${quantityPattern}\\s*cups?\\s+(?:cooked|raw)?\\s*pasta`, 'i'),
      getGrams: match => {
        const quantity = parseQuantityToken(match[1]) ?? 1;
        return 140 * quantity; // 1 cup cooked pasta ≈ 140g
      },
    },
    {
      pattern: new RegExp(`${quantityPattern}\\s*cups?\\s+(?:cooked|raw)?\\s*vegetables?`, 'i'),
      getGrams: match => {
        const quantity = parseQuantityToken(match[1]) ?? 1;
        return 150 * quantity; // 1 cup vegetables ≈ 150g
      },
    },
    {
      pattern: new RegExp(`${quantityPattern}\\s*cups?\\s+(?:cooked|raw)?\\s*beans?`, 'i'),
      getGrams: match => {
        const quantity = parseQuantityToken(match[1]) ?? 1;
        return 170 * quantity; // 1 cup beans ≈ 170g
      },
    },
    {
      pattern: new RegExp(`${quantityPattern}\\s*cups?`, 'i'),
      getGrams: match => {
        const quantity = parseQuantityToken(match[1]) ?? 1;
        return 150 * quantity; // Generic cup ≈ 150g
      },
    },

    // Plates
    {
      pattern: new RegExp(`${quantityPattern}\\s*plates?`, 'i'),
      getGrams: match => {
        const quantity = parseQuantityToken(match[1]) ?? 1;
        return 260 * quantity; // Slightly more conservative than previous 300g
      },
    },
    {
      pattern: /(?:half|½)\s*plate/i,
      getGrams: () => 130, // Half plate ≈ 130g
    },
    {
      pattern: /(?:quarter|¼)\s*plate/i,
      getGrams: () => 65, // Quarter plate ≈ 65g
    },

    // Pieces/servings
    {
      pattern: new RegExp(`${quantityPattern}\\s*(?:medium|large)?\\s*chicken\\s+breast`, 'i'),
      getGrams: match => {
        const quantity = parseQuantityToken(match[1]) ?? 1;
        return 170 * quantity; // 1 chicken breast ≈ 170g
      },
    },
    {
      pattern: new RegExp(`${quantityPattern}\\s*(?:medium|large)?\\s*egg`, 'i'),
      getGrams: match => {
        const quantity = parseQuantityToken(match[1]) ?? 1;
        return 50 * quantity; // 1 egg ≈ 50g
      },
    },
    {
      pattern: new RegExp(`${quantityPattern}\\s*slice[s]?\\s+(?:of\\s+)?bread`, 'i'),
      getGrams: match => {
        const quantity = parseQuantityToken(match[1]) ?? 1;
        return 30 * quantity; // 1 slice bread ≈ 30g
      },
    },
    {
      pattern: new RegExp(`${quantityPattern}\\s*slice[s]?\\s+(?:of\\s+)?pizza`, 'i'),
      getGrams: match => {
        const quantity = parseQuantityToken(match[1]) ?? 1;
        return 120 * quantity; // 1 slice pizza ≈ 120g
      },
    },

    // Tablespoons/teaspoons
    {
      pattern: new RegExp(`${quantityPattern}\\s*(?:tbsp|tablespoon(?:s)?)`, 'i'),
      getGrams: match => {
        const quantity = parseQuantityToken(match[1]) ?? 1;
        return 15 * quantity; // 1 tbsp ≈ 15g
      },
    },
    {
      pattern: new RegExp(`${quantityPattern}\\s*(?:tsp|teaspoon(?:s)?)`, 'i'),
      getGrams: match => {
        const quantity = parseQuantityToken(match[1]) ?? 1;
        return 5 * quantity; // 1 tsp ≈ 5g
      },
    },

    // Ounces
    {
      pattern: new RegExp(`${quantityPattern}\\s*oz`, 'i'),
      getGrams: match => {
        const quantity = parseQuantityToken(match[1]) ?? 1;
        return 28.35 * quantity; // 1 oz = 28.35g
      },
    },
  ];

  for (const { pattern, getGrams } of conversions) {
    const match = pattern.exec(lower);
    if (match) {
      const grams = getGrams(match);
      if (grams && grams > 0) {
        return Math.round(clampNormalizedPortion(grams));
      }
    }
  }

  // Try to extract explicit gram measurements
  const gramMatch = lower.match(/(\d+(?:\.\d+)?)\s*g(?:rams?)?(?:\s|$|,)/i);
  if (gramMatch) {
    const grams = Number.parseFloat(gramMatch[1]);
    if (Number.isFinite(grams) && grams > 0) {
      return Math.round(clampNormalizedPortion(grams));
    }
  }

  return null;
}

/**
 * Reconciles macros to match stated calories if discrepancy exceeds threshold
 * Scales protein, carbs, and fat proportionally to match total calories
 * 
 * @param data - Nutrition data to reconcile
 * @param threshold - Maximum allowed discrepancy (default 7%)
 * @returns Reconciled data, whether reconciliation occurred, and discrepancy percentage
 */
function reconcileMacrosToCalories(data: NutritionData, threshold: number = 0.07): {
  reconciled: NutritionData;
  wasReconciled: boolean;
  discrepancy: number;
} {
  const calculatedCalories = (data.protein * 4) + (data.carbs * 4) + (data.fat * 9);
  const discrepancy = Math.abs(calculatedCalories - data.calories) / data.calories;

  if (discrepancy <= threshold) {
    return { reconciled: data, wasReconciled: false, discrepancy };
  }

  // Reconcile: scale macros proportionally to match stated calories
  const scaleFactor = data.calories / calculatedCalories;

  return {
    reconciled: {
      ...data,
      protein: Math.round(data.protein * scaleFactor),
      carbs: Math.round(data.carbs * scaleFactor),
      fat: Math.round(data.fat * scaleFactor),
    },
    wasReconciled: true,
    discrepancy,
  };
}

/**
 * Validates nutritional data for consistency and reasonable ranges
 * Adjusts confidence scores and data if inconsistencies are detected
 */
function validateNutritionData(data: NutritionData): ValidationResult {
  const warnings: string[] = [];
  let adjustedData = { ...data };
  let isValid = true;

  // 0. NORMALIZE SERVING SIZE: Convert to grams where possible
  const normalizedGrams = normalizeServingToGrams(adjustedData.servingSize);
  if (normalizedGrams) {
    // Append normalized weight to reasoning
    adjustedData.reasoning = `${adjustedData.reasoning} [Serving normalized ≈ ${normalizedGrams}g]`;
  }

  // 1. RECONCILIATION: Fix calorie-to-macro inconsistencies first
  // Formula: protein×4 + carbs×4 + fat×9 should equal calories
  const reconciliation = reconcileMacrosToCalories(adjustedData, 0.07);

  if (reconciliation.wasReconciled) {
    adjustedData = reconciliation.reconciled;
    warnings.push(`Reconciled macros (${(reconciliation.discrepancy * 100).toFixed(1)}% discrepancy)`);
    // Reduce confidence for significant inconsistencies
    adjustedData.confidence = Math.max(30, adjustedData.confidence - 15);
    isValid = false;
  }

  // 2. Validate reasonable macro ratios (using reconciled values)
  const proteinCalories = adjustedData.protein * 4;
  const carbCalories = adjustedData.carbs * 4;
  const fatCalories = adjustedData.fat * 9;
  const totalCalories = adjustedData.calories;

  const proteinPercent = (proteinCalories / totalCalories) * 100;
  const carbPercent = (carbCalories / totalCalories) * 100;
  const fatPercent = (fatCalories / totalCalories) * 100;

  // Flag unusual macro distributions (protein 5-50%, carbs 5-80%, fat 5-60%)
  if (proteinPercent > 50 || proteinPercent < 5) {
    warnings.push(`Unusual protein ratio: ${proteinPercent.toFixed(0)}%`);
    adjustedData.confidence = Math.max(40, adjustedData.confidence - 10);
    isValid = false;
  }
  if (carbPercent > 80 || carbPercent < 5) {
    warnings.push(`Unusual carb ratio: ${carbPercent.toFixed(0)}%`);
    adjustedData.confidence = Math.max(40, adjustedData.confidence - 10);
    isValid = false;
  }
  if (fatPercent > 60 || fatPercent < 5) {
    warnings.push(`Unusual fat ratio: ${fatPercent.toFixed(0)}%`);
    adjustedData.confidence = Math.max(40, adjustedData.confidence - 10);
    isValid = false;
  }

  // 3. Validate reasonable calorie ranges (20-2000 per serving)
  if (data.calories < 20) {
    warnings.push('Unusually low calorie count');
    adjustedData.confidence = Math.max(30, adjustedData.confidence - 20);
    isValid = false;
  }
  if (data.calories > 2000) {
    warnings.push('Unusually high calorie count for single serving');
    adjustedData.confidence = Math.max(50, adjustedData.confidence - 15);
    isValid = false;
  }

  // 4. Append warnings to reasoning if any
  if (warnings.length > 0) {
    const warningText = warnings.join('; ');
    adjustedData.reasoning = `${adjustedData.reasoning} [Validation: ${warningText}]`;
  }

  return {
    isValid,
    adjustedData: warnings.length > 0 ? adjustedData : undefined,
    warnings,
  };
}
