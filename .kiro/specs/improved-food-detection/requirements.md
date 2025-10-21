# Requirements Document

## Introduction

This feature enhances the AI-powered food detection and nutritional analysis system to improve accuracy, reliability, and user confidence in the Cal AI application. The current two-stage analysis approach (identification followed by nutrition estimation) will be refined with better prompts, contextual awareness, and validation logic to reduce errors and provide more accurate nutritional data.

## Glossary

- **Food Analysis System**: The AI-powered service that processes food images and returns nutritional information using Google Gemini API
- **Identification Stage**: The first analysis phase where the system identifies visible food items, portions, and preparation methods
- **Nutrition Estimation Stage**: The second analysis phase where the system calculates nutritional values based on identified foods
- **Confidence Score**: A numerical value (0-100) indicating the system's certainty in its analysis
- **USDA Database**: United States Department of Agriculture nutritional database used as reference standard
- **Portion Estimation**: The process of determining food quantity using visual cues and reference objects

## Requirements

### Requirement 1

**User Story:** As a user, I want the AI to accurately identify multiple food items in a single image, so that I can log complete meals without missing ingredients.

#### Acceptance Criteria

1. WHEN a food image contains multiple distinct items, THE Food Analysis System SHALL identify at least 90% of visually prominent food items
2. WHEN identifying food items, THE Food Analysis System SHALL provide specific food names rather than generic categories
3. WHEN condiments or sauces are visible, THE Food Analysis System SHALL include them in the nutritional calculation
4. WHEN the image contains more than 5 food items, THE Food Analysis System SHALL prioritize the 5 most prominent items by visual size
5. THE Food Analysis System SHALL assign individual confidence scores to each identified food item

### Requirement 2

**User Story:** As a user, I want accurate portion size estimates, so that my calorie tracking reflects what I actually ate.

#### Acceptance Criteria

1. WHEN estimating portion sizes, THE Food Analysis System SHALL reference common objects in the image such as plates, utensils, or hands
2. THE Food Analysis System SHALL use standard plate dimensions (10-11 inches) as the default reference when plates are visible
3. WHEN multiple reference objects are available, THE Food Analysis System SHALL cross-validate portion estimates using at least two reference points
4. THE Food Analysis System SHALL account for food density and preparation method when estimating weight from visual volume
5. WHEN portion estimation uncertainty is high, THE Food Analysis System SHALL reduce the confidence score below 60

### Requirement 3

**User Story:** As a user, I want the system to recognize different cooking methods, so that nutritional values account for added oils and preparation techniques.

#### Acceptance Criteria

1. WHEN analyzing food appearance, THE Food Analysis System SHALL identify preparation methods including fried, grilled, baked, steamed, or raw
2. WHEN fried foods are detected, THE Food Analysis System SHALL add estimated oil absorption to the nutritional calculation
3. WHEN preparation method affects nutritional content by more than 20%, THE Food Analysis System SHALL explicitly mention it in the reasoning field
4. THE Food Analysis System SHALL detect visual indicators of preparation such as char marks, breading, or glossy surfaces
5. WHEN preparation method cannot be determined, THE Food Analysis System SHALL assume the healthiest common preparation method

### Requirement 4

**User Story:** As a user, I want nutritional estimates based on reliable data sources, so that I can trust the accuracy of my food logs.

#### Acceptance Criteria

1. THE Food Analysis System SHALL base all nutritional estimates on USDA nutritional database standards
2. WHEN estimating calories, THE Food Analysis System SHALL round to the nearest 10 for portions over 100 calories
3. WHEN estimating macronutrients, THE Food Analysis System SHALL round protein, carbs, and fat to the nearest whole gram
4. THE Food Analysis System SHALL provide conservative calorie estimates when uncertainty exists
5. WHEN nutritional data varies significantly by brand or recipe, THE Food Analysis System SHALL use median values from common preparations

### Requirement 5

**User Story:** As a user, I want clear explanations of how estimates were calculated, so that I can understand and trust the results.

#### Acceptance Criteria

1. THE Food Analysis System SHALL provide reasoning that explains the portion estimation method used
2. WHEN confidence is below 70, THE Food Analysis System SHALL explicitly state the source of uncertainty in the reasoning field
3. THE Food Analysis System SHALL limit reasoning explanations to a maximum of two sentences
4. WHEN multiple food items are combined, THE Food Analysis System SHALL indicate which items contributed most to the total calories
5. THE Food Analysis System SHALL mention any significant assumptions made during analysis

### Requirement 6

**User Story:** As a user, I want the system to handle edge cases gracefully, so that I get useful results even with challenging photos.

#### Acceptance Criteria

1. WHEN the image is blurry or poorly lit, THE Food Analysis System SHALL reduce confidence scores proportionally to image quality
2. WHEN food items are partially obscured, THE Food Analysis System SHALL estimate visible portions only and note the limitation
3. WHEN the image contains packaged foods with visible labels, THE Food Analysis System SHALL prioritize label information over visual estimation
4. WHEN the image contains non-food items, THE Food Analysis System SHALL ignore them and focus only on edible items
5. WHEN no food can be confidently identified, THE Food Analysis System SHALL return a confidence score below 40 with an explanatory note

### Requirement 7

**User Story:** As a user, I want consistent results for similar foods, so that my tracking remains reliable over time.

#### Acceptance Criteria

1. THE Food Analysis System SHALL use consistent terminology for common foods across multiple analyses
2. WHEN analyzing similar food items, THE Food Analysis System SHALL apply the same portion estimation methodology
3. THE Food Analysis System SHALL maintain consistent calorie-to-macronutrient ratios for the same food types
4. WHEN temperature affects 4 calories per gram for carbs and protein, 9 calories per gram for fat), THE Food Analysis System SHALL validate that calculated calories align with macronutrient totals within 10% margin
5. THE Food Analysis System SHALL use the same preparation method assumptions for visually similar foods

### Requirement 8

**User Story:** As a user, I want the system to provide contextual awareness, so that cultural and regional food variations are recognized.

#### Acceptance Criteria

1. WHEN identifying foods, THE Food Analysis System SHALL recognize common variations in international cuisines
2. THE Food Analysis System SHALL account for typical serving sizes that vary by cuisine type
3. WHEN regional ingredients affect nutritional content, THE Food Analysis System SHALL adjust estimates accordingly
4. THE Food Analysis System SHALL recognize common food combinations typical to specific cuisines
5. WHEN food names have multiple cultural interpretations, THE Food Analysis System SHALL provide the most specific identification possible
