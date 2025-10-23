# Requirements Document

## Introduction

This feature addresses a critical accuracy issue in the food analysis system where ingredient detection is working correctly, but portion size estimation defaults to 100g for all ingredients regardless of the actual visible quantities in the photo. This results in incorrect total weights and nutritional calculations. The system must leverage visual cues, reference objects, and comparative analysis to estimate realistic portion sizes.

## Glossary

- **Food Analysis System**: The multi-stage service that processes food images through segmentation, ingredient decomposition, and nutritional lookup
- **Portion Size Estimation**: The process of determining the actual weight or volume of food items visible in an image
- **Reference Objects**: Items in the image that provide scale context (plates, utensils, hands, cups)
- **Visual Cues**: Observable characteristics that indicate portion size (coverage area, height, density, comparison to other items)
- **Gemini Vision API**: Google's AI model used for image analysis and portion estimation
- **Relative Sizing**: Estimating portion sizes by comparing food items to each other and to reference objects

## Requirements

### Requirement 1

**User Story:** As a user, I want the system to estimate actual portion sizes from my photo, so that nutritional calculations reflect what I'm actually eating rather than arbitrary 100g servings.

#### Acceptance Criteria

1. WHEN analyzing food items in an image, THE Food Analysis System SHALL estimate portion sizes based on visual analysis rather than defaulting to fixed weights
2. THE Food Analysis System SHALL use reference objects visible in the image to calibrate portion size estimates
3. WHEN a standard dinner plate is visible, THE Food Analysis System SHALL use the 10-11 inch diameter as a reference scale for all food items on that plate
4. WHEN utensils are visible, THE Food Analysis System SHALL use standard fork length (7 inches) or spoon dimensions as reference scales
5. THE Food Analysis System SHALL estimate portion coverage as a percentage of the plate or container surface area

### Requirement 2

**User Story:** As a user, I want the system to compare food items to each other for sizing, so that relative proportions are maintained even without clear reference objects.

#### Acceptance Criteria

1. WHEN multiple food items are visible, THE Food Analysis System SHALL estimate their sizes relative to each other based on visual proportions
2. THE Food Analysis System SHALL account for food density when converting visual volume to weight estimates
3. WHEN estimating rice portions, THE Food Analysis System SHALL recognize that 1 cup of cooked rice weighs approximately 180g and occupies a specific visual volume
4. WHEN estimating protein portions, THE Food Analysis System SHALL use standard serving sizes as baselines (chicken breast 170g, fish fillet 140g) and adjust based on visual size
5. THE Food Analysis System SHALL estimate vegetable portions by comparing visible quantity to standard cup measurements

### Requirement 3

**User Story:** As a user, I want the system to account for food stacking and depth, so that portion estimates include the full three-dimensional volume of food.

#### Acceptance Criteria

1. WHEN food items are stacked or piled, THE Food Analysis System SHALL estimate height or depth in addition to surface area coverage
2. THE Food Analysis System SHALL describe portion depth using measurable terms such as "1 inch high", "2 cups stacked", or "fills bowl to rim"
3. WHEN rice or grains are visible, THE Food Analysis System SHALL estimate volume based on both coverage area and visible height
4. WHEN proteins are stacked or layered, THE Food Analysis System SHALL account for multiple pieces or layers in the weight estimate
5. THE Food Analysis System SHALL recognize when food fills a container and estimate total volume accordingly

### Requirement 4

**User Story:** As a user, I want portion estimates to use realistic ranges rather than exact values, so that the system acknowledges estimation uncertainty.

#### Acceptance Criteria

1. THE Food Analysis System SHALL provide portion estimates as realistic values based on visual analysis rather than placeholder defaults
2. WHEN portion size is uncertain, THE Food Analysis System SHALL estimate conservatively within a reasonable range
3. THE Food Analysis System SHALL adjust confidence scores downward when portion estimation has high uncertainty
4. WHEN reference objects are absent or unclear, THE Food Analysis System SHALL use typical serving sizes as baselines and note the increased uncertainty
5. THE Food Analysis System SHALL provide reasoning that explains the basis for portion size estimates

### Requirement 5

**User Story:** As a user, I want the system to recognize standard serving containers, so that portion sizes can be estimated from container volumes.

#### Acceptance Criteria

1. WHEN food is served in a standard bowl, THE Food Analysis System SHALL estimate the bowl volume as approximately 1-2 cups (240-480ml)
2. WHEN food is served in a standard cup or glass, THE Food Analysis System SHALL estimate volume based on fill level and standard cup size (8oz/240ml)
3. WHEN food is served on a small plate, THE Food Analysis System SHALL recognize it as approximately 7-8 inches diameter and adjust portion estimates accordingly
4. WHEN food is served in a takeout container, THE Food Analysis System SHALL estimate volume based on typical container sizes (16oz, 32oz)
5. THE Food Analysis System SHALL describe container fill level as a percentage or fraction (half full, three-quarters full, filled to rim)

### Requirement 6

**User Story:** As a user, I want the system to use hand or finger references when visible, so that portion sizes can be estimated even without plates or utensils.

#### Acceptance Criteria

1. WHEN a hand is visible in the image, THE Food Analysis System SHALL use palm width (approximately 3-4 inches) as a reference scale
2. WHEN fingers are visible touching or near food, THE Food Analysis System SHALL use finger width (approximately 0.75 inches) as a reference scale
3. THE Food Analysis System SHALL estimate food items as multiples or fractions of hand size (fist-sized, palm-sized, finger-length)
4. WHEN a hand is holding food, THE Food Analysis System SHALL estimate portion size relative to typical hand dimensions
5. THE Food Analysis System SHALL adjust hand-based estimates based on visible hand size indicators (adult vs. child proportions)

### Requirement 7

**User Story:** As a user, I want the system to provide detailed reasoning for portion estimates, so that I can understand and verify the analysis.

#### Acceptance Criteria

1. THE Food Analysis System SHALL include reasoning that describes the visual cues used for portion estimation
2. THE Food Analysis System SHALL specify which reference objects were used for scale calibration
3. WHEN portion estimates are based on comparisons, THE Food Analysis System SHALL explain the comparison logic
4. THE Food Analysis System SHALL note when portion estimates have high uncertainty due to image quality or lack of references
5. THE Food Analysis System SHALL provide portion descriptions in both weight (grams) and common measurements (cups, pieces, tablespoons)

### Requirement 8

**User Story:** As a user, I want the system to validate portion estimates against realistic ranges, so that obviously incorrect estimates are caught and corrected.

#### Acceptance Criteria

1. THE Food Analysis System SHALL validate that estimated portion sizes fall within realistic ranges for each food type
2. WHEN a portion estimate exceeds typical maximum serving sizes, THE Food Analysis System SHALL flag it for review and adjust if necessary
3. WHEN a portion estimate is below typical minimum visible quantities, THE Food Analysis System SHALL adjust upward to a realistic minimum
4. THE Food Analysis System SHALL ensure that total meal weight is consistent with the number and size of visible food items
5. THE Food Analysis System SHALL compare estimated portions across ingredients to ensure relative proportions are realistic

### Requirement 9

**User Story:** As a user, I want the system to handle images without clear reference objects, so that portion estimation works even in suboptimal conditions.

#### Acceptance Criteria

1. WHEN no reference objects are visible, THE Food Analysis System SHALL use typical serving sizes as baseline estimates
2. THE Food Analysis System SHALL analyze food item proportions relative to the image frame size to infer approximate scale
3. WHEN image quality prevents accurate portion estimation, THE Food Analysis System SHALL use conservative estimates and reduce confidence scores
4. THE Food Analysis System SHALL provide a confidence penalty when portion estimates are based solely on typical servings rather than visual analysis
5. THE Food Analysis System SHALL suggest that users include reference objects in future photos for better accuracy

### Requirement 10

**User Story:** As a user, I want portion estimates to account for food preparation effects, so that cooked vs. raw volumes are handled correctly.

#### Acceptance Criteria

1. WHEN estimating cooked rice portions, THE Food Analysis System SHALL recognize that cooked rice has expanded approximately 3x from raw volume
2. WHEN estimating cooked pasta portions, THE Food Analysis System SHALL recognize that cooked pasta has expanded approximately 2-2.5x from raw volume
3. WHEN estimating cooked meat portions, THE Food Analysis System SHALL account for moisture loss and shrinkage during cooking
4. THE Food Analysis System SHALL use cooked weight standards for all portion estimates unless raw food is explicitly identified
5. THE Food Analysis System SHALL adjust portion estimates based on visible preparation indicators (grilled, fried, steamed)
