// Individual ingredient detected in the image
export type IngredientData = {
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type NutritionData = {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  ingredients: IngredientData[]; // Per-ingredient breakdown
  visualEvidence: string[];
  confidence: number;
  reasoning: string;
  warnings?: string[];
};

export type AnalysisResult = {
  success: boolean;
  data?: NutritionData;
  error?: string;
};

type ValidationResult = {
  isValid: boolean;
  adjustedData?: NutritionData;
  warnings: string[];
};

const enhancedPrompt = `
You are a registered dietitian analyzing a food photo. BE CONSERVATIVE and avoid overestimating. Default to smaller amounts when unsure.

## CRITICAL PORTION REFERENCE (memorize):
- Chicken breast: 100-150g cooked = 165-250 cal, 31-47g protein, 0g carbs, 4-5g fat
- Egg (1 large): 50g = 72 cal, 6g protein, 0.4g carbs, 5g fat
- Bread slice: 30-40g = 75-100 cal, 3g protein, 14-18g carbs, 1g fat (2 slices ≈ 60-80g total)
- Hummus/tzatziki/labneh thin spread: 15-30g = 25-60 cal (NEVER >30g unless clearly heaped)
- Olive oil/butter: 1 tbsp = 14g = 120 cal. Add only if visible oil pooling/glossy.
- Leafy greens: 1 cup = 30g = 7 cal (negligible).
- Olives: 5 medium = 20g = 25 cal.

## ESTIMATION RULES:
1) Always choose the LOWER plausible grams; do not assume large hidden portions.
2) If food sits flat on sauce, count sauce as 15-30g max.
3) Visible grilled chicken typically ONE breast (100-150g), not more.
4) Small sides (pickles/olives/spinach) are 20-50g each, not 100g+.
5) Total plate mass usually 400-700g unless obviously huge; default calories 500-850 unless clearly large/fried.
6) If uncertain, downscale grams by 15-25% rather than upscaling.
7) Never exceed 900 calories unless multiple large starches/fried items are clearly visible.

## OUTPUT FORMAT (strict JSON):
{
  "foodName": "Brief description",
  "ingredients": [
    {"name": "Grilled chicken breast", "grams": 120, "calories": 198, "protein": 37, "carbs": 0, "fat": 4},
    {"name": "Hummus spread", "grams": 25, "calories": 42, "protein": 2, "carbs": 4, "fat": 2},
    {"name": "Bread slice", "grams": 35, "calories": 90, "protein": 3, "carbs": 16, "fat": 1}
  ],
  "servingSize": "Total Xg (sum of ingredients)",
  "calories": (sum of ingredient calories),
  "protein": (sum),
  "carbs": (sum),
  "fat": (sum),
  "visualEvidence": ["specific visual cues used"],
  "confidence": 0-100 (lower if blurry/uncertain),
  "reasoning": "Step-by-step: identified X items, estimated portions conservatively based on visual size relative to plate/fork",
  "warnings": ["any potential over/undercount notes"]
}

VALIDATION (MANDATORY):
- Ensure (protein×4)+(carbs×4)+(fat×9) ≈ calories (±10%). If mismatch, adjust calories/macro grams down to match.
- Total calories should generally be 500-850 unless clearly large; if >900 without obvious large/fried items, scale down.
- Ingredients must sum to totals; do not invent extra hidden portions.
`;

/**
 * Analyzes a food image using Google Gemini 2.5 Flash-Lite
 * Returns nutritional information including calories, protein, carbs, and fat
 */
export async function analyzeFoodImage(imageUri: string): Promise<AnalysisResult> {
  try {
    console.log('Starting food analysis for image:', imageUri);

    // Convert image to base64
    const base64Image = await convertImageToBase64(imageUri);
    console.log('Image converted to base64 successfully');

    const geminiKey = process.env.EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error('Google Gemini API key not configured. Please add EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY to your .env file');
    }
    console.log('Gemini API key found');

    // Single-stage analysis: Gemini identifies food and calculates nutrition
    console.log('Sending request to Gemini API...');
    const nutritionResponse = await runGeminiRequest({
      apiKey: geminiKey,
      prompt: enhancedPrompt,
      base64Image,
    });
    console.log('Received response from Gemini API');

    console.log('Parsing nutrition data...');
    const nutritionData = parseNutrition(nutritionResponse);
    console.log('Nutrition data parsed:', nutritionData);

    // Validate nutritional data for consistency
    const validation = validateNutritionData(nutritionData);
    const finalData = validation.adjustedData || nutritionData;
    finalData.warnings = validation.warnings;

    // Log validation warnings for debugging
    if (validation.warnings.length > 0) {
      console.warn('Nutrition validation warnings:', validation.warnings);
    }

    return {
      success: true,
      data: finalData,
    };
  } catch (error) {
    console.error('Food analysis error:', error);

    // Provide more user-friendly error messages
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = 'API configuration error. Please check your settings.';
      } else if (error.message.includes('MAX_TOKENS') || error.message.includes('max_tokens')) {
        errorMessage = 'The image is too complex to analyze. Try taking a clearer photo with fewer items.';
      } else if (error.message.includes('blocked') || error.message.includes('content_filter')) {
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
 * @deprecated Temporary alias for callers migrated to advanced pipeline naming.
 * Use analyzeFoodImage while advanced analysis consolidates.
 */
export async function analyzeAdvancedFoodImage(imageUri: string): Promise<AnalysisResult> {
  return analyzeFoodImage(imageUri);
}

/**
 * Converts an image URI to base64 string
 */
async function convertImageToBase64(uri: string): Promise<string> {
  try {
    console.log('Converting image to base64, URI:', uri);
    const response = await fetch(uri);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    console.log('Blob size:', blob.size, 'type:', blob.type);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;

        if (!base64String) {
          reject(new Error('FileReader returned null or undefined'));
          return;
        }

        console.log('Base64 string length:', base64String.length);

        // Remove data:image/jpeg;base64, prefix if present
        const base64 = base64String.includes(',')
          ? base64String.split(',')[1]
          : base64String;

        if (!base64) {
          reject(new Error('Failed to extract base64 data from result'));
          return;
        }

        console.log('Final base64 length:', base64.length);
        resolve(base64);
      };
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Image conversion error:', error);
    throw new Error(`Failed to convert image to base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

type GeminiRequest = {
  apiKey: string;
  prompt: string;
  base64Image: string;
};

/**
 * Runs a request to Google Gemini API with vision capabilities
 * Using gemini-2.5-flash-lite (stable model) for optimized low-latency food image analysis
 */
async function runGeminiRequest({ apiKey, prompt, base64Image }: GeminiRequest): Promise<string> {
  try {
    const model = 'gemini-2.5-flash-lite';
    console.log('Using Gemini model:', model);

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
              parts: [
                {
                  text: prompt,
                },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 1,
            maxOutputTokens: 2048,
            responseMimeType: "application/json"
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error response:', JSON.stringify(errorData, null, 2));
      const errorMessage = errorData.error?.message || errorData.message || 'Failed to analyze image with Gemini';
      throw new Error(`Gemini API Error: ${errorMessage}`);
    }

    const result = await response.json();
    console.log('Gemini API success response:', JSON.stringify(result, null, 2));

    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      const finishReason = result?.candidates?.[0]?.finishReason;
      console.error('No text in response. Full result:', JSON.stringify(result, null, 2));
      throw new Error(finishReason ? `AI stopped early: ${finishReason}` : 'No response from Gemini AI');
    }

    return sanitizeModelResponse(text);
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
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

function parseNutrition(raw: string): NutritionData {
  try {
    const parsed = JSON.parse(raw);
    return normalizeNutritionData(parsed);
  } catch (error) {
    // Try to fix common truncation issues
    let fixedRaw = raw.trim();

    // If JSON is incomplete, try to close it (e.g. if token limit cut it off)
    if (!fixedRaw.endsWith('}')) {
      const openBraces = (fixedRaw.match(/{/g) || []).length;
      const closeBraces = (fixedRaw.match(/}/g) || []).length;
      const missingBraces = openBraces - closeBraces;

      if (missingBraces > 0) {
        fixedRaw += '}'.repeat(missingBraces);
      }
    }

    try {
      const parsed = JSON.parse(fixedRaw);
      return normalizeNutritionData(parsed);
    } catch (secondError) {
      // Return fallback nutrition data if repair fails
      console.warn('Failed to parse nutrition response, using fallback');
      return {
        foodName: 'Unknown food item',
        calories: 150,
        protein: 8,
        carbs: 15,
        fat: 6,
        servingSize: 'Estimated portion',
        ingredients: [],
        visualEvidence: ['Could not analyze visual details due to error'],
        confidence: 25,
        reasoning: 'Could not analyze due to parsing error - using conservative estimated values'
      };
    }
  }
}

/**
 * Normalizes parsed data to ensure all required fields exist
 * Recalculates totals from ingredients if available
 */
function normalizeNutritionData(parsed: Record<string, unknown>): NutritionData {
  // Ensure ingredients array exists
  const ingredients: IngredientData[] = Array.isArray(parsed.ingredients)
    ? parsed.ingredients.map((ing: Record<string, unknown>) => ({
        name: String(ing.name || 'Unknown item'),
        grams: Number(ing.grams) || 0,
        calories: Number(ing.calories) || 0,
        protein: Number(ing.protein) || 0,
        carbs: Number(ing.carbs) || 0,
        fat: Number(ing.fat) || 0,
      }))
    : [];

  // If we have ingredients, recalculate totals from them (more accurate)
  let calories = Number(parsed.calories) || 0;
  let protein = Number(parsed.protein) || 0;
  let carbs = Number(parsed.carbs) || 0;
  let fat = Number(parsed.fat) || 0;

  if (ingredients.length > 0) {
    const summed = ingredients.reduce(
      (acc, ing) => ({
        calories: acc.calories + ing.calories,
        protein: acc.protein + ing.protein,
        carbs: acc.carbs + ing.carbs,
        fat: acc.fat + ing.fat,
        grams: acc.grams + ing.grams,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, grams: 0 }
    );

    // Use summed values from ingredients (more reliable)
    calories = summed.calories;
    protein = summed.protein;
    carbs = summed.carbs;
    fat = summed.fat;

    // Update serving size to reflect actual total grams
    if (summed.grams > 0) {
      parsed.servingSize = `${Math.round(summed.grams)}g total`;
    }
  }

  return {
    foodName: String(parsed.foodName || 'Food item'),
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    servingSize: String(parsed.servingSize || 'Estimated portion'),
    ingredients,
    visualEvidence: Array.isArray(parsed.visualEvidence)
      ? parsed.visualEvidence.map(String)
      : ['No visual evidence provided'],
    confidence: Number(parsed.confidence) || 50,
    reasoning: String(parsed.reasoning || 'No reasoning provided'),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
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
 * Validates nutritional data for consistency and reasonable ranges
 * Adjusts confidence scores and data if inconsistencies are detected
 */
function validateNutritionData(data: NutritionData): ValidationResult {
  const warnings: string[] = [];

  // Ensure visualEvidence exists and is an array (safety check for the new field)
  const safeVisualEvidence = Array.isArray(data.visualEvidence)
    ? data.visualEvidence
    : ['No visual evidence provided'];

  // Ensure ingredients exists and is an array
  const safeIngredients = Array.isArray(data.ingredients)
    ? data.ingredients
    : [];

  // Initialize adjustedData with safe fields
  let adjustedData = {
    ...data,
    visualEvidence: safeVisualEvidence,
    ingredients: safeIngredients,
  };

  let isValid = true;

  const roundCaloriesValue = (value: number): number => {
    if (!Number.isFinite(value) || value < 0) {
      return 0;
    }
    return value > 100 ? Math.round(value / 10) * 10 : Math.round(value);
  };

  const totalIngredientGrams = safeIngredients.reduce((sum, ing) => sum + (ing.grams || 0), 0);

  // Heuristic: if no ingredient breakdown and calories are high, downscale conservatively
  if ((safeIngredients.length === 0 || safeIngredients.every((ing) => !ing.grams)) && data.calories > 900) {
    warnings.push('No ingredient breakdown; applying conservative downscale');
    const scaleFactor = 0.65;
    adjustedData.calories = roundCaloriesValue(data.calories * scaleFactor);
    adjustedData.protein = Math.max(0, Math.round(data.protein * scaleFactor));
    adjustedData.carbs = Math.max(0, Math.round(data.carbs * scaleFactor));
    adjustedData.fat = Math.max(0, Math.round(data.fat * scaleFactor));
    adjustedData.confidence = Math.max(30, data.confidence - 20);
    isValid = false;
  }

  // Heuristic: if ingredient grams are modest but calories are high, downscale
  if (totalIngredientGrams > 0 && totalIngredientGrams < 700 && adjustedData.calories > 900) {
    warnings.push('Calories high relative to portion size; applying conservative downscale');
    const scaleFactor = 0.75;
    adjustedData.calories = roundCaloriesValue(adjustedData.calories * scaleFactor);
    adjustedData.protein = Math.max(0, Math.round(adjustedData.protein * scaleFactor));
    adjustedData.carbs = Math.max(0, Math.round(adjustedData.carbs * scaleFactor));
    adjustedData.fat = Math.max(0, Math.round(adjustedData.fat * scaleFactor));
    adjustedData.confidence = Math.max(35, adjustedData.confidence - 15);
    isValid = false;
  }

  // 1. Validate calorie-to-macro consistency
  // Formula: protein×4 + carbs×4 + fat×9 ≈ calories
  const calculatedCalories = (data.protein * 4) + (data.carbs * 4) + (data.fat * 9);

  // Handle potential division by zero
  const calorieDiscrepancy = data.calories > 0
    ? Math.abs(calculatedCalories - data.calories) / data.calories
    : (calculatedCalories > 0 ? 1 : 0);

  if (calorieDiscrepancy > 0.15) { // More than 15% discrepancy
    warnings.push('Calorie-to-macro mismatch detected, applying conservative adjustment');

    const totalMacroCalories = calculatedCalories;

    if (totalMacroCalories <= 0) {
      warnings.push('Macro totals are zero or invalid; reducing reported calories by 25% for safety');
      adjustedData.calories = roundCaloriesValue(data.calories * 0.75);
    } else if (totalMacroCalories < data.calories) {
      const adjustedCalories = roundCaloriesValue(totalMacroCalories);
      warnings.push(
        `Reported calories (${data.calories}) exceed macro-derived total (${adjustedCalories}); using macro-derived calories`
      );
      adjustedData.calories = adjustedCalories;
    } else {
      // If reported calories are much HIGHER than macros sum, scale macros UP? 
      // Or if reported is LOWER than macros sum?
      // Original Logic: Scale macros DOWN if they sum to more than the reported calories,
      // OR scale macros to match reported calories if reported is the anchor.
      // The logic here scales macros to match the reported calories if the reported calories 
      // are considered the source of truth but the macros don't add up.

      const scaleFactor = data.calories / totalMacroCalories;
      warnings.push('Scaling macronutrients to match reported calorie total');
      adjustedData.protein = Math.max(0, Math.round(data.protein * scaleFactor));
      adjustedData.carbs = Math.max(0, Math.round(data.carbs * scaleFactor));
      adjustedData.fat = Math.max(0, Math.round(data.fat * scaleFactor));
    }

    // Apply confidence penalty
    adjustedData.confidence = Math.max(30, data.confidence - 15);
    isValid = false;
  }

  // 2. Validate reasonable macro ratios
  // Use adjusted values to check the final result
  const proteinCalories = adjustedData.protein * 4;
  const carbCalories = adjustedData.carbs * 4;
  const fatCalories = adjustedData.fat * 9;
  const totalCalories = adjustedData.calories;

  if (totalCalories > 0) {
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
  } else {
    warnings.push('Total calories reported as zero; macro ratio validation skipped');
    isValid = false;
  }

  // 3. Validate reasonable calorie ranges (20-2000 per serving)
  if (adjustedData.calories < 20) {
    warnings.push('Unusually low calorie count');
    adjustedData.confidence = Math.max(30, adjustedData.confidence - 20);
    isValid = false;
  }
  if (adjustedData.calories > 2000) {
    warnings.push('Unusually high calorie count for single serving');
    adjustedData.confidence = Math.max(50, adjustedData.confidence - 15);
    isValid = false;
  }

  // 4. Append warnings to reasoning if any
  if (warnings.length > 0) {
    const warningText = warnings.join('; ');
    const currentReasoning = adjustedData.reasoning || '';
    adjustedData.reasoning = `${currentReasoning} [Validation: ${warningText}]`.trim();
  }

  return {
    isValid,
    adjustedData: warnings.length > 0 ? adjustedData : undefined,
    warnings,
  };
}
