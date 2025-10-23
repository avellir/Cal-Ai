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
- **Perplexity AI API** - AI-powered food image analysis with vision capabilities

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
- Required: `EXPO_PUBLIC_Perplexity_API_KEY` for AI food analysis

## Build Configuration
- **iOS**: Supports tablets, uses adaptive icons
- **Android**: Edge-to-edge enabled, predictive back gesture disabled
- **Web**: Static output with favicon support
- **Permissions**: Camera and photo library access configured
## AI Integration Best Practices

### Perplexity AI Vision API
The food analysis service uses Perplexity's vision-capable models for food image analysis:
- **Vision support**: Models can analyze images alongside text prompts
- **Structured output**: Prompts are designed to return JSON responses
- **Fallback parsing**: Client-side sanitization handles edge cases
- **Model flexibility**: Default model is `llama-3.1-sonar-large-128k-chat`

Available vision models:
- `llama-3.1-sonar-small-128k-chat` - Faster, more economical
- `llama-3.1-sonar-large-128k-chat` - Balanced performance (default)
- `llama-3.1-sonar-huge-128k-chat` - Highest accuracy

When making Perplexity API calls:
1. Use the chat completions endpoint with multimodal content
2. Include both text prompts and base64-encoded images
3. Set appropriate temperature and max_tokens for consistent output
4. Implement response sanitization to handle markdown code blocks
