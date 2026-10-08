/**
 * Advanced Food Analysis Orchestrator
 * 
 * Coordinates the optimized food analysis pipeline:
 * 1. Combined Segmentation + Decomposition (Single Azure API call)
 * 2. Edge Case Detection (no-food, packaged labels, beverages, etc.)
 * 3. Nutritional Lookup (built-in reference estimates)
 * 4. Validation and Aggregation
 * 
 * One recognition call per image, plus optional topping refinement or label reading.
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
    extractNutritionFromLabel
} from './advancedFoodEdgeCases';
import {
    AdvancedFoodAnalysisError,
    ErrorCategory,
    getUserFriendlyErrorMessage,
    withErrorHandling
} from './advancedFoodErrorHandling';
import { validateAdvancedAnalysis } from './advancedFoodValidation';
import { lookupIngredientNutrition } from './localNutrition';
import { runPhotoAnalysis, convertImageToBase64 } from './photoAnalysis';
import { deduplicateIngredients } from './ingredientDeduplication';
import { validatePortionSize } from './portionValidation';
import { containsFoodPhrase, isBeverageName, normalizeFoodName } from './foodNames';

// ============================================================================
// Main Orchestrator
// ============================================================================

/**
 * Ingredient as returned by the new prompt (uses weight_grams directly)
 */
type VisionIngredient = {
    name: string;
    weight_grams: number;
    confidence: number;
    visual_evidence?: string;
};

/**
 * Combined analysis result type (internal use)
 * Uses the new weight_grams format from Azure
 */
type CombinedAnalysisResult = {
    regions: (FoodRegion & {
        dishName?: string;
        ingredients: VisionIngredient[];
    })[];
    overallConfidence: number;
    total_plate_weight_grams?: number;
    notes?: string;
};




const LAYERED_DISH_KEYWORDS = [
    'pizza',
    'flatbread',
    'toast',
];

const GARNISH_KEYWORDS = [
    'cilantro',
    'parsley',
    'basil',
    'mint',
    'chives',
    'dill',
    'lime',
    'lemon',
    'scallion',
    'green onion',
    'microgreens',
    'herb',
];

function isBeverageIngredient(name: string): boolean {
    return isBeverageName(name);
}

function isGarnishIngredient(name: string): boolean {
    return GARNISH_KEYWORDS.some(keyword => containsFoodPhrase(name, keyword));
}

function isLayeredDishRegion(description?: string, dishName?: string): boolean {
    const text = `${description ?? ''} ${dishName ?? ''}`.toLowerCase();
    return LAYERED_DISH_KEYWORDS.some(keyword => containsFoodPhrase(text, keyword));
}

function hasLayeredIngredient(ingredients: VisionIngredient[] | undefined): boolean {
    if (!ingredients) return false;
    return ingredients.some(ing =>
        LAYERED_DISH_KEYWORDS.some(keyword => containsFoodPhrase(ing.name, keyword))
    );
}

function isGenericLayeredName(name: string): boolean {
    const lower = name.toLowerCase().trim();
    return LAYERED_DISH_KEYWORDS.some(keyword => lower === keyword);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function normalizeBoundingBox(
    boundingBox: Record<string, unknown> | undefined
): FoodRegion['boundingBox'] | undefined {
    if (!boundingBox) {
        return undefined;
    }

    if (
        typeof boundingBox.x === 'number' &&
        typeof boundingBox.y === 'number' &&
        typeof boundingBox.width === 'number' &&
        typeof boundingBox.height === 'number'
    ) {
        return {
            x: boundingBox.x,
            y: boundingBox.y,
            width: boundingBox.width,
            height: boundingBox.height,
        };
    }

    if (
        typeof boundingBox.xmin === 'number' &&
        typeof boundingBox.ymin === 'number' &&
        typeof boundingBox.xmax === 'number' &&
        typeof boundingBox.ymax === 'number'
    ) {
        return {
            x: boundingBox.xmin,
            y: boundingBox.ymin,
            width: Math.max(0, boundingBox.xmax - boundingBox.xmin),
            height: Math.max(0, boundingBox.ymax - boundingBox.ymin),
        };
    }

    return undefined;
}

function normalizeBeverageQuantityMl(quantityMl: number): {
    adjustedQuantity: number;
    wasAdjusted: boolean;
    confidencePenalty: number;
    reason: string;
} {
    if (!Number.isFinite(quantityMl) || quantityMl <= 0) {
        throw new Error('Beverage quantity must be positive and finite.');
    }

    // Preserve the visible volume; only enforce the supported schema ceiling.
    const adjustedQuantity = Math.min(quantityMl, 10000);

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
        const imageBase64 = base64Image ?? await convertImageToBase64(imageUri);
        if (!imageBase64) throw new Error("Failed to convert image to base64.");

        // 1. Combined Segmentation + Decomposition (SINGLE API CALL)
        stagesCompleted.push('combined_analysis');
        const combinedResult = await withErrorHandling(
            async () => performCombinedAnalysis(imageBase64),
            { stage: 'combined_analysis', maxRetries: 0 }
        );

        if (combinedResult.notes) warnings.push(combinedResult.notes);

        // Extract segmentation-compatible data for edge case detection
        const segmentationData: SegmentationResult = {
            regions: combinedResult.regions.map(r => ({
                description: r.description,
                dishName: r.dishName,
                confidence: r.confidence,
                boundingBox: normalizeBoundingBox(r.boundingBox as Record<string, unknown> | undefined)
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

        // 2.1 Optional layered-dish refinement (pizza/flatbread/toast)
        const layeredCandidateIndex = combinedResult.regions.findIndex(region =>
            (isLayeredDishRegion(region.description, region.dishName) || hasLayeredIngredient(region.ingredients)) &&
            (region.ingredients?.length ?? 0) <= 2
        );
        if (layeredCandidateIndex >= 0) {
            stagesCompleted.push('layered_refine');
            const region = combinedResult.regions[layeredCandidateIndex];
            const dishLabel = region.dishName || region.description || 'layered dish';
            let refinedIngredients: VisionIngredient[] = [];
            try {
                refinedIngredients = await withErrorHandling(
                    async () => refineLayeredDishIngredients(imageBase64, dishLabel),
                    { stage: 'layered_refine', maxRetries: 0 }
                );
            } catch {
                warnings.push('Topping refinement was unavailable. Kept the original recognition; confirm the visible toppings.');
            }

            const sanitizedRefined = refinedIngredients.filter(ing => !isGenericLayeredName(ing.name));

            if (sanitizedRefined.length >= 2) {
                combinedResult.regions[layeredCandidateIndex] = {
                    ...region,
                    ingredients: sanitizedRefined
                };
                warnings.push('Layered dish refinement applied to improve topping extraction.');
            } else {
                warnings.push('Layered dish refinement attempted but toppings were not reliably detected.');
            }
        }

        // 3. Extract flattened ingredients from combined result
        stagesCompleted.push('ingredient_extraction');
        const rawIngredients = combinedResult.regions.flatMap((r, regionIndex) =>
            (r.ingredients || []).map(ingredient => ({ ...ingredient, regionIndex }))
        );
        if (rawIngredients.some(ingredient => !ingredient.name?.trim() ||
            !Number.isFinite(ingredient.weight_grams) || ingredient.weight_grams <= 0 ||
            !Number.isFinite(ingredient.confidence) || ingredient.confidence < 0 || ingredient.confidence > 100)) {
            throw new Error('Food analysis returned invalid ingredients. Please try another photo.');
        }
        
        // 3.1 Filter out low-confidence ingredients (confidence < 40 per new prompt rules)
        const MIN_INGREDIENT_CONFIDENCE = 40;
        const GARNISH_CONFIDENCE_THRESHOLD = 30;
        const flattenedIngredients = rawIngredients.filter(ing => {
            if (ing.confidence < MIN_INGREDIENT_CONFIDENCE) {
                if (isGarnishIngredient(ing.name) && ing.confidence >= GARNISH_CONFIDENCE_THRESHOLD) {
                    console.log(
                        `🌿 Keeping low-confidence garnish: "${ing.name}" ` +
                        `(confidence: ${ing.confidence}%, garnish threshold: ${GARNISH_CONFIDENCE_THRESHOLD}%)`
                    );
                    return true;
                }
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
            const nameLower = normalizeFoodName(ing.name);
            const isHiddenIngredientType = HIDDEN_INGREDIENT_PATTERNS.some(pattern => 
                nameLower === pattern
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

        const omittedNames = rawIngredients.filter(ingredient => !filteredIngredients.includes(ingredient))
            .map(ingredient => ingredient.name);
        if (omittedNames.length) {
            warnings.push('Uncertain detections excluded: ' + [...new Set(omittedNames)].join(', ') +
                '. Confirm visible foods before saving; the nutrition total may be incomplete.');
        }

        // 3.3 Convert to canonical Ingredient shape for downstream processing
        let ingredientsForProcessing: Ingredient[] = filteredIngredients.map(ing => ({
            name: ing.name,
            quantity: ing.weight_grams,
            unit: 'g',
            confidence: ing.confidence,
            regionIndex: ing.regionIndex,
        }));

        // Keep the structured ingredient names and weights; region captions are
        // not a reason to replace a food or collapse several visible ingredients.
        if (!ingredientsForProcessing.length) {
            throw new Error('No food ingredients could be identified reliably. Please try a clearer photo.');
        }

        // 3.5 Portion validation: preserve amounts and surface serving warnings.
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
                if (validation.warning) warnings.push(validation.warning);

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

        // 3.6 Merge repeated labels within regions and add separate portions.
        stagesCompleted.push('dedupe');
        const dedupe = deduplicateIngredients(ingredientsForProcessing);
        ingredientsForProcessing = dedupe.uniqueIngredients;
        if (dedupe.mergedCount > 0) {
            warnings.push(`Merged ${dedupe.mergedCount} duplicate ingredient(s) for consistency.`);
        }

        // Retain every reliable visible ingredient, including lower-volume fats
        // and sauces that can materially change a mixed dish's nutrition.
        if (edgeCase?.type === 'complex_mixed_dish') {
            stagesCompleted.push('complex_dish_review');
            warnings.push('Mixed dish: ingredients and portions are estimates. Confirm the visible ingredients and serving size.');
        }

        // 3.8 Normalize beverage units (e.g., milk/coffee) to volume where applicable
        ingredientsForProcessing = adjustBeverageUnits(ingredientsForProcessing);

        // 4. Nutritional Lookup
        stagesCompleted.push('lookup');

        const lookupPromises = ingredientsForProcessing.map(async (ingredient) => {
            const result = await lookupIngredientNutrition(ingredient);
            if (result) {
                let finalConfidence = ingredient.confidence;
                finalConfidence -= result.confidencePenalty;

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
        const adjustments = Array.from(
            new Set(
                validIngredients.flatMap(ingredient =>
                    ingredient.wasAdjusted && ingredient.adjustmentReason
                        ? [`${ingredient.name}: ${ingredient.adjustmentReason}`]
                        : []
                )
            )
        );

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
                warnings,
                adjustments: adjustments.length > 0 ? adjustments : undefined,
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
 * Refines ingredients for layered dishes (pizza/flatbread/toast) using a targeted prompt.
 * Returns a list of ingredients or an empty list if extraction fails.
 */
async function refineLayeredDishIngredients(
    base64Image: string,
    dishLabel: string
): Promise<VisionIngredient[]> {
    const response = await runPhotoAnalysis({ mode: 'refine', base64Image, dishLabel });

    try {
        const parsed = JSON.parse(response) as { ingredients?: VisionIngredient[] };
        if (!parsed.ingredients || !Array.isArray(parsed.ingredients)) {
            return [];
        }
        return parsed.ingredients;
    } catch (error) {
        console.warn('[LayeredRefine] Failed to parse refinement response:', error);
        return [];
    }
}

/**
 * Performs combined segmentation and decomposition in a SINGLE API call
 * This reduces API usage by 50-75% compared to separate calls
 */
async function performCombinedAnalysis(base64Image: string): Promise<CombinedAnalysisResult> {
    const response = await runPhotoAnalysis({ mode: 'analyze', base64Image });
    const parsed = JSON.parse(response) as CombinedAnalysisResult;
    if (!parsed || !Array.isArray(parsed.regions) ||
        !Number.isFinite(parsed.overallConfidence) || parsed.overallConfidence < 0 || parsed.overallConfidence > 100 ||
        parsed.regions.some(region => typeof region.description !== 'string' || !Array.isArray(region.ingredients))) {
        throw new Error('Invalid food recognition response. Please try another photo.');
    }
    return parsed;
}
