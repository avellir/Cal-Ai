# Implementation Plan

- [x] 1. Set up FatSecret API integration foundation





  - Create FatSecret OAuth 2.0 authentication module with token caching
  - Implement token refresh logic with expiration handling
  - Add environment variable configuration for FatSecret credentials
  - Create request queue system to manage API rate limiting
  - _Requirements: 3.1, 6.1, 8.3_

- [x] 2. Implement core data models and types





  - Define TypeScript interfaces for FoodRegion, SegmentationResult, Ingredient, DecompositionResult
  - Create FatSecretNutrition and EnrichedIngredient types
  - Define AdvancedAnalysisResult type with metadata
  - Add type guards and validation helpers
  - _Requirements: 1.2, 2.2, 3.3, 4.5, 5.1_

- [ ] 3. Build Stage 1: Image Segmentation
- [x] 3.1 Create segmentation prompt and schema





  - Write detailed segmentation prompt with visual analysis instructions
  - Define JSON schema for segmentation response with bounding boxes
  - Implement confidence scoring guidelines for segmentation
  - _Requirements: 1.1, 1.2, 1.4_

- [x] 3.2 Implement segmentFoodImage function




  - Create function to call Gemini API with segmentation prompt
  - Parse and validate segmentation response
  - Handle edge cases (no regions detected, poor image quality)
  - _Requirements: 1.1, 1.3, 1.5, 6.2_

- [x] 4. Build Stage 2: Ingredient Decomposition






- [x] 4.1 Create decomposition prompt and schema

  - Write ingredient decomposition prompt with quantity estimation guidelines
  - Define JSON schema for decomposition response
  - Add FatSecret-compatible ingredient naming rules
  - Include cooking method detection and oil estimation logic
  - _Requirements: 2.1, 2.2, 2.3, 7.1, 7.2, 7.4_


- [x] 4.2 Implement decomposeIngredients function

  - Create function to analyze individual food regions
  - Parse decomposition response and extract ingredients
  - Handle preparation method adjustments
  - _Requirements: 2.1, 2.2, 2.4, 7.1, 7.3, 7.5_


- [x] 4.3 Implement parallel region processing

  - Create decomposeAllRegions function to process multiple regions concurrently
  - Aggregate ingredients from all regions
  - Handle partial failures gracefully
  - _Requirements: 1.3, 8.2_

- [x] 5. Build Stage 3: FatSecret Nutritional Lookup




- [x] 5.1 Implement FatSecret search functionality


  - Create searchFatSecretFood function with OAuth authentication
  - Implement search with alternative terms (with/without preparation)
  - Add error handling for search failures
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 5.2 Implement FatSecret nutrition retrieval


  - Create getFatSecretNutrition function to get detailed food data
  - Parse FatSecret API response and extract nutritional values
  - Handle multiple serving sizes
  - _Requirements: 3.1, 3.3, 5.3_

- [x] 5.3 Create USDA fallback system


  - Build USDA database with common food nutritional values
  - Implement getUSDAFallback function for missing ingredients
  - Add fallback detection and confidence adjustment
  - _Requirements: 3.4, 6.1_

- [x] 5.4 Implement ingredient nutrition lookup with scaling


  - Create lookupIngredientNutrition with fallback chain
  - Implement calculateScaleFactor to convert serving sizes
  - Add unit conversion utilities (convertToGrams, parseServingToGrams)
  - Scale nutritional values based on ingredient quantities
  - _Requirements: 2.2, 3.2, 3.3, 4.1_



- [x] 5.5 Implement batched nutrition lookup

  - Create batchLookupNutrition to process ingredients in groups
  - Integrate with request queue for rate limiting
  - Handle partial batch failures
  - _Requirements: 3.5, 8.3_

- [x] 6. Build Stage 4: Nutritional Aggregation





- [x] 6.1 Implement nutrition aggregation logic


  - Create aggregateNutrition function to sum all ingredient nutrients
  - Calculate weighted average confidence score
  - Round totals according to requirements
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6.2 Generate ingredient breakdown

  - Format ingredient list with contributions to total nutrition
  - Group ingredients by food region
  - Add user-friendly unit conversions
  - _Requirements: 4.5, 5.1, 5.2, 5.4_

- [x] 7. Implement main orchestration function




- [x] 7.1 Create analyzeAdvancedFoodImage function


  - Orchestrate all four stages in sequence
  - Handle stage failures and provide meaningful errors
  - Track processing time and completed stages
  - Return comprehensive AdvancedAnalysisResult
  - _Requirements: 6.2, 6.3, 8.1, 8.4_

- [x] 7.2 Add progress tracking support


  - Implement analyzeAdvancedFoodImageWithProgress variant
  - Emit progress events for UI updates
  - _Requirements: 8.4_

- [x] 8. Implement validation and error handling





- [x] 8.1 Create validation logic


  - Implement validateAdvancedAnalysis for nutritional consistency
  - Check calorie-to-macro ratios
  - Adjust confidence based on fallback usage
  - _Requirements: 4.1, 5.5_

- [x] 8.2 Add comprehensive error handling


  - Implement retry logic with exponential backoff for API failures
  - Add user-friendly error messages for common failure scenarios
  - Handle timeout scenarios
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.5_

- [x] 9. Handle edge cases





- [x] 9.1 Implement single ingredient detection


  - Detect when image contains single whole ingredient
  - Skip decomposition and query FatSecret directly
  - _Requirements: 10.1_

- [x] 9.2 Add packaged food label detection


  - Detect visible nutrition labels in images
  - Extract nutritional information from labels
  - Bypass full pipeline when label is readable
  - _Requirements: 10.2_

- [x] 9.3 Handle beverages and liquids

  - Add volume estimation for beverages
  - Convert to milliliters or fluid ounces
  - _Requirements: 10.3_

- [x] 9.4 Handle complex mixed dishes

  - Identify prominent ingredients in casseroles/stews
  - Limit to top 5 ingredients when composition is unclear
  - _Requirements: 10.4_

- [x] 9.5 Add no-food detection

  - Return clear error when no food is detected
  - Suggest retaking photo with better view
  - _Requirements: 10.5_

- [x] 10. Create backward compatibility layer



  - Implement convertToLegacyFormat adapter function
  - Add feature flag to switch between old and new systems
  - Ensure existing UI components work with new result format
  - _Requirements: All (compatibility)_

- [x] 11. Update environment configuration


  - Update .env.example with FatSecret credentials
  - Add configuration validation on app startup
  - Document FatSecret API setup process
  - _Requirements: 3.1, 6.1_

- [x] 12. Optimize performance




- [x] 12.1 Implement caching system


  - Create ingredient search result cache
  - Add cache invalidation strategy
  - _Requirements: 3.5, 8.2_

- [x] 12.2 Add request queue optimization


  - Implement FatSecretRequestQueue class
  - Add configurable delay between requests
  - _Requirements: 8.3_

- [ ]* 13. Create comprehensive test suite
  - Write unit tests for each stage (segmentation, decomposition, lookup, aggregation)
  - Create integration tests for end-to-end pipeline
  - Add test cases for edge scenarios (single item, complex dishes, poor quality)
  - Test error handling and fallback mechanisms
  - _Requirements: All_

- [ ]* 14. Add performance monitoring
  - Implement latency tracking for each stage
  - Add API quota usage monitoring
  - Create performance metrics dashboard
  - _Requirements: 8.1, 8.2_
