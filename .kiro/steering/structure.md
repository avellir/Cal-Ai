# Project Structure

## Root Directory Organization

```
cal-ai/
├── app/                    # Expo Router file-based routing
│   ├── (app)/             # Authenticated app routes
│   ├── (public)/          # Public/unauthenticated routes
│   ├── _layout.tsx        # Root layout with navigation setup
│   └── auth-callback.tsx  # Authentication callback handler
├── components/            # Reusable UI components
│   ├── ui/               # Base UI components
│   └── *.tsx             # Feature-specific components
├── lib/                  # Core utilities and configurations
├── services/             # External API integrations
├── store/                # Global state management
├── hooks/                # Custom React hooks
├── constants/            # App-wide constants
└── assets/               # Static assets (images, fonts)
```

## Key Directories

### `/app` - Routing Structure
- Uses Expo Router file-based routing with typed routes
- `(app)` - Protected routes requiring authentication
- `(public)` - Public routes (login, signup, etc.)
- `_layout.tsx` - Root layout with theme and navigation providers

### `/lib` - Core Library Code
- `supabase.ts` - Supabase client configuration
- `meal-log-types.ts` - TypeScript type definitions for meal data
- `meal-log-store.ts` - Meal logging state management
- `session-store.ts` - User session management
- `linking.ts` - Deep linking configuration

### `/services` - External Integrations
- `foodAnalysis.ts` - Google Gemini API integration for food image analysis
- `mealLog.ts` - Meal logging business logic

### `/components` - UI Components
- Themed components using React Navigation themes
- Reusable UI components in `/ui` subdirectory
- Feature-specific components at root level

### `/store` - State Management
- Zustand stores for global state
- `foodStore.ts` - Food-related state management

## File Naming Conventions
- **Components**: PascalCase for React components (`ThemedText.tsx`)
- **Hooks**: kebab-case with `use-` prefix (`use-color-scheme.ts`)
- **Services**: camelCase (`foodAnalysis.ts`)
- **Types**: kebab-case with descriptive suffix (`meal-log-types.ts`)
- **Stores**: camelCase with `Store` suffix (`foodStore.ts`)

## Import Path Aliases
- `@/*` - Maps to project root for clean imports
- Example: `import { supabase } from '@/lib/supabase'`

## Asset Organization
- Images stored in `/assets/images/`
- Platform-specific icons and splash screens configured
- Adaptive icons for Android with background/foreground separation