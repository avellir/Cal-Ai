# Requirements Document

## Introduction

This feature implements a comprehensive multi-stage food analysis system that segments individual food items from images, decomposes dishes into their constituent ingredients, and retrieves precise nutritional data from the FatSecret Platform API. This approach replaces the current single-stage AI estimation with a more accurate, database-backed nutritional analysis pipeline.

## Glossary

- **Food Analysis System**: The multi-stage service that processes food images through segmentation, ingredient decomposition, and nutritional lookup
- **Gemini Vision API**: Google's AI model used for image segmentation and ingredient identification
- **FatSecret Platform API**: Third-party nutritional database API providing detailed nutritional information for food items
- **Image Segmentation**: The process of detecting and isolating individual food regions within a single image
- **Ingredient Decomposition**: Breaking down a prepared dish into its individual ingredient components with estimated quantities
- **Nutritional Aggregation**: Summing individual ingredient nutrients to calculate total meal nutrition
- **Food Region**: A bounded area in the image containing a single distinct food item
- **Ingredient Mapping**: The process of matching identified ingredients to FatSecret database entries

## Requirements

### Requirement 1

**User Story:** As a user, I want the system to detect multiple food items on my plate separately, so that each item is analyzed individually for better accuracy.

#### Acceptance Criteria

1. WHEN an image contains multiple distinct food items, THE Food Analysis System SHALL detect and segment at least 90% of visually separable food regions
2. WHEN segmenting food regions, THE Food Analysis System SHALL provide bounding coordinates or region identifiers for each detected food item
3. THE Food Analysis System SHALL process each segmented food region independently through the ingredient decomposition stage
4. WHEN food items overlap or touch, THE Food Analysis System SHALL attempt to separate them based on visual boundaries such as color, texture, or shape differences
5. WHEN a food region cannot be clearly segmented, THE Food Analysis System SHALL process the entire visible area as a single composite item

### Requirement 2

**User Story:** As a user, I want complex dishes broken down into individual ingredients, so that nutritional calculations are based on actual components rather than generic estimates.

#### Acceptance Criteria

1. WHEN analyzing a prepared dish, THE Food Analysis System SHALL identify at least 80% of visible ingredient components
2. THE Food Analysis System SHALL provide estimated quantities for each identified ingredient in standard units such as grams, milliliters, or pieces
3. WHEN decomposing ingredients, THE Food Analysis System SHALL include cooking oils, sauces, and seasonings that affect nutritional content
4. WHEN an ingredient quantity cannot be precisely determined, THE Food Analysis System SHALL provide a reasonable estimate based on typical recipe proportions
5. THE Food Analysis System SHALL format ingredient names to match common FatSecret database terminology

### Requirement 3

**User Story:** As a user, I want nutritional data retrieved from a reliable database, so that my calorie tracking is based on verified information rather than AI estimates.

#### Acceptance Criteria

1. THE Food Analysis System SHALL query the FatSecret Platform API for each identified ingredient
2. WHEN multiple FatSecret entries match an ingredient name, THE Food Analysis System SHALL select the entry with the most generic or common preparation method
3. THE Food Analysis System SHALL retrieve calories, protein, carbohydrates, and fat values for each ingredient from FatSecret
4. WHEN an ingredient is not found in FatSecret, THE Food Analysis System SHALL attempt alternative search terms or fall back to USDA standard values
5. THE Food Analysis System SHALL cache FatSecret API responses to minimize redundant queries for common ingredients

### Requirement 4

**User Story:** As a user, I want the system to calculate total meal nutrition by summing all ingredients, so that I get a comprehensive nutritional breakdown.

#### Acceptance Criteria

1. THE Food Analysis System SHALL sum calories from all identified ingredients to calculate total meal calories
2. THE Food Analysis System SHALL sum protein, carbohydrates, and fat from all ingredients to calculate total macronutrients
3. THE Food Analysis System SHALL round total calories to the nearest 5 for values over 50 calories
4. THE Food Analysis System SHALL round total macronutrients to the nearest whole gram
5. THE Food Analysis System SHALL provide a breakdown showing each ingredient's contribution to the total nutrition

### Requirement 5

**User Story:** As a user, I want to see which ingredients were identified and their quantities, so that I can verify the analysis accuracy and make adjustments if needed.

#### Acceptance Criteria

1. THE Food Analysis System SHALL return a list of all identified ingredients with their estimated quantities
2. THE Food Analysis System SHALL indicate which food region each ingredient belongs to when multiple items are segmented
3. THE Food Analysis System SHALL provide the FatSecret food ID or database reference for each ingredient
4. WHEN displaying ingredient quantities, THE Food Analysis System SHALL use user-friendly units such as ounces, cups, or tablespoons alongside metric measurements
5. THE Food Analysis System SHALL indicate confidence levels for ingredient identification and quantity estimation

### Requirement 6

**User Story:** As a user, I want the system to handle API failures gracefully, so that I still get results even when external services are unavailable.

#### Acceptance Criteria

1. WHEN the FatSecret API is unavailable, THE Food Analysis System SHALL fall back to cached nutritional data for common ingredients
2. WHEN the Gemini API fails during segmentation, THE Food Analysis System SHALL process the entire image as a single food region
3. WHEN the Gemini API fails during ingredient decomposition, THE Food Analysis System SHALL return an error message with retry instructions
4. THE Food Analysis System SHALL implement exponential backoff with a maximum of 3 retry attempts for failed API calls
5. WHEN both APIs fail, THE Food Analysis System SHALL provide a user-friendly error message explaining the issue

### Requirement 7

**User Story:** As a user, I want the analysis to account for cooking methods and preparation, so that added oils and cooking techniques are reflected in the nutritional data.

#### Acceptance Criteria

1. WHEN identifying ingredients, THE Food Analysis System SHALL detect preparation methods such as fried, grilled, baked, or steamed
2. WHEN fried foods are detected, THE Food Analysis System SHALL add estimated cooking oil as a separate ingredient with appropriate quantity
3. THE Food Analysis System SHALL adjust ingredient quantities based on cooking method when applicable, such as moisture loss in grilled meats
4. WHEN sauces or marinades are visible, THE Food Analysis System SHALL include them as separate ingredients in the decomposition
5. THE Food Analysis System SHALL use preparation-specific FatSecret entries when available, such as "chicken breast, grilled" versus "chicken breast, raw"

### Requirement 8

**User Story:** As a user, I want the system to process images efficiently, so that I receive results within a reasonable timeframe.

#### Acceptance Criteria

1. THE Food Analysis System SHALL complete the entire analysis pipeline within 15 seconds for images with up to 5 food regions
2. THE Food Analysis System SHALL process segmentation and ingredient decomposition stages in parallel when multiple food regions are detected
3. THE Food Analysis System SHALL batch FatSecret API queries when multiple ingredients need lookup to minimize network round trips
4. WHEN processing time exceeds 10 seconds, THE Food Analysis System SHALL provide progress indicators to the user
5. THE Food Analysis System SHALL implement request timeouts of 5 seconds per API call to prevent indefinite waiting

### Requirement 9

**User Story:** As a user, I want consistent ingredient naming and quantities, so that similar foods are analyzed the same way over time.

#### Acceptance Criteria

1. THE Food Analysis System SHALL use standardized ingredient names that match FatSecret database conventions
2. WHEN estimating quantities, THE Food Analysis System SHALL apply consistent portion size assumptions for common ingredients
3. THE Food Analysis System SHALL maintain a mapping table of common dish names to typical ingredient compositions
4. WHEN analyzing the same food type multiple times, THE Food Analysis System SHALL produce ingredient lists with less than 15% variation in quantities
5. THE Food Analysis System SHALL normalize ingredient names to singular form and lowercase before FatSecret queries

### Requirement 10

**User Story:** As a user, I want the system to handle edge cases like packaged foods or single ingredients, so that all types of food images can be analyzed.

#### Acceptance Criteria

1. WHEN the image contains a single whole ingredient, THE Food Analysis System SHALL skip ingredient decomposition and query FatSecret directly
2. WHEN packaged food labels are visible and readable, THE Food Analysis System SHALL extract nutritional information from the label instead of using the full pipeline
3. WHEN the image contains beverages, THE Food Analysis System SHALL estimate volume in milliliters or fluid ounces
4. WHEN the image contains mixed dishes like casseroles or stews, THE Food Analysis System SHALL identify at least the 5 most prominent ingredients
5. WHEN no food can be detected in the image, THE Food Analysis System SHALL return an error message requesting a clearer photo
