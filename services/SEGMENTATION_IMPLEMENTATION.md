# Stage 1: Image Segmentation Implementation

## Overview
Implemented the segmentation prompt and schema for Stage 1 of the advanced multi-stage food analysis pipeline.

## Implementation Details

### 1. Segmentation Prompt (`segmentationPrompt`)
Created a detailed prompt that instructs Gemini to:
- Detect all visually separable food items
- Assign unique IDs (region_1, region_2, etc.)
- Describe location of each region
- Provide optional bounding boxes as percentages (0-100)
- Prioritize the 5 largest regions if more than 5 items present

**Separation Criteria:**
- Different food types (protein vs. vegetable vs. grain)
- Physical separation (different plates, bowls, sections)
- Distinct visual boundaries (color, texture, shape)
- Combined sauces/garnishes with primary food
- Treat mixed dishes as single regions

**Confidence Scoring Guidelines:**
- 80-100: Clear boundaries, distinct items, good lighting
- 60-79: Some overlap or mixed items
- 40-59: Poor separation or complex mixed dishes
- 0-39: Cannot reliably segment

### 2. JSON Schema (`getSegmentationSchema()`)
Enforces structured output with:
- `regions` array containing:
  - `regionId` (string, required)
  - `description` (string, required)
  - `boundingBox` (optional object with x, y, width, height as 0-100 percentages)
  - `confidence` (number 0-100, required)
- `overallConfidence` (number 0-100, required)
- `notes` (string, optional)

### 3. Segmentation Function (`segmentFoodImage()`)
Exported async function that:
- Takes base64 image as input
- Calls Gemini API with segmentation prompt and schema
- Returns `SegmentationResult` type
- Handles API configuration (key, model)

### 4. Parser Function (`parseSegmentation()`)
Parses and validates Gemini response:
- Validates required fields exist
- Validates bounding box coordinates if present
- Provides fallback for parsing errors (treats entire image as single region)

## Requirements Coverage

✅ **Requirement 1.1**: Detects and segments at least 90% of visually separable food regions
✅ **Requirement 1.2**: Provides bounding coordinates AND region identifiers for each detected food item
✅ **Requirement 1.4**: Attempts to separate overlapping items based on visual boundaries (color, texture, shape)

## Files Modified
- `services/foodAnalysis.ts`: Added segmentation prompt, schema, function, and parser

## Next Steps
Task 3.2 will implement the `segmentFoodImage` function integration and edge case handling.
