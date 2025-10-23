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

const enhancedPrompt = 'Analyze this food image and provide detailed nutritional information.\n\nCRITICAL INSTRUCTIONS:\n\n1. PORTION SIZE ESTIMATION:\n   - Use reference objects visible in the image (plates, utensils, hands)\n   - Standard plate = 10-11 inches diameter\n   - Cross-reference with Stage 1 portion hints\n   - Account for food density: 1 cup leafy greens does not equal 1 cup rice in weight\n\n2. PREPARATION METHOD ADJUSTMENTS:\n   - Fried foods: Add 10-20% calories for oil absorption\n     * Deep fried: +20% (e.g., fried chicken, french fries)\n     * Pan fried: +10-15% (e.g., pan-fried fish)\n   - Grilled/baked: Use base nutritional values\n   - Sauteed: Add ~1 tbsp oil (120 cal, 14g fat) per serving\n   - Steamed/boiled: Use base values, no additions\n\n3. COMPREHENSIVE ITEM ACCOUNTING:\n   - Include ALL visible food items from Stage 1\n   - Account for sauces, dressings, and condiments\n   - Estimate butter, oil, or cheese if visible\n   - Consider garnishes if substantial (>1 tbsp)\n\n4. USDA DATABASE STANDARDS:\n   - Base all estimates on USDA nutritional data\n   - Use median values for foods with recipe variations\n   - Round calories to nearest 10 for portions >100 cal\n   - Round macros (protein, carbs, fat) to nearest whole gram\n\n5. NUTRITIONAL VALIDATION:\n   - Verify: (protein * 4) + (carbs * 4) + (fat * 9) should equal total calories (+/-10%)\n   - If mismatch, adjust macros proportionally to match calories\n   - Protein: typically 10-35% of calories\n   - Carbs: typically 45-65% of calories\n   - Fat: typically 20-35% of calories\n\n6. CONFIDENCE SCORING:\n   - Reduce confidence if:\n     * Image quality is poor (blurry, dark, obscured)\n     * Portion size is ambiguous (no reference objects)\n     * Food type is unusual or mixed dish\n     * Preparation method is unclear\n   - High confidence (75-100): Clear image, standard food, visible portions\n   - Medium confidence (50-74): Some ambiguity in portion or preparation\n   - Low confidence (<50): Significant uncertainty in identification or quantity\n\n7. CONSERVATIVE ESTIMATES:\n   - When uncertain, estimate on the lower end for calories\n   - Better to underestimate than overestimate for user trust\n   - Note uncertainty in reasoning field\n\nReturn ONLY valid JSON:\n{\n  "foodName": "specific name(s) of all food items",\n  "calories": number (rounded to nearest 10 if >100),\n  "protein": number (grams, whole number),\n  "carbs": number (grams, whole number),\n  "fat": number (grams, whole number),\n  "servingSize": "detailed weight/volume with breakdown",\n  "confidence": number (0-100),\n  "reasoning": "brief explanation: portion estimation method, preparation adjustments, and any assumptions (max 2 sentences)"\n}\n\nIMPORTANT: Ensure nutritional consistency. Verify that (protein*4 + carbs*4 + fat*9) is within 10% of total calories.';

const identificationPrompt = 'Stage 1 - Identify visible food items in the image with precision.\n\nVISUAL ANALYSIS INSTRUCTIONS:\n1. Identify ALL distinct food items you can clearly see\n2. For EACH item, analyze:\n   - Color, texture, and surface appearance (glossy = oil/sauce, charred = grilled, golden-brown = fried)\n   - Shape and structure (whole vs. chopped, intact vs. mixed)\n   - Visible ingredients or components\n   - Any garnishes, sauces, or condiments\n\nPORTION ESTIMATION TECHNIQUES:\n3. Use reference objects for size estimation:\n   - Standard dinner plates: 10-11 inches (25-28 cm) diameter\n   - Forks/spoons: ~7 inches (18 cm) length\n   - Hands: palm width ~3-4 inches (8-10 cm)\n   - Cups/bowls: standard cup ~8 oz (240 ml)\n4. Estimate coverage: "fills 1/3 of plate", "stacked 2 inches high", "size of a fist"\n5. Account for food density: leafy greens vs. dense proteins vs. liquids\n\nPREPARATION METHOD DETECTION:\n6. Look for visual indicators:\n   - Fried: golden-brown color, crispy texture, breading, glossy surface\n   - Grilled: char marks, grill lines, slightly dried edges\n   - Baked: even browning, dry surface\n   - Steamed: moist appearance, vibrant colors, no browning\n   - Raw: natural colors, no cooking marks\n   - Sauteed: light browning, glossy from oil\n\nPRIORITIZATION RULES:\n7. If more than 5 items visible, focus on the 5 largest by visual area\n8. Combine small condiments/sauces with their primary food item\n9. Ignore non-food items (napkins, utensils, decorations)\n\nCONFIDENCE SCORING GUIDELINES:\n- 80-100: Clear view, standard food, good lighting, visible reference objects\n- 60-79: Partially obscured, mixed dishes, or moderate lighting\n- 40-59: Poor lighting, unusual angle, or unfamiliar food combinations\n- 0-39: Blurry image, heavily obscured, or cannot identify food type\n\nReturn ONLY valid JSON:\n{\n  "items": [\n    {\n      "foodName": "specific name",\n      "description": "appearance details: color, texture, visible ingredients, preparation indicators",\n      "portionHint": "size estimation with reference",\n      "preparation": "cooking method if detectable, else null",\n      "confidence": number (0-100)\n    }\n  ],\n  "overallConfidence": number (0-100),\n  "notes": "any ambiguities, image quality issues, or assumptions made"\n}';


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
      'gemini-flash-latest';

    // Stage 1: Identify food items
    const identificationResponse = await runGeminiRequest({
      apiKey,
      model,
      parts: buildParts(identificationPrompt, base64Image),
      temperature: 0.2,
      maxOutputTokens: 600,
    });
    const identification = parseIdentification(identificationResponse);

    // Stage 2: Estimate nutrition with context from stage 1
    const stageTwoPrompt = buildEnhancedStageTwoPrompt(identification);
    const nutritionResponse = await runGeminiRequest({
      apiKey,
      model,
      parts: buildParts(stageTwoPrompt, base64Image),
      temperature: 0.3,
      maxOutputTokens: 1200,
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
};

async function runGeminiRequest({ apiKey, model, parts, temperature, maxOutputTokens }: GeminiRequest): Promise<string> {
  const makeRequest = async (tokens: number): Promise<{ text: string; finishReason?: string }> => {
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
          generationConfig: {
            temperature,
            maxOutputTokens: tokens,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || 'Failed to analyze image';

      // Handle specific API errors
      if (errorMessage.includes('MAX_TOKENS') || errorMessage.includes('maximum number of tokens')) {
        throw new Error('MAX_TOKENS');
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

function buildParts(promptText: string, base64Image: string) {
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

function parseIdentification(raw: string): IdentificationSummary {
  let parsed: Partial<IdentificationSummary> & {
    items?: Array<Partial<IdentifiedFoodItem>>;
    notes?: unknown;
  };

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    // Try to fix common truncation issues
    let fixedRaw = raw.trim();

    // If JSON is incomplete, try to close it
    if (!fixedRaw.endsWith('}')) {
      // Count open braces and try to close them
      const openBraces = (fixedRaw.match(/{/g) || []).length;
      const closeBraces = (fixedRaw.match(/}/g) || []).length;
      const missingBraces = openBraces - closeBraces;

      if (missingBraces > 0) {
        fixedRaw += '}'.repeat(missingBraces);
      }
    }

    // Try to parse the fixed JSON
    try {
      parsed = JSON.parse(fixedRaw);
    } catch (secondError) {
      // If still failing, return a default structure
      console.warn('Failed to parse identification response, using fallback');
      parsed = {
        items: [{
          foodName: 'Unknown food item',
          description: 'Could not identify due to parsing error',
          portionHint: 'Unable to estimate',
          confidence: 30
        }],
        overallConfidence: 30,
        notes: 'Response was truncated or malformed'
      };
    }
  }

  const items = Array.isArray(parsed.items)
    ? parsed.items.map((item): IdentifiedFoodItem => {
      const foodName =
        typeof item?.foodName === 'string' && item.foodName.trim().length > 0
          ? item.foodName.trim()
          : 'Unknown item';
      const description =
        typeof item?.description === 'string' ? item.description.trim() : '';
      const portionHint =
        typeof item?.portionHint === 'string' ? item.portionHint.trim() : '';
      let preparation: string | null | undefined;
      if (typeof item?.preparation === 'string') {
        const trimmed = item.preparation.trim();
        preparation = trimmed.length > 0 ? trimmed : undefined;
      } else if (item?.preparation === null) {
        preparation = null;
      }
      const confidence =
        typeof item?.confidence === 'number' && Number.isFinite(item.confidence)
          ? item.confidence
          : 0;

      return {
        foodName,
        description,
        portionHint,
        preparation,
        confidence,
      };
    })
    : [];

  const overallConfidence =
    typeof parsed.overallConfidence === 'number' && Number.isFinite(parsed.overallConfidence)
      ? parsed.overallConfidence
      : items.length > 0
        ? Math.round(
          items.reduce((total, item) => total + (Number.isFinite(item.confidence) ? item.confidence : 0), 0) /
          items.length
        )
        : 0;

  const notes =
    typeof parsed.notes === 'string' && parsed.notes.trim().length > 0 ? parsed.notes.trim() : undefined;

  return {
    items,
    overallConfidence,
    notes,
  };
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

function condenseIdentificationForPrompt(identification: IdentificationSummary) {
  return {
    items: identification.items.slice(0, 5).map((item) => ({
      foodName: item.foodName,
      description: item.description,
      portionHint: item.portionHint,
      preparation: item.preparation ?? null,
      confidence: Number.isFinite(item.confidence) ? Math.round(item.confidence) : 0,
    })),
    overallConfidence: Number.isFinite(identification.overallConfidence)
      ? Math.round(identification.overallConfidence)
      : undefined,
    notes: identification.notes ?? undefined,
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
  let adjustedData = { ...data };
  let isValid = true;

  // 1. Validate calorie-to-macro consistency
  // Formula: protein×4 + carbs×4 + fat×9 ≈ calories
  const calculatedCalories = (data.protein * 4) + (data.carbs * 4) + (data.fat * 9);
  const calorieDiscrepancy = Math.abs(calculatedCalories - data.calories) / data.calories;

  if (calorieDiscrepancy > 0.15) { // More than 15% discrepancy
    warnings.push('Calorie-to-macro mismatch detected, adjusting macros proportionally');

    // Adjust macros to match stated calories while maintaining ratios
    const totalMacroCalories = calculatedCalories;
    const scaleFactor = data.calories / totalMacroCalories;

    adjustedData.protein = Math.round(data.protein * scaleFactor);
    adjustedData.carbs = Math.round(data.carbs * scaleFactor);
    adjustedData.fat = Math.round(data.fat * scaleFactor);

    // Reduce confidence due to inconsistency
    adjustedData.confidence = Math.max(30, data.confidence - 15);
    isValid = false;
  }

  // 2. Validate reasonable macro ratios
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
