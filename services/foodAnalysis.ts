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

const enhancedPrompt = 'Analyze this food image and provide detailed nutritional information.\n\nCRITICAL INSTRUCTIONS:\n\n1. PORTION SIZE ESTIMATION:\n   - Use reference objects visible in the image (plates, utensils, hands)\n   - Standard plate = 10-11 inches diameter\n   - Cross-reference with Stage 1 portion hints\n   - Account for food density: 1 cup leafy greens does not equal 1 cup rice in weight\n\n2. PREPARATION METHOD ADJUSTMENTS:\n   - Fried foods: Add 10-20% calories for oil absorption\n     * Deep fried: +20% (e.g., fried chicken, french fries)\n     * Pan fried: +10-15% (e.g., pan-fried fish)\n   - Grilled/baked: Use base nutritional values\n   - Sauteed: Add ~1 tbsp oil (120 cal, 14g fat) per serving\n   - Steamed/boiled: Use base values, no additions\n\n3. COMPREHENSIVE ITEM ACCOUNTING:\n   - Include ALL visible food items from Stage 1\n   - Account for sauces, dressings, and condiments\n   - Estimate butter, oil, or cheese if visible\n   - Consider garnishes if substantial (>1 tbsp)\n\n4. USDA DATABASE STANDARDS:\n   - Base all estimates on USDA nutritional data\n   - Use median values for foods with recipe variations\n   - Round calories to nearest 10 for portions >100 cal\n   - Round macros (protein, carbs, fat) to nearest whole gram\n\n5. NUTRITIONAL VALIDATION:\n   - Verify: (protein * 4) + (carbs * 4) + (fat * 9) should equal total calories (+/-10%)\n   - If mismatch, adjust macros proportionally to match calories\n   - Protein: typically 10-35% of calories\n   - Carbs: typically 45-65% of calories\n   - Fat: typically 20-35% of calories\n\n6. CONFIDENCE SCORING:\n   - Reduce confidence if:\n     * Image quality is poor (blurry, dark, obscured)\n     * Portion size is ambiguous (no reference objects)\n     * Food type is unusual or mixed dish\n     * Preparation method is unclear\n   - High confidence (75-100): Clear image, standard food, visible portions\n   - Medium confidence (50-74): Some ambiguity in portion or preparation\n   - Low confidence (<50): Significant uncertainty in identification or quantity\n\n7. CONSERVATIVE ESTIMATES:\n   - When uncertain, estimate on the lower end for calories\n   - Better to underestimate than overestimate for user trust\n   - Note uncertainty in reasoning field\n\nReturn ONLY valid JSON:\n{\n  "foodName": "specific name(s) of all food items",\n  "calories": number (rounded to nearest 10 if >100),\n  "protein": number (grams, whole number),\n  "carbs": number (grams, whole number),\n  "fat": number (grams, whole number),\n  "servingSize": "detailed weight/volume with breakdown",\n  "confidence": number (0-100),\n  "reasoning": "brief explanation: portion estimation method, preparation adjustments, and any assumptions (max 2 sentences)"\n}\n\nIMPORTANT: Ensure nutritional consistency. Verify that (protein*4 + carbs*4 + fat*9) is within 10% of total calories.';

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
    return JSON.parse(raw) as NutritionData;
  } catch (error) {
    // Try to fix common truncation issues
    let fixedRaw = raw.trim();

    // If JSON is incomplete, try to close it
    if (!fixedRaw.endsWith('}')) {
      const openBraces = (fixedRaw.match(/{/g) || []).length;
      const closeBraces = (fixedRaw.match(/}/g) || []).length;
      const missingBraces = openBraces - closeBraces;

      if (missingBraces > 0) {
        fixedRaw += '}'.repeat(missingBraces);
      }
    }

    try {
      return JSON.parse(fixedRaw) as NutritionData;
    } catch (secondError) {
      // Return fallback nutrition data
      console.warn('Failed to parse nutrition response, using fallback');
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
  let adjustedData = { ...data };
  let isValid = true;

  const roundCaloriesValue = (value: number): number => {
    if (!Number.isFinite(value) || value < 0) {
      return 0;
    }
    return value > 100 ? Math.round(value / 10) * 10 : Math.round(value);
  };

  // 1. Validate calorie-to-macro consistency
  // Formula: protein×4 + carbs×4 + fat×9 ≈ calories
  const calculatedCalories = (data.protein * 4) + (data.carbs * 4) + (data.fat * 9);
  const calorieDiscrepancy = Math.abs(calculatedCalories - data.calories) / data.calories;

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
      const scaleFactor = data.calories / totalMacroCalories;
      warnings.push('Scaling macronutrients down to match reported calorie total');
      adjustedData.protein = Math.max(0, Math.round(data.protein * scaleFactor));
      adjustedData.carbs = Math.max(0, Math.round(data.carbs * scaleFactor));
      adjustedData.fat = Math.max(0, Math.round(data.fat * scaleFactor));
    }

    adjustedData.confidence = Math.max(30, data.confidence - 15);
    isValid = false;
  }

  // 2. Validate reasonable macro ratios
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
    adjustedData.reasoning = `${adjustedData.reasoning} [Validation: ${warningText}]`;
  }

  return {
    isValid,
    adjustedData: warnings.length > 0 ? adjustedData : undefined,
    warnings,
  };
}