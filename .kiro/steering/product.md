# Cal AI - Product Overview

Cal AI is a cross-platform mobile application for food logging and nutritional tracking. The app leverages AI-powered image analysis to automatically identify food items and calculate nutritional information from photos.

## Core Features

- **AI Food Analysis**: Users can photograph meals to get automatic nutritional breakdowns (calories, protein, carbs, fat)
- **Meal Logging**: Track daily food intake with timestamps and meal types (breakfast, lunch, dinner, snack)
- **Camera Integration**: Built-in camera and photo library access for food photography
- **Confidence Scoring**: AI provides confidence levels for nutritional estimates
- **Cross-Platform**: Runs on iOS, Android, and web via Expo

## Target Users

Health-conscious individuals who want to track their nutrition without manual data entry, leveraging AI to simplify the food logging process.

## Technology Approach

The app uses Google Gemini 2.5 Flash API for computer vision analysis, providing cost-effective AI capabilities (free up to 1500 requests/day). The architecture supports offline-first data storage with Supabase for cloud sync and user authentication.