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
    adjustBeverageUnits,
    extractSingleIngredientName,
    limitToTopIngredients,
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
import { deduplicateIngredients } from './ingredientDeduplication';
import { validatePortionSize } from './portionValidation';

// ============================================================================
// Prompts
// ============================================================================

/**
 * Combined Segmentation + Decomposition Prompt
 * Performs both food region identification AND ingredient breakdown in a single API call
 * Uses weight_grams directly for cleaner data flow
 */
const COMBINED_ANALYSIS_PROMPT = `Analyze food image. Return MINIMAL JSON with nutritional breakdown.

RULES:
- Only include ingredients with confidence >= 40
- Use conservative weight estimates (grams)
- DO NOT infer hidden ingredients (oils, butter, salt) unless visually evident
- Include structural components (bun, crust, bread) even if partially hidden
- Keep descriptions SHORT (1-3 words max)
- Limit to MAX 10 ingredients per region

PORTION GUIDE (grams):
Proteins: chicken breast 120-150, steak 150-180, salmon 120-150, eggs 50 each
Starches: rice/pasta cup 150, bread slice 30-35, pizza dough 250-300
Dairy: mozzarella 80-120, cheese slice 20, yogurt dollop 25-40
Vegetables: leafy greens 30-40, dense veg 60-80
Small items: cherry tomato 10, olives 15-20, sauce 15-20, herbs 15

OUTPUT FORMAT:
{
  "regions": [{
    "description": "short description",
    "dishName": "dish name",
    "confidence": 0-100,
    "boundingBox": {"ymin":0,"xmin":0,"ymax":1000,"xmax":1000},
    "ingredients": [{"name":"ingredient","weight_grams":100,"confidence":80,"visual_evidence":"visible"}]
  }],
  "overallConfidence": 0-100,
  "total_plate_weight_grams": 0,
  "notes": ""
}

If no food detected, return empty regions array.`;


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

const DEFAULT_GEMINI_TEMPERATURE = 0.1;

const BEVERAGE_KEYWORDS = [
    'juice',
    'soda',
    'water',
    'coffee',
    'tea',
    'milk',
    'smoothie',
    'shake',
    'beer',
    'wine',
    'cocktail',
];

function isBeverageIngredient(name: string): boolean {
    const nameLower = name.toLowerCase();
    return BEVERAGE_KEYWORDS.some(keyword => nameLower.includes(keyword));
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function normalizeBeverageQuantityMl(quantityMl: number): {
    adjustedQuantity: number;
    wasAdjusted: boolean;
    confidencePenalty: number;
    reason: string;
} {
    if (!Number.isFinite(quantityMl) || quantityMl <= 0) {
        return {
            adjustedQuantity: 250,
            wasAdjusted: true,
            confidencePenalty: 15,
            reason: `Beverage volume was invalid (${quantityMl}). Defaulted to 250ml for stability.`,
        };
    }

    // Keep this mild: clamp extremes and round to reduce jitter across runs.
    const clamped = clamp(quantityMl, 30, 600);
    const rounded = Math.round(clamped / 25) * 25;
    const adjustedQuantity = clamp(rounded, 30, 600);

    const wasAdjusted = adjustedQuantity !== quantityMl;
    if (!wasAdjusted) {
        return { adjustedQuantity, wasAdjusted: false, confidencePenalty: 0, reason: '' };
    }

    const diffRatio = Math.abs(adjustedQuantity - quantityMl) / Math.max(1, quantityMl);
    const confidencePenalty = clamp(Math.round(diffRatio * 20), 3, 15);
    const reason = `Beverage volume normalized from ${quantityMl.toFixed(0)}ml to ${adjustedQuantity.toFixed(0)}ml for stability.`;

    return { adjustedQuantity, wasAdjusted: true, confidencePenalty, reason };
}

export async function analyzeFoodImageAdvanced(imageUri: string, base64Image?: string): Promise<AdvancedAnalysisResult> {
    const startTime = Date.now();
    const stagesCompleted: string[] = [];
    const warnings: string[] = [];

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

        // 3.3 Convert to canonical Ingredient shape for downstream processing
        let ingredientsForProcessing: Ingredient[] = filteredIngredients.map(ing => ({
            name: ing.name,
            quantity: ing.weight_grams,
            unit: 'g',
            confidence: ing.confidence
        }));

        // 3.4 Edge-case handling that affects ingredient stability
        if (edgeCase?.type === 'single_ingredient' && segmentationData.regions.length === 1) {
            stagesCompleted.push('single_ingredient_normalization');
            const extractedName = extractSingleIngredientName(segmentationData.regions[0]);

            const normalizedTarget = extractedName.toLowerCase();
            const bestMatch =
                ingredientsForProcessing.find(i => i.name.toLowerCase().includes(normalizedTarget) || normalizedTarget.includes(i.name.toLowerCase())) ??
                [...ingredientsForProcessing].sort((a, b) => b.confidence - a.confidence)[0];

            const fallbackQuantity =
                (bestMatch?.quantity && Number.isFinite(bestMatch.quantity) ? bestMatch.quantity : undefined) ??
                (combinedResult.total_plate_weight_grams && combinedResult.total_plate_weight_grams > 0 ? combinedResult.total_plate_weight_grams : undefined) ??
                100;

            ingredientsForProcessing = [
                {
                    name: extractedName,
                    quantity: fallbackQuantity,
                    unit: 'g',
                    confidence: clamp(bestMatch?.confidence ?? segmentationData.overallConfidence, 0, 100),
                }
            ];
        }

        // 3.5 Portion Validation - Adjust unrealistic portion estimates
        stagesCompleted.push('portion_validation');
        ingredientsForProcessing = ingredientsForProcessing.map(ing => {
            try {
                // Handle beverages separately: weights from vision models are often jittery and
                // the generic portion constraints are tuned for solids.
                if (isBeverageIngredient(ing.name)) {
                    const normalization = normalizeBeverageQuantityMl(ing.quantity);
                    if (normalization.wasAdjusted) {
                        console.log(
                            `🥤 Beverage normalized: "${ing.name}" ${ing.quantity.toFixed(0)}ml → ${normalization.adjustedQuantity.toFixed(0)}ml ` +
                            `(-${normalization.confidencePenalty}% confidence)`
                        );
                    }
                    return {
                        ...ing,
                        unit: 'ml',
                        quantity: normalization.adjustedQuantity,
                        confidence: Math.max(0, ing.confidence - normalization.confidencePenalty),
                        wasAdjusted: normalization.wasAdjusted ? true : ing.wasAdjusted,
                        adjustmentReason: normalization.wasAdjusted ? normalization.reason : ing.adjustmentReason,
                    };
                }

                const validation = validatePortionSize(ing.name, ing.quantity, 'g');

                if (validation.wasAdjusted) {
                    console.log(
                        `⚡ Portion adjusted: "${ing.name}" ${ing.quantity}g → ${validation.adjustedQuantity}g ` +
                        `(${validation.category}, -${validation.confidencePenalty}% confidence)`
                    );
                    return {
                        ...ing,
                        quantity: validation.adjustedQuantity,
                        confidence: Math.max(0, ing.confidence - validation.confidencePenalty),
                        category: validation.category,
                        wasAdjusted: true,
                        adjustmentReason: validation.reason
                    };
                }
                return ing;
            } catch (error) {
                console.warn(`Portion validation failed for "${ing.name}":`, error);
                return ing;
            }
        });

        // 3.6 Deduplicate to avoid double-counting across regions / synonyms
        stagesCompleted.push('dedupe');
        const dedupe = deduplicateIngredients(ingredientsForProcessing);
        ingredientsForProcessing = dedupe.uniqueIngredients;
        if (dedupe.mergedCount > 0) {
            warnings.push(`Merged ${dedupe.mergedCount} duplicate ingredient(s) for consistency.`);
        }

        // 3.7 Complex mixed dish: limit to most prominent ingredients
        if (edgeCase?.type === 'complex_mixed_dish') {
            stagesCompleted.push('complex_dish_limit');
            const limited = limitToTopIngredients(ingredientsForProcessing, 5);
            if (limited.length < ingredientsForProcessing.length) {
                warnings.push('Complex dish detected: limited to top ingredients for consistency.');
            }
            ingredientsForProcessing = limited;
        }

        // 3.8 Normalize beverage units (e.g., milk/coffee) to volume where applicable
        ingredientsForProcessing = adjustBeverageUnits(ingredientsForProcessing);

        // 4. Nutritional Lookup
        stagesCompleted.push('lookup');

        const lookupPromises = ingredientsForProcessing.map(async (ingredient) => {
            const result = await lookupIngredientNutrition(ingredient);
            if (result) {
                let finalConfidence = ingredient.confidence;
                if (result.source !== 'fatsecret') {
                    finalConfidence -= result.confidencePenalty;
                }

                return {
                    ...ingredient,
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
                warnings
            },
            metadata: {
                processingTimeMs: Date.now() - startTime,
                stagesCompleted,
                ingredientMergeLog: dedupe.mergedCount > 0 ? dedupe.mergeLog : undefined,
                edgeCase: edgeCase ?? undefined
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
 * Attempts to repair truncated JSON by closing open brackets/braces
 * This handles cases where the API response was cut off mid-stream
 */
function attemptJsonRepair(jsonStr: string): string {
    let repaired = jsonStr.trim();
    
    // Fix malformed floating-point numbers (e.g., "308.447723388671944553..." with excessive decimals)
    // These can occur when the model generates invalid numeric output
    repaired = repaired.replace(/:\s*(\d+\.\d{10,})\d*/g, (match, num) => {
        // Truncate to 6 decimal places max
        const truncated = parseFloat(num).toFixed(6);
        return `: ${parseFloat(truncated)}`;
    });
    
    // Count open brackets/braces
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escapeNext = false;
    
    for (const char of repaired) {
        if (escapeNext) {
            escapeNext = false;
            continue;
        }
        if (char === '\\') {
            escapeNext = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;
        
        if (char === '{') openBraces++;
        else if (char === '}') openBraces--;
        else if (char === '[') openBrackets++;
        else if (char === ']') openBrackets--;
    }
    
    // If we're in a string, close it
    if (inString) {
        repaired += '"';
    }
    
    // Remove trailing incomplete key-value pairs (e.g., `"key":` or `"key": `)
    repaired = repaired.replace(/,?\s*"[^"]*":\s*$/, '');
    
    // Close any open brackets/braces
    while (openBrackets > 0) {
        repaired += ']';
        openBrackets--;
    }
    while (openBraces > 0) {
        repaired += '}';
        openBraces--;
    }
    
    return repaired;
}

/**
 * Performs combined segmentation and decomposition in a SINGLE API call
 * This reduces API usage by 50-75% compared to separate calls
 */
async function performCombinedAnalysis(apiKey: string, base64Image: string): Promise<CombinedAnalysisResult> {
    const temperatureRaw =
        process.env.EXPO_PUBLIC_GEMINI_TEMPERATURE ??
        process.env.GOOGLE_GEMINI_TEMPERATURE;
    const parsedTemperature = temperatureRaw !== undefined ? Number(temperatureRaw) : NaN;
    const temperature = Number.isFinite(parsedTemperature)
        ? clamp(parsedTemperature, 0, 1)
        : DEFAULT_GEMINI_TEMPERATURE;

    const response = await runGeminiRequest({
        apiKey,
        prompt: COMBINED_ANALYSIS_PROMPT,
        base64Image,
        temperature,
        maxOutputTokens: 16384, // Increased from 8192 to handle complex meals
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

    // Log raw response for debugging
    console.log('[CombinedAnalysis] Raw response length:', response.length);
    console.log('[CombinedAnalysis] Raw response preview:', response.substring(0, 500));
    
    // First attempt: parse as-is
    try {
        const parsed = JSON.parse(response);
        
        if (!parsed.regions || !Array.isArray(parsed.regions)) {
            console.error('[CombinedAnalysis] Invalid response structure - missing regions array');
            throw new Error("Invalid response: missing regions array");
        }
        
        return parsed as CombinedAnalysisResult;
    } catch (firstError) {
        console.warn('[CombinedAnalysis] Initial parse failed, attempting JSON repair...');
        
        // Second attempt: try to repair truncated JSON
        try {
            const repairedJson = attemptJsonRepair(response);
            console.log('[CombinedAnalysis] Repaired JSON length:', repairedJson.length);
            
            const parsed = JSON.parse(repairedJson);
            
            if (!parsed.regions || !Array.isArray(parsed.regions)) {
                throw new Error("Invalid response: missing regions array after repair");
            }
            
            console.log('[CombinedAnalysis] JSON repair successful!');
            return parsed as CombinedAnalysisResult;
        } catch (repairError) {
            console.error('[CombinedAnalysis] Parse error:', firstError);
            console.error('[CombinedAnalysis] Repair also failed:', repairError);
            console.error('[CombinedAnalysis] Full response:', response);
            throw new Error(`Failed to parse combined analysis result: ${firstError instanceof Error ? firstError.message : 'Unknown error'}`);
        }
    }
}
