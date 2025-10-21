# Technology Stack

## Framework & Platform
- **Expo SDK 54** - React Native development platform with managed workflow
- **React Native 0.81.4** - Cross-platform mobile framework
- **Expo Router 6** - File-based routing with typed routes enabled
- **TypeScript 5.9** - Strict mode enabled with path aliases (`@/*`)

## Key Dependencies
- **Supabase** - Backend-as-a-Service for authentication and data storage
- **Zustand** - Lightweight state management
- **React Query** - Server state management and caching
- **Expo Camera & Image Picker** - Camera functionality and photo selection
- **Google Gemini 2.5 Flash API** - AI-powered food image analysis

## Development Tools
- **ESLint** with Expo config - Code linting
- **React Compiler** - Experimental optimization (enabled)
- **New Architecture** - React Native's new architecture enabled

## Common Commands

### Development
```bash
# Start development server
npm start
# or
npx expo start

# Platform-specific development
npm run android    # Android emulator
npm run ios        # iOS simulator  
npm run web        # Web browser
```

### Code Quality
```bash
# Run linter
npm run lint
```

### Project Management
```bash
# Reset to blank project (removes starter code)
npm run reset-project
```

## Environment Configuration
- Use `.env` file for environment variables
- Prefix public variables with `EXPO_PUBLIC_`
- Supabase config can be set via environment variables or `app.json` extra field
- Required: `EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY` for AI food analysis

## Build Configuration
- **iOS**: Supports tablets, uses adaptive icons
- **Android**: Edge-to-edge enabled, predictive back gesture disabled
- **Web**: Static output with favicon support
- **Permissions**: Camera and photo library access configured