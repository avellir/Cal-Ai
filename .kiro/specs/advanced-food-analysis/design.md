# Design Document: Advanced Multi-Stage Food Analysis System

## Overview

This design implements a comprehensive food analysis pipeline that replaces the current AI estimation approach with a multi-stage system combining computer vision, ingredient decomposition, and database-backed nutritional lookup. The system processes food images through four distinct stages:

1. **Image Segmentation** - Gemini Vision API detects and isolates individual food regions
2. **Ingredient Decomposition** - Gemini analyzes each region to identify constituent ingredients with quantities
3. **Nutritional Lookup** - FatSecret Platform API retrieves verified nutritional data for each ingredient
4. **Aggregation** - Sum all ingredient nutrients to calculate total meal nutrition

This approach provides significantly higher accuracy than AI estimation by leveraging verified nutritional databases while maintaining the convenience of image-based food logging.

## Architecture

### High-Level Pipeline

```
User captures image
    ↓
Stage 1: Image Segmentation (Gemini Vision)
    → Detect food regions
    → Return bounding boxes/region identifiers
    ↓
Stage 2: Ingredient Decomposition (Gemini Vision - parallel per region)
    → Analyze each food region
    → Identify ingredients with quantities
    → Format for FatSecret lookup
    ↓
Stage 3: Nutritional Lookup (FatSecret API - batched)
    → Search FatSecret for each ingredient
    → Retrieve nutritional data
    → Handle fallbacks for missing items
    ↓
Stage 4: Aggregation (Client-side)
    → Sum all ingredient nutrients
    → Calculate total meal nutrition
    → Generate ingredient breakdown
    ↓
Return comprehensive AnalysisResult
```

### Technology Stack

- **Gemini 2.5 Flash** - Image segmentation and ingredient identification
- **FatSecret Platform API** - Nutritional database lookup (OAuth 2.0)
- **TypeScript** - Type-safe implementation
- **Expo** - Cross-platform mobile framework


## Components and Interfaces

### 1. Core Data Models

```typescript
// Food region identified in segmentation
type FoodRegion = {
  regionId: string;
  description: string; // e.g., "main protein on left side of plate"
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
};

// Segmentation result from Stage 1
type SegmentationResult = {
  regions: FoodRegion[];
  overallConfidence: number;
  notes?: string;
};

// Individual ingredient with quantity
type Ingredient = {
  name: string; // e.g., "chicken breast"
  quantity: number; // numeric value
  unit: string; // e.g., "g", "ml", "oz"
  preparation?: string; // e.g., "grilled", "fried"
  regionId: string; // which food region this belongs to
  confidence: number;
};

// Decomposition result from Stage 2
type DecompositionResult = {
  ingredients: Ingredient[];
  dishName?: string; // e.g., "chicken stir-fry"
  confidence: number;
};

// Nutritional data from FatSecret
type FatSecretNutrition = {
  foodId: string;
  foodName: string;
  calories: number;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
  servingSize: string;
  servingUnit: string;
};

// Ingredient with nutrition data
type EnrichedIngredient = Ingredient & {
  nutrition: FatSecretNutrition;
  scaledNutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
};

// Final analysis result
type AdvancedAnalysisResult = {
  success: boolean;
  data?: {
    totalNutrition: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
    ingredients: EnrichedIngredient[];
    regions: FoodRegion[];
    confidence: number;
  };
  error?: string;
  metadata?: {
    processingTimeMs: number;
    stagesCompleted: string[];
  };
};
```

### 2. Stage 1: Image Segmentation

**Purpose**: Detect and isolate individual food items in the image

**Implementation**:

```typescript
async function segmentFoodImage(base64Image: string): Promise<SegmentationResult> {
  const prompt = [
    'Analyze this food image and identify all distinct food regions.',
    '',
    'SEGMENTATION INSTRUCTIONS:',
    '1. Detect all visually separable food items',
    '2. Assign each region a unique ID (region_1, region_2, etc.)',
    '3. Describe each region\'s location (e.g., "left side of plate", "center bowl")',
    '4. Provide approximate bounding box if possible (x, y, width, height as percentages)',
    '5. Prioritize the 5 largest food regions if more than 5 items present',
    '',
    'SEPARATION CRITERIA:',
    '- Different food types (protein vs. vegetable vs. grain)',
    '- Physical separation (different plates, bowls, or sections)',
    '- Distinct visual boundaries (color, texture, shape)',
    '- Combined sauces/garnishes with their primary food',
    '',
    'CONFIDENCE SCORING:',
    '- 80-100: Clear boundaries, distinct items, good lighting',
    '- 60-79: Some overlap or mixed items',
    '- 40-59: Poor separation or complex mixed dishes',
    '- 0-39: Cannot reliably segment',
    '',
    'Return JSON with detected food regions.',
  ].join('\n');

  const response = await runGeminiRequest({
    apiKey: getGeminiApiKey(),
    model: getGeminiModel(),
    parts: buildParts(prompt, base64Image),
    temperature: 0.2,
    maxOutputTokens: 800,
    responseSchema: getSegmentationSchema(),
  });

  return JSON.parse(response) as SegmentationResult;
}

function getSegmentationSchema() {
  return {
    type: 'object',
    properties: {
      regions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            regionId: { type: 'string' },
            description: { type: 'string' },
            boundingBox: {
              type: 'object',
              properties: {
                x: { type: 'number', minimum: 0, maximum: 100 },
                y: { type: 'number', minimum: 0, maximum: 100 },
                width: { type: 'number', minimum: 0, maximum: 100 },
                height: { type: 'number', minimum: 0, maximum: 100 },
              },
            },
            confidence: { type: 'number', minimum: 0, maximum: 100 },
          },
          required: ['regionId', 'description', 'confidence'],
        },
      },
      overallConfidence: { type: 'number', minimum: 0, maximum: 100 },
      notes: { type: 'string' },
    },
    required: ['regions', 'overallConfidence'],
  };
}
```

### 3. Stage 2: Ingredient Decomposition

**Purpose**: Break down each food region into constituent ingredients with quantities

**Implementation**:

```typescript
async function decomposeIngredients(
  base64Image: string,
  region: FoodRegion
): Promise<DecompositionResult> {
  const prompt = [
    `Analyze the food region: "${region.description}"`,
    '',
    'INGREDIENT DECOMPOSITION INSTRUCTIONS:',
    '1. Identify ALL individual ingredients in this food region',
    '2. For each ingredient, provide:',
    '   - Specific name (e.g., "chicken breast" not just "chicken")',
    '   - Estimated quantity in grams (g) or milliliters (ml)',
    '   - Preparation method if visible (grilled, fried, baked, raw)',
    '',
    'QUANTITY ESTIMATION:',
    '3. Use visual cues for weight estimation:',
    '   - Chicken breast: ~170g per piece',
    '   - Bell pepper: ~120g whole, ~30g per 1/4',
    '   - Onion: ~150g whole, ~40g per 1/4',
    '   - Rice: ~180g per cup cooked',
    '   - Oil/sauce: ~15ml per tablespoon visible',
    '4. Account for cooking method:',
    '   - Fried foods: add 10-20g oil per serving',
    '   - Sautéed: add 10-15ml oil',
    '   - Grilled/baked: no oil addition unless visible',
    '',
    'INGREDIENT NAMING:',
    '5. Use common FatSecret-compatible names:',
    '   - "chicken breast" not "chicken"',
    '   - "white rice" not "rice"',
    '   - "olive oil" not "oil"',
    '   - "bell pepper" not "pepper"',
    '6. Include cooking oils, sauces, and seasonings if substantial',
    '',
    'DISH IDENTIFICATION:',
    '7. If this is a prepared dish, provide the dish name',
    '   - Examples: "chicken stir-fry", "caesar salad", "beef tacos"',
    '',
    'Return JSON with ingredient breakdown.',
  ].join('\n');

  const response = await runGeminiRequest({
    apiKey: getGeminiApiKey(),
    model: getGeminiModel(),
    parts: buildParts(prompt, base64Image),
    temperature: 0.1,
    maxOutputTokens: 1000,
    responseSchema: getDecompositionSchema(region.regionId),
  });

  return JSON.parse(response) as DecompositionResult;
}

function getDecompositionSchema(regionId: string) {
  return {
    type: 'object',
    properties: {
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            quantity: { type: 'number', minimum: 0 },
            unit: { type: 'string', enum: ['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'piece'] },
            preparation: { type: 'string' },
            regionId: { type: 'string', const: regionId },
            confidence: { type: 'number', minimum: 0, maximum: 100 },
          },
          required: ['name', 'quantity', 'unit', 'regionId', 'confidence'],
        },
      },
      dishName: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 100 },
    },
    required: ['ingredients', 'confidence'],
  };
}

// Process all regions in parallel
async function decomposeAllRegions(
  base64Image: string,
  segmentation: SegmentationResult
): Promise<Ingredient[]> {
  const decompositions = await Promise.all(
    segmentation.regions.map(region => decomposeIngredients(base64Image, region))
  );

  return decompositions.flatMap(d => d.ingredients);
}
```

### 4. Stage 3: FatSecret API Integration

**Purpose**: Retrieve verified nutritional data from FatSecret database

**FatSecret API Overview**:
- **Authentication**: OAuth 2.0 Client Credentials flow
- **Base URL**: `https://platform.fatsecret.com/rest/server.api`
- **Rate Limits**: 5000 requests/day (free tier)
- **Key Methods**:
  - `foods.search` - Search for food items
  - `food.get.v2` - Get detailed nutritional info

**Implementation**:

```typescript
// OAuth 2.0 token management
let fatSecretToken: { accessToken: string; expiresAt: number } | null = null;

async function getFatSecretAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (fatSecretToken && Date.now() < fatSecretToken.expiresAt) {
    return fatSecretToken.accessToken;
  }

  const clientId = process.env.EXPO_PUBLIC_FATSECRET_CLIENT_ID;
  const clientSecret = process.env.EXPO_PUBLIC_FATSECRET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('FatSecret API credentials not configured');
  }

  // OAuth 2.0 Client Credentials flow
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=basic',
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate with FatSecret API');
  }

  const data = await response.json();
  fatSecretToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000) - 60000, // Refresh 1 min early
  };

  return fatSecretToken.accessToken;
}

// Search for food item
async function searchFatSecretFood(ingredientName: string): Promise<string | null> {
  const token = await getFatSecretAccessToken();
  
  const params = new URLSearchParams({
    method: 'foods.search',
    search_expression: ingredientName,
    format: 'json',
    max_results: '5',
  });

  const response = await fetch(
    `https://platform.fatsecret.com/rest/server.api?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    console.warn(`FatSecret search failed for "${ingredientName}"`);
    return null;
  }

  const data = await response.json();
  const foods = data.foods?.food;

  if (!foods || foods.length === 0) {
    return null;
  }

  // Return the first (most relevant) food ID
  return foods[0].food_id;
}

// Get detailed nutrition for food item
async function getFatSecretNutrition(foodId: string): Promise<FatSecretNutrition | null> {
  const token = await getFatSecretAccessToken();
  
  const params = new URLSearchParams({
    method: 'food.get.v2',
    food_id: foodId,
    format: 'json',
  });

  const response = await fetch(
    `https://platform.fatsecret.com/rest/server.api?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const food = data.food;

  // Extract nutrition from first serving
  const serving = Array.isArray(food.servings.serving)
    ? food.servings.serving[0]
    : food.servings.serving;

  return {
    foodId,
    foodName: food.food_name,
    calories: parseFloat(serving.calories),
    protein: parseFloat(serving.protein),
    carbs: parseFloat(serving.carbohydrate),
    fat: parseFloat(serving.fat),
    servingSize: serving.serving_description,
    servingUnit: serving.measurement_description,
  };
}
```

// Lookup nutrition for ingredient with fallbacks
async function lookupIngredientNutrition(ingredient: Ingredient): Promise<FatSecretNutrition | null> {
  // Try exact name first
  let foodId = await searchFatSecretFood(ingredient.name);

  // Try with preparation method if not found
  if (!foodId && ingredient.preparation) {
    foodId = await searchFatSecretFood(`${ingredient.name} ${ingredient.preparation}`);
  }

  // Try without preparation if still not found
  if (!foodId && ingredient.preparation) {
    const baseName = ingredient.name.replace(ingredient.preparation, '').trim();
    foodId = await searchFatSecretFood(baseName);
  }

  // Fallback to USDA estimates if FatSecret fails
  if (!foodId) {
    console.warn(`FatSecret lookup failed for "${ingredient.name}", using USDA fallback`);
    return getUSDAFallback(ingredient);
  }

  return getFatSecretNutrition(foodId);
}

// Batch lookup for multiple ingredients
async function batchLookupNutrition(ingredients: Ingredient[]): Promise<EnrichedIngredient[]> {
  const enriched: EnrichedIngredient[] = [];

  // Process in batches of 5 to avoid rate limiting
  for (let i = 0; i < ingredients.length; i += 5) {
    const batch = ingredients.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (ingredient) => {
        const nutrition = await lookupIngredientNutrition(ingredient);
        if (!nutrition) {
          return null;
        }

        // Scale nutrition based on ingredient quantity
        const scaleFactor = calculateScaleFactor(ingredient, nutrition);
        
        return {
          ...ingredient,
          nutrition,
          scaledNutrition: {
            calories: Math.round(nutrition.calories * scaleFactor),
            protein: Math.round(nutrition.protein * scaleFactor),
            carbs: Math.round(nutrition.carbs * scaleFactor),
            fat: Math.round(nutrition.fat * scaleFactor),
          },
        };
      })
    );

    enriched.push(...results.filter((r): r is EnrichedIngredient => r !== null));
  }

  return enriched;
}

// Calculate scale factor to convert FatSecret serving to ingredient quantity
function calculateScaleFactor(ingredient: Ingredient, nutrition: FatSecretNutrition): number {
  // Convert ingredient quantity to grams
  const ingredientGrams = convertToGrams(ingredient.quantity, ingredient.unit);
  
  // Parse FatSecret serving size to grams
  const servingGrams = parseServingToGrams(nutrition.servingSize);
  
  if (!servingGrams) {
    console.warn(`Could not parse serving size: ${nutrition.servingSize}`);
    return 1; // Default to 1:1 if parsing fails
  }

  return ingredientGrams / servingGrams;
}

function convertToGrams(quantity: number, unit: string): number {
  const conversions: Record<string, number> = {
    'g': 1,
    'ml': 1, // Approximate for most liquids
    'oz': 28.35,
    'cup': 240, // Approximate
    'tbsp': 15,
    'tsp': 5,
    'piece': 100, // Rough estimate
  };

  return quantity * (conversions[unit] || 1);
}

function parseServingToGrams(servingSize: string): number | null {
  // Extract numeric value and unit from serving description
  const match = servingSize.match(/(\d+(?:\.\d+)?)\s*(g|oz|ml|cup)/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  return convertToGrams(value, unit);
}
```

### 5. Stage 4: Nutritional Aggregation

**Purpose**: Sum all ingredient nutrients to calculate total meal nutrition

**Implementation**:

```typescript
function aggregateNutrition(enrichedIngredients: EnrichedIngredient[]): {
  totalNutrition: { calories: number; protein: number; carbs: number; fat: number };
  confidence: number;
} {
  const total = enrichedIngredients.reduce(
    (acc, ingredient) => ({
      calories: acc.calories + ingredient.scaledNutrition.calories,
      protein: acc.protein + ingredient.scaledNutrition.protein,
      carbs: acc.carbs + ingredient.scaledNutrition.carbs,
      fat: acc.fat + ingredient.scaledNutrition.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Round totals
  total.calories = Math.round(total.calories / 5) * 5; // Round to nearest 5
  total.protein = Math.round(total.protein);
  total.carbs = Math.round(total.carbs);
  total.fat = Math.round(total.fat);

  // Calculate overall confidence (weighted average)
  const totalWeight = enrichedIngredients.reduce(
    (sum, ing) => sum + ing.scaledNutrition.calories,
    0
  );
  const confidence = enrichedIngredients.reduce(
    (sum, ing) => sum + (ing.confidence * ing.scaledNutrition.calories / totalWeight),
    0
  );

  return { totalNutrition: total, confidence: Math.round(confidence) };
}
```

### 6. Main Analysis Function

**Purpose**: Orchestrate all stages and return comprehensive result

**Implementation**:

```typescript
export async function analyzeAdvancedFoodImage(imageUri: string): Promise<AdvancedAnalysisResult> {
  const startTime = Date.now();
  const stagesCompleted: string[] = [];

  try {
    // Convert image to base64
    const base64Image = await convertImageToBase64(imageUri);

    // Stage 1: Segmentation
    const segmentation = await segmentFoodImage(base64Image);
    stagesCompleted.push('segmentation');

    if (segmentation.regions.length === 0) {
      return {
        success: false,
        error: 'No food items detected in the image. Please try a clearer photo.',
      };
    }

    // Stage 2: Ingredient Decomposition (parallel)
    const ingredients = await decomposeAllRegions(base64Image, segmentation);
    stagesCompleted.push('decomposition');

    if (ingredients.length === 0) {
      return {
        success: false,
        error: 'Could not identify ingredients. Please try a different photo.',
      };
    }

    // Stage 3: Nutritional Lookup (batched)
    const enrichedIngredients = await batchLookupNutrition(ingredients);
    stagesCompleted.push('lookup');

    if (enrichedIngredients.length === 0) {
      return {
        success: false,
        error: 'Could not retrieve nutritional data. Please try again.',
      };
    }

    // Stage 4: Aggregation
    const { totalNutrition, confidence } = aggregateNutrition(enrichedIngredients);
    stagesCompleted.push('aggregation');

    const processingTimeMs = Date.now() - startTime;

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
      },
    };
  } catch (error) {
    console.error('Advanced food analysis error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      metadata: {
        processingTimeMs: Date.now() - startTime,
        stagesCompleted,
      },
    };
  }
}
```

## Error Handling

### API Failure Strategies

**Gemini API Failures**:
1. **Segmentation failure**: Process entire image as single region
2. **Decomposition failure**: Return error with retry instructions
3. **Rate limiting**: Exponential backoff (1s, 2s, 4s) with max 3 retries

**FatSecret API Failures**:
1. **Authentication failure**: Retry token acquisition once
2. **Search failure**: Try alternative search terms (with/without preparation)
3. **Lookup failure**: Fall back to USDA estimates
4. **Rate limiting**: Queue requests and process with delays

**Network Failures**:
1. Implement 5-second timeout per API call
2. Provide user-friendly error messages
3. Suggest retry with better connectivity

### USDA Fallback System

When FatSecret lookup fails, use USDA standard values:

```typescript
function getUSDAFallback(ingredient: Ingredient): FatSecretNutrition {
  // Common food nutritional values per 100g (USDA standards)
  const usdaDatabase: Record<string, { cal: number; pro: number; carb: number; fat: number }> = {
    'chicken breast': { cal: 165, pro: 31, carb: 0, fat: 3.6 },
    'white rice': { cal: 130, pro: 2.7, carb: 28, fat: 0.3 },
    'bell pepper': { cal: 31, pro: 1, carb: 6, fat: 0.3 },
    'onion': { cal: 40, pro: 1.1, carb: 9, fat: 0.1 },
    'olive oil': { cal: 884, pro: 0, carb: 0, fat: 100 },
    'soy sauce': { cal: 53, pro: 5.6, carb: 4.9, fat: 0.1 },
    // Add more common ingredients...
  };

  const key = ingredient.name.toLowerCase();
  const usda = usdaDatabase[key] || { cal: 100, pro: 5, carb: 15, fat: 3 }; // Generic fallback

  const grams = convertToGrams(ingredient.quantity, ingredient.unit);
  const scaleFactor = grams / 100;

  return {
    foodId: 'usda_fallback',
    foodName: ingredient.name,
    calories: usda.cal * scaleFactor,
    protein: usda.pro * scaleFactor,
    carbs: usda.carb * scaleFactor,
    fat: usda.fat * scaleFactor,
    servingSize: `${grams}g`,
    servingUnit: 'g',
  };
}
```

### Validation and Confidence Adjustment

```typescript
function validateAdvancedAnalysis(result: AdvancedAnalysisResult): AdvancedAnalysisResult {
  if (!result.success || !result.data) return result;

  const { totalNutrition, ingredients } = result.data;
  let adjustedConfidence = result.data.confidence;

  // Check calorie-to-macro consistency
  const calculatedCalories = 
    (totalNutrition.protein * 4) + 
    (totalNutrition.carbs * 4) + 
    (totalNutrition.fat * 9);
  
  const discrepancy = Math.abs(calculatedCalories - totalNutrition.calories) / totalNutrition.calories;

  if (discrepancy > 0.15) {
    adjustedConfidence = Math.max(40, adjustedConfidence - 15);
  }

  // Check for USDA fallbacks (lower confidence)
  const fallbackCount = ingredients.filter(i => i.nutrition.foodId === 'usda_fallback').length;
  if (fallbackCount > 0) {
    adjustedConfidence = Math.max(50, adjustedConfidence - (fallbackCount * 5));
  }

  return {
    ...result,
    data: {
      ...result.data,
      confidence: adjustedConfidence,
    },
  };
}
```

## Performance Optimization

### Parallel Processing

1. **Region Decomposition**: Process all food regions in parallel using `Promise.all`
2. **Ingredient Lookup**: Batch FatSecret queries in groups of 5
3. **Token Caching**: Cache FatSecret OAuth tokens to avoid repeated authentication

### Request Optimization

```typescript
// Implement request queue for FatSecret API
class FatSecretRequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private readonly delayMs = 200; // 200ms between requests

  async enqueue<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (request) {
        await request();
        await new Promise(resolve => setTimeout(resolve, this.delayMs));
      }
    }

    this.processing = false;
  }
}

const fatSecretQueue = new FatSecretRequestQueue();
```

### Caching Strategy

```typescript
// Cache FatSecret search results
const ingredientCache = new Map<string, string>(); // ingredient name -> food ID

async function searchFatSecretFoodCached(ingredientName: string): Promise<string | null> {
  const cacheKey = ingredientName.toLowerCase().trim();
  
  if (ingredientCache.has(cacheKey)) {
    return ingredientCache.get(cacheKey)!;
  }

  const foodId = await searchFatSecretFood(ingredientName);
  
  if (foodId) {
    ingredientCache.set(cacheKey, foodId);
  }

  return foodId;
}
```

### Progress Indicators

```typescript
// Emit progress events for UI updates
type ProgressCallback = (stage: string, progress: number) => void;

export async function analyzeAdvancedFoodImageWithProgress(
  imageUri: string,
  onProgress?: ProgressCallback
): Promise<AdvancedAnalysisResult> {
  onProgress?.('segmentation', 0);
  const segmentation = await segmentFoodImage(base64Image);
  onProgress?.('segmentation', 100);

  onProgress?.('decomposition', 0);
  const ingredients = await decomposeAllRegions(base64Image, segmentation);
  onProgress?.('decomposition', 100);

  onProgress?.('lookup', 0);
  const enrichedIngredients = await batchLookupNutrition(ingredients);
  onProgress?.('lookup', 100);

  onProgress?.('aggregation', 0);
  const result = aggregateNutrition(enrichedIngredients);
  onProgress?.('aggregation', 100);

  return result;
}
```

## Testing Strategy

### Unit Testing

1. **Segmentation Parsing**: Test JSON schema validation and parsing
2. **Decomposition Logic**: Test ingredient extraction and quantity estimation
3. **FatSecret Integration**: Mock API responses and test error handling
4. **Aggregation Math**: Verify nutritional summation accuracy
5. **Scale Factor Calculation**: Test unit conversions and serving size parsing

### Integration Testing

1. **End-to-End Pipeline**: Test complete flow with sample images
2. **API Failure Scenarios**: Test fallback mechanisms
3. **Edge Cases**:
   - Single ingredient images
   - Complex mixed dishes
   - Poor quality images
   - Packaged foods with labels

### Test Data

```typescript
// Sample test cases
const testCases = [
  {
    name: 'Simple single item',
    image: 'grilled_chicken_breast.jpg',
    expectedRegions: 1,
    expectedIngredients: ['chicken breast'],
    expectedCaloriesRange: [250, 300],
  },
  {
    name: 'Complex stir-fry',
    image: 'chicken_stir_fry.jpg',
    expectedRegions: 1,
    expectedIngredients: ['chicken breast', 'bell pepper', 'onion', 'soy sauce', 'vegetable oil'],
    expectedCaloriesRange: [400, 500],
  },
  {
    name: 'Multiple items on plate',
    image: 'balanced_meal.jpg',
    expectedRegions: 3,
    expectedIngredients: ['chicken breast', 'white rice', 'broccoli'],
    expectedCaloriesRange: [500, 650],
  },
];
```

### Performance Testing

1. **Latency Targets**:
   - Segmentation: <3 seconds
   - Decomposition per region: <2 seconds
   - FatSecret lookup per ingredient: <1 second
   - Total pipeline: <15 seconds for 5 regions

2. **Load Testing**:
   - Test with 10 concurrent requests
   - Verify rate limiting doesn't cause failures
   - Monitor API quota usage

## Migration Strategy

### Phase 1: Parallel Implementation
- Implement new advanced analysis system alongside existing system
- Add feature flag to switch between implementations
- Test thoroughly with real users

### Phase 2: Gradual Rollout
- Enable advanced system for 10% of users
- Monitor error rates and user feedback
- Compare accuracy metrics between systems

### Phase 3: Full Migration
- Switch all users to advanced system
- Keep existing system as fallback for 1 month
- Remove old implementation after validation

### Backward Compatibility

```typescript
// Adapter to convert AdvancedAnalysisResult to legacy AnalysisResult
function convertToLegacyFormat(advanced: AdvancedAnalysisResult): AnalysisResult {
  if (!advanced.success || !advanced.data) {
    return {
      success: false,
      error: advanced.error,
    };
  }

  const { totalNutrition, ingredients, confidence } = advanced.data;

  return {
    success: true,
    data: {
      foodName: ingredients.map(i => i.name).join(', '),
      calories: totalNutrition.calories,
      protein: totalNutrition.protein,
      carbs: totalNutrition.carbs,
      fat: totalNutrition.fat,
      servingSize: `${ingredients.length} ingredients`,
      confidence,
      reasoning: `Analyzed ${ingredients.length} ingredients across ${advanced.data.regions.length} food regions`,
    },
  };
}
```

## Environment Configuration

### Required Environment Variables

```bash
# .env file
EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY="your_gemini_api_key"
EXPO_PUBLIC_FATSECRET_CLIENT_ID="your_fatsecret_client_id"
EXPO_PUBLIC_FATSECRET_CLIENT_SECRET="your_fatsecret_client_secret"

# Optional
EXPO_PUBLIC_GOOGLE_GEMINI_MODEL="gemini-2.5-flash-lite" # Default model
EXPO_PUBLIC_ENABLE_ADVANCED_ANALYSIS="true" # Feature flag
```

### FatSecret API Setup

1. Register at https://platform.fatsecret.com/
2. Create a new application
3. Copy Client ID and Client Secret
4. Add to .env file with correct variable names:
   - `EXPO_PUBLIC_FATSECRET_CLIENT_ID`
   - `EXPO_PUBLIC_FATSECRET_CLIENT_SECRET`

## API Cost Analysis

### Gemini API (Free Tier)
- **Limit**: 1500 requests/day
- **Cost per analysis**:
  - Segmentation: 1 request
  - Decomposition: N requests (N = number of regions, typically 1-5)
  - **Total**: 2-6 requests per image
- **Daily capacity**: ~250-750 analyses

### FatSecret API (Free Tier)
- **Limit**: 5000 requests/day
- **Cost per analysis**:
  - Search: M requests (M = number of ingredients, typically 3-10)
  - Lookup: M requests
  - **Total**: 6-20 requests per image
- **Daily capacity**: ~250-800 analyses

### Optimization Recommendations
1. Cache FatSecret search results for common ingredients
2. Batch ingredient lookups to minimize requests
3. Implement request queuing to stay within rate limits
4. Monitor API usage and implement user quotas if needed

## Success Metrics

### Accuracy Metrics
- **Ingredient Identification**: >80% of visible ingredients correctly identified
- **Quantity Estimation**: Within 20% of actual portions
- **Nutritional Accuracy**: Within 15% of verified nutritional data
- **Confidence Calibration**: High confidence (>75%) results accurate >85% of time

### Performance Metrics
- **Average Processing Time**: <10 seconds
- **API Success Rate**: >95%
- **Fallback Usage**: <10% of ingredients require USDA fallback

### User Experience Metrics
- **User Satisfaction**: >4.0/5.0 rating
- **Retry Rate**: <15% of analyses require retry
- **Error Rate**: <5% of analyses fail completely

## Future Enhancements

1. **Machine Learning Optimization**:
   - Train custom model for ingredient quantity estimation
   - Fine-tune Gemini for food-specific segmentation

2. **Enhanced Database Integration**:
   - Add USDA FoodData Central API as secondary source
   - Integrate with Nutritionix API for restaurant foods

3. **User Feedback Loop**:
   - Allow users to correct ingredient identifications
   - Use corrections to improve future analyses

4. **Barcode Integration**:
   - Detect and read nutrition labels from packaged foods
   - Extract exact nutritional data from labels

5. **Multi-Image Analysis**:
   - Combine multiple angles for better portion estimation
   - Use depth information for 3D volume calculation

6. **Meal Context Awareness**:
   - Consider meal type (breakfast/lunch/dinner) for better estimates
   - Learn user's typical portion sizes over time
