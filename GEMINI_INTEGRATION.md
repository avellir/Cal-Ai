# Google Gemini Food Recognition Integration

## Overview
The food analysis service uses Google Gemini 2.0 Flash for AI-powered food recognition and nutritional analysis in a single streamlined request.

## Changes Made

### Single-Stage Analysis with Gemini

**Google Gemini 2.0 Flash Exp**
- Fast, efficient model optimized for vision tasks
- Uses Gemini's advanced vision capabilities for food identification
- Analyzes portion sizes and preparation methods from the image
- Calculates comprehensive nutritional information (calories, protein, carbs, fat)
- Provides confidence scoring for estimates
- Validates data consistency

**Note:** Currently using `gemini-2.0-flash-exp` as `gemini-2.5-flash-lite` may not be available via REST API in all regions yet. The model can be easily switched once 2.5 Flash Lite is generally available.

## API Configuration

Required environment variable:
- `EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY` - API key from Google AI Studio (already set)

### Getting Google Gemini API Key
1. Go to https://aistudio.google.com/apikey
2. Create a new API key
3. Copy the key and add it to your `.env` file

## Benefits

1. **Simplified Architecture**: Single API call for complete analysis
2. **Fast & Efficient**: Gemini 2.0 Flash is optimized for speed
3. **Advanced Vision**: Gemini's multimodal capabilities for accurate food recognition
4. **Cost Effective**: Generous free tier for development
5. **High Accuracy**: State-of-the-art vision model for food identification
6. **Easy to Update**: Can switch to newer models (like 2.5 Flash Lite) when available

## Usage

No changes needed in your app code. The `analyzeFoodImage()` function works the same way:

```typescript
import { analyzeFoodImage } from '@/services/foodAnalysis';

const result = await analyzeFoodImage(imageUri);
if (result.success) {
  console.log(result.data); // Nutritional information
  console.log(result.identification); // Detected food items
}
```

## Testing

Test the integration by taking photos of various foods and checking:
- Food item detection accuracy
- Confidence scores
- Nutritional estimates
- Overall analysis quality
