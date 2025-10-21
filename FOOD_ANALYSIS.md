# AI Food Analysis Feature

## Overview

The Cal AI app now includes AI-powered food analysis that allows users to:
- Take photos of their meals
- Get automatic nutritional analysis (calories, protein, carbs, fat)
- View confidence scores for the analysis
- Save food logs with nutritional data

## How It Works

1. **User taps the + button** on the home screen
2. **Camera/Gallery opens** - User can take a photo or select from gallery
3. **AI Analysis** - The image is sent to Google Gemini 2.5 Flash API
4. **Results displayed** - Nutritional information is shown with confidence score
5. **Save or Retake** - User can save the entry or retake the photo

## Setup Instructions

### 1. Install Dependencies

Already installed:
```bash
npx expo install expo-image-picker expo-camera
```

### 2. Configure Google Gemini API Key

1. Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Copy `.env.example` to `.env`
3. Add your API key:
   ```
   EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY=your-key-here
   ```

### 3. Configure Permissions

Add to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow Cal AI to access your photos to log meals",
          "cameraPermission": "Allow Cal AI to access your camera to take photos of meals"
        }
      ]
    ]
  }
}
```

## Technical Implementation

### Files Created

1. **`services/foodAnalysis.ts`** - AI service for analyzing food images
   - Uses Google Gemini 2.5 Flash model with vision capabilities
   - Converts images to base64
   - Returns structured nutrition data with confidence scores

2. **`app/(app)/camera.tsx`** - Camera/image picker screen
   - Handles camera and photo library permissions
   - Provides options to take photo or choose from library
   - Shows loading state during analysis

3. **`app/(app)/food-result.tsx`** - Results display screen
   - Shows analyzed food with image
   - Displays calories and macros
   - Shows confidence score with visual indicators
   - Allows user to save or retake

### Data Flow

```
User taps + button
  ↓
camera.tsx - Opens camera/gallery
  ↓
User captures/selects image
  ↓
foodAnalysis.ts - Sends to Google Gemini API
  ↓
food-result.tsx - Displays results
  ↓
User saves entry
  ↓
Returns to home screen
```

## AI Accuracy

The AI provides:
- **High confidence (75%+)**: Generally very accurate
- **Medium confidence (50-75%)**: Good estimate, may need adjustment
- **Low confidence (<50%)**: Less certain, user should verify

Accuracy depends on:
- Image quality and lighting
- Clear view of the food
- Standard serving sizes
- Common foods vs. rare/mixed dishes

## Cost Considerations

- Google Gemini 2.5 Flash is **FREE** up to 1500 requests per day
- Above the free tier: very low cost (~$0.0001875 per image)
- For 100 daily users taking 3 photos each: **FREE** (300 requests/day)
- Extremely cost-effective compared to alternatives
- Consider implementing:
  - Rate limiting per user to stay within free tier
  - Caching common foods for faster responses
  - Image compression for faster uploads

## Future Enhancements

- [ ] Store food logs in database (Supabase)
- [ ] Allow manual adjustment of nutritional values
- [ ] Add food search/autocomplete
- [ ] Barcode scanning for packaged foods
- [ ] Historical food log view
- [ ] Daily/weekly nutrition summaries
- [ ] Custom food database for faster lookups
- [ ] Offline mode with local ML model

## Alternative AI Services

If you prefer not to use Google Gemini, you can adapt the code for:

- **OpenAI GPT-4o Vision** - Higher accuracy but costs ~$0.005 per image
- **Anthropic Claude with Vision** - Similar quality to GPT-4o
- **Clarifai Food Recognition API** - Specialized for food
- **Nutritionix API** (requires food name, not image)
- **Local ML model** using TensorFlow Lite - Offline capability

## Troubleshooting

### "Failed to analyze image"
- Check that your Google Gemini API key is valid
- Ensure you haven't exceeded the free tier limits (1500 requests/day)
- Verify internet connection
- Check that the API key has the Generative Language API enabled

### Camera not opening
- Check that camera permissions are granted
- Test on physical device (camera may not work in simulator)

### Low accuracy
- Ensure good lighting in photos
- Capture full view of the meal
- Try retaking with different angle
- Consider adding portion size context (e.g., plate, hand for scale)

## Security Notes

- API keys should never be committed to git
- Use environment variables for sensitive data
- Consider implementing API key rotation
- Add rate limiting to prevent abuse
- Validate all user inputs before processing

