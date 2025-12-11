/**
 * Advanced Food Analysis Orchestrator
 * 
 * Coordinates the optimized food analysis pipeline:
 * 1. Combined Segmentation + Decomposition (Single Gemini API call)
 * 2. Edge Case Detection (no-food, packaged labels, beverages, etc.)
 * 3. Nutritional Lookup (FatSecret/USDA)
 * 4. Validation and Aggregation
 * 
 * Optimized for free-tier API usage: 1 API call per image (vs 2-4 previously)
 */

import {
    AdvancedAnalysisResult,
    EnrichedIngredient,
    FoodRegion,
    Ingredient,
    SegmentationResult
} from '@/lib/advanced-food-analysis-types';
import {
    detectEdgeCases,
    extractNutritionFromLabel
} from './advancedFoodEdgeCases';
import {
    AdvancedFoodAnalysisError,
    ErrorCategory,
    getUserFriendlyErrorMessage,
    withErrorHandling
} from './advancedFoodErrorHandling'; // Check if these are exported (I believe most are)
import { validateAdvancedAnalysis } from './advancedFoodValidation';
import { lookupIngredientNutrition } from './fatSecretApi';
import { runGeminiRequest } from './geminiService';
import { validatePortionSize } from './portionValidation';

// ============================================================================
// Prompts
// ============================================================================

/**
 * Combined Segmentation + Decomposition Prompt
 * Performs both food region identification AND ingredient breakdown in a single API call
 * Uses weight_grams directly for cleaner data flow
 */
const COMBINED_ANALYSIS_PROMPT = `You are an expert nutritionist and computer vision analyst. Analyze the food image provided to output a strict JSON object containing segmentation and nutritional decomposition.

## STAGE 1: VISUAL ANALYSIS STRATEGY
1. **Identify Distinct Regions:** Separate main dishes, sides, and drinks.
2. **Structural vs. Additive Inference:**
   - **REQUIRED:** You MAY infer structural components essential to a dish's physics (e.g., if you see a Burger, you include the bottom bun; if you see Pizza, you include the crust underneath).
   - **FORBIDDEN:** Do NOT infer invisible additives (e.g., cooking oils, melted butter, sugar, salt) unless there is clear visual evidence (sheen, pooling, crystals).
3. **Volume-to-Weight Estimation:** Use visual cues (plate size, cutlery) to estimate volume, then apply density to find weight (grams).

## PORTION REFERENCE DATABASE (Use these baselines - BE CONSERVATIVE):
- **Pizza (Whole):** Neapolitan (350-450g total), American Slice (120-150g). *Note: The dough alone is usually 250g+. Never estimate a whole pizza <350g.*
- **Sandwiches/Burgers:** Bun + Meat + Toppings = 250-400g total.
- **Proteins - BE CONSERVATIVE:**
  - Sliced chicken on a plate: 100-120g (NOT 150-180g unless clearly a large portion)
  - Whole chicken breast: 120-150g
  - Steak: 150-180g
  - Salmon fillet: 120-150g
  - Scrambled eggs (typical portion): 80-100g (about 2 eggs)
  - Single egg: 50g
  - Prosciutto/ham: 30-50g
- **Starches:** Cooked Rice/Pasta cup (150g), Slice of bread (30-35g), Two bread slices (60-70g), Pizza dough (250-300g).
- **Vegetables:** Leafy greens/spinach (30-40g), Dense veg/broccoli (60-80g).
- **Dairy:** Mozzarella (80-120g), Cheese slice (20g), Parmesan (15g), Feta crumbles (25-40g), Yogurt/Labneh dollop (25-40g - smooth white = yogurt NOT feta), Sour cream (20-30g).
- **Small/Garnish:** Cherry tomato (10g), Olives (15-20g), Sauce dollop (15-20g), Fresh herbs/arugula (15g), Hummus portion (20-30g), Red pepper paste (15g).

## RESPONSE FORMAT (Strict JSON):
{
  "regions": [
    {
      "description": "Brief visual description",
      "dishName": "Formal name (e.g., 'Margherita Pizza')",
      "confidence": number (0-100),
      "boundingBox": { "ymin": 0, "xmin": 0, "ymax": 1000, "xmax": 1000 },
      "ingredients": [
        {
          "name": "Specific component (e.g., 'Pizza Dough', 'Mozzarella')",
          "weight_grams": number (integer),
          "confidence": number (0-100),
          "visual_evidence": "1-3 words (e.g., 'visible', 'inferred')"
        }
      ]
    }
  ],
  "overallConfidence": number (0-100),
  "total_plate_weight_grams": number,
  "notes": "Any ambiguity regarding hidden ingredients or image quality"
}

## CRITICAL RULES:
1. **Conservative but Realistic:** Do not overestimate, BUT do not ignore the density of carbs (bread/dough is heavy).
2. **Granularity:** Break dishes down into components (e.g., a "Burger" region should list: Bun, Patty, Lettuce, Tomato, Sauce).
3. **Confidence Scoring:**
   - <40: Do not include the ingredient.
   - 40-60: Visible but quantity/type unclear.
   - 60-80: Visible with reasonable certainty.
   - 80+: Clearly visible and identifiable.
4. **Units:** ALWAYS provide 'weight_grams' as an integer. If the item is liquid, estimate density (1ml ≈ 1g) and report grams.
5. **Structural Components:** Always include the base/foundation of dishes (pizza crust, burger bun, sandwich bread) even if partially hidden.

If no food is detected, return an empty "regions" array with explanatory notes.`;


// ============================================================================
// Main Orchestrator
// ============================================================================

/**
 * Ingredient as returned by the new prompt (uses weight_grams directly)
 */
type GeminiIngredient = {
    name: string;
    weight_grams: number;
    confidence: number;
    visual_evidence?: string;
};

/**
 * Combined analysis result type (internal use)
 * Uses the new weight_grams format from Gemini
 */
type CombinedAnalysisResult = {
    regions: Array<FoodRegion & {
        dishName?: string;
        ingredients: GeminiIngredient[];
    }>;
    overallConfidence: number;
    total_plate_weight_grams?: number;
    notes?: string;
};

export async function analyzeFoodImageAdvanced(imageUri: string, base64Image?: string): Promise<AdvancedAnalysisResult> {
    const startTime = Date.now();
    const stagesCompleted: string[] = [];

    try {
        // 0. Preparation
        const imageBase64 = base64Image ?? await import('./geminiService').then(m => m.convertImageToBase64(imageUri));
        if (!imageBase64) throw new Error("Failed to convert image to base64.");
        const apiKey = process.env.EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY!;
        if (!apiKey) throw new Error("Google Gemini API key not configured.");

        // 1. Combined Segmentation + Decomposition (SINGLE API CALL)
        stagesCompleted.push('combined_analysis');
        const combinedResult = await withErrorHandling(
            async () => performCombinedAnalysis(apiKey, imageBase64),
            { stage: 'combined_analysis' }
        );

        // Extract segmentation-compatible data for edge case detection
        const segmentationData: SegmentationResult = {
            regions: combinedResult.regions.map(r => ({
                description: r.description,
                confidence: r.confidence,
                boundingBox: r.boundingBox
            })),
            overallConfidence: combinedResult.overallConfidence,
            notes: combinedResult.notes
        };

        // 2. Edge Case Detection (uses segmentation data)
        const edgeCase = detectEdgeCases(segmentationData);

        // Handle "No Food" edge case immediately
        if (edgeCase?.type === 'no_food') {
            throw new AdvancedFoodAnalysisError(
                edgeCase.reason,
                ErrorCategory.NO_FOOD_DETECTED,
                getUserFriendlyErrorMessage(ErrorCategory.NO_FOOD_DETECTED)
            );
        }

        // Handle "Packaged Food Label" edge case
        if (edgeCase?.type === 'packaged_food_label') {
            console.log('Edge Case: Packaged Food Label detected. Switching to label extraction.');
            return extractNutritionFromLabel(imageBase64);
        }

        // 3. Extract flattened ingredients from combined result
        stagesCompleted.push('ingredient_extraction');
        const rawIngredients = combinedResult.regions.flatMap(r => r.ingredients || []);
        
        // 3.1 Filter out low-confidence ingredients (confidence < 40 per new prompt rules)
        const MIN_INGREDIENT_CONFIDENCE = 40;
        const flattenedIngredients = rawIngredients.filter(ing => {
            if (ing.confidence < MIN_INGREDIENT_CONFIDENCE) {
                console.log(
                    `🚫 Filtered out low-confidence ingredient: "${ing.name}" ` +
                    `(confidence: ${ing.confidence}%, threshold: ${MIN_INGREDIENT_CONFIDENCE}%)`
                );
                return false;
            }
            return true;
        });
        
        // 3.2 Filter out common "hidden ingredient" false positives with low-medium confidence
        const HIDDEN_INGREDIENT_PATTERNS = [
            'butter', 'milk', 'cream', 'cooking oil', 'vegetable oil', 
            'canola oil', 'salt', 'pepper', 'seasoning', 'sugar'
        ];
        const HIDDEN_INGREDIENT_CONFIDENCE_THRESHOLD = 60;
        
        const filteredIngredients = flattenedIngredients.filter(ing => {
            const nameLower = ing.name.toLowerCase();
            const isHiddenIngredientType = HIDDEN_INGREDIENT_PATTERNS.some(pattern => 
                nameLower.includes(pattern)
            );
            
            if (isHiddenIngredientType && ing.confidence < HIDDEN_INGREDIENT_CONFIDENCE_THRESHOLD) {
                console.log(
                    `🚫 Filtered out likely inferred ingredient: "${ing.name}" ` +
                    `(confidence: ${ing.confidence}%, requires: ${HIDDEN_INGREDIENT_CONFIDENCE_THRESHOLD}% for this type)`
                );
                return false;
            }
            return true;
        });

        // 3.5. Portion Validation - Adjust unrealistic weight estimates
        stagesCompleted.push('portion_validation');
        const validatedIngredients = filteredIngredients.map(ing => {
            try {
                // New format uses weight_grams directly (always in grams)
                const validation = validatePortionSize(
                    ing.name,
                    ing.weight_grams,
                    'g' // Always grams now
                );

                if (validation.wasAdjusted) {
                    console.log(
                        `⚡ Portion adjusted: "${ing.name}" ${ing.weight_grams}g → ${validation.adjustedQuantity}g ` +
                        `(${validation.category}, -${validation.confidencePenalty}% confidence)`
                    );
                    return {
                        ...ing,
                        weight_grams: validation.adjustedQuantity,
                        confidence: Math.max(0, ing.confidence - validation.confidencePenalty),
                        _wasPortionAdjusted: true,
                        _originalWeight: ing.weight_grams,
                        _adjustmentReason: validation.reason
                    };
                }
                return ing;
            } catch (error) {
                console.warn(`Portion validation failed for "${ing.name}":`, error);
                return ing;
            }
        });

        // 4. Nutritional Lookup
        stagesCompleted.push('lookup');

        // Convert new format (weight_grams) to legacy format (quantity/unit) for lookupIngredientNutrition
        const lookupPromises = validatedIngredients.map(async (ing) => {
            // Create legacy-compatible ingredient object for the lookup function
            const legacyIngredient: Ingredient = {
                name: ing.name,
                quantity: ing.weight_grams,
                unit: 'g',
                confidence: ing.confidence
            };

            const result = await lookupIngredientNutrition(legacyIngredient);
            if (result) {
                let finalConfidence = ing.confidence;
                if (result.source !== 'fatsecret') {
                    finalConfidence -= result.confidencePenalty;
                }

                return {
                    ...legacyIngredient,
                    nutrition: {
                        foodId: result.foodId,
                        foodName: result.foodName,
                        calories: result.calories,
                        protein: result.protein,
                        carbs: result.carbs,
                        fat: result.fat,
                        servingSize: result.servingSize,
                        servingUnit: result.servingUnit
                    },
                    scaledNutrition: result.scaledNutrition,
                    source: result.source,
                    confidence: Math.max(0, finalConfidence)
                } as EnrichedIngredient;
            }
            return null;
        });

        const lookupResults = await Promise.all(lookupPromises);
        const validIngredients = lookupResults.filter((i): i is EnrichedIngredient => i !== null);

        // 5. Aggregation & Validation
        stagesCompleted.push('aggregation');
        const totalNutrition = validIngredients.reduce((acc, ing) => ({
            calories: acc.calories + ing.scaledNutrition.calories,
            protein: acc.protein + ing.scaledNutrition.protein,
            carbs: acc.carbs + ing.scaledNutrition.carbs,
            fat: acc.fat + ing.scaledNutrition.fat
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

        const initialResult: AdvancedAnalysisResult = {
            success: true,
            data: {
                totalNutrition,
                ingredients: validIngredients,
                regions: segmentationData.regions,
                confidence: segmentationData.overallConfidence, // Baseline confidence
                warnings: []
            },
            metadata: {
                processingTimeMs: Date.now() - startTime,
                stagesCompleted
            }
        };

        // Run Final Validation
        const validatedResult = validateAdvancedAnalysis(initialResult);

        return validatedResult;

    } catch (error) {
        console.error('Advanced Analysis Failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Analysis failed",
            metadata: {
                processingTimeMs: Date.now() - startTime,
                stagesCompleted
            }
        };
    }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Performs combined segmentation and decomposition in a SINGLE API call
 * This reduces API usage by 50-75% compared to separate calls
 */
async function performCombinedAnalysis(apiKey: string, base64Image: string): Promise<CombinedAnalysisResult> {
    const response = await runGeminiRequest({
        apiKey,
        prompt: COMBINED_ANALYSIS_PROMPT,
        base64Image,
        maxOutputTokens: 8192,
        responseSchema: {
            type: "object",
            properties: {
                regions: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            description: { type: "string" },
                            dishName: { type: "string" },
                            confidence: { type: "number" },
                            boundingBox: {
                                type: "object",
                                properties: {
                                    ymin: { type: "number" },
                                    xmin: { type: "number" },
                                    ymax: { type: "number" },
                                    xmax: { type: "number" }
                                }
                            },
                            ingredients: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        name: { type: "string" },
                                        weight_grams: { type: "number" },
                                        confidence: { type: "number" },
                                        visual_evidence: { type: "string" }
                                    },
                                    required: ["name", "weight_grams", "confidence"]
                                }
                            }
                        },
                        required: ["description", "confidence", "ingredients"]
                    }
                },
                overallConfidence: { type: "number" },
                total_plate_weight_grams: { type: "number" },
                notes: { type: "string" }
            },
            required: ["regions", "overallConfidence"]
        }
    });

    try {
        // Log raw response for debugging
        console.log('[CombinedAnalysis] Raw response length:', response.length);
        console.log('[CombinedAnalysis] Raw response preview:', response.substring(0, 500));
        
        const parsed = JSON.parse(response);
        
        // Validate the parsed result has required fields
        if (!parsed.regions || !Array.isArray(parsed.regions)) {
            console.error('[CombinedAnalysis] Invalid response structure - missing regions array');
            throw new Error("Invalid response: missing regions array");
        }
        
        return parsed as CombinedAnalysisResult;
    } catch (e) {
        console.error('[CombinedAnalysis] Parse error:', e);
        console.error('[CombinedAnalysis] Full response:', response);
        throw new Error(`Failed to parse combined analysis result: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
}
