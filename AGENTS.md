# Repository Guidelines

## Project Context

Cal AI is an Expo Router + React Native app for:
- meal photo analysis (Gemini + FatSecret nutrition lookup),
- meal logging and history with Supabase Storage image uploads,
- goal flow and macro target calculation,
- progress tracking with user weight log entries.

## Project Structure & Ownership

- `app/`: Expo Router routes and navigation.
- `app/(public)/`: unauthenticated flow (`signin`, auth entry points).
- `app/(app)/`: authenticated app shell, tabs, camera, meal history, and goal-flow/settings routes.
- `components/`: reusable UI building blocks.
- `components/ui/`: design-system primitives (`Button`, `Card`, `InputField`, `ProgressBar`, etc.).
- `components/goal-flow/`, `components/settings/`: feature-specific UI.
- `services/`: business logic and integrations.
- `services/advancedFoodAnalysis.ts`: main orchestrator for the food analysis pipeline.
- `services/foodAnalysis.ts`: canonical analysis helpers for deriving UI labels and view data from `AdvancedAnalysisResult`; do not reintroduce legacy flattened analysis shapes here.
- `services/fatSecretApi.ts`: nutrition lookup + OAuth client-credentials flow.
- `services/mealLog.ts` + `services/mealPhotoStorage.ts`: meal persistence and photo storage (`meal-photos` bucket).
- `services/userGoals.ts` + `services/userWeightEntries.ts`: goals and weight log persistence.
- `store/`: Zustand feature stores.
- `lib/`: shared types/utilities (`supabase`, session bootstrap, linking helpers, meal-log types/store).
- `constants/theme.ts`: typography, colors, spacing, and shared design tokens.
- `__tests__/`: Jest tests + mocks.
- `supabase/migrations/`: schema changes (goals, weight entries, meal photos).

## Build, Test, and Development Commands

Run from repo root:

- `npm ci`: install dependencies from lockfile.
- `npm run start`: start Expo dev server.
- `npm run ios`: launch iOS target.
- `npm run android`: launch Android target.
- `npm run web`: launch web target.
- `npm test`: run Jest (`**/__tests__/**/*.test.ts(x)`).
- `npm run lint`: run Expo ESLint config.
- `npm run reset-project`: Expo scaffold reset script (template utility; avoid in normal feature work).

## Environment & Runtime Configuration

Current runtime keys used by the app:

- `EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY` (required for advanced food analysis).
- `EXPO_PUBLIC_GOOGLE_GEMINI_MODEL` (optional override).
- `EXPO_PUBLIC_FATSECRET_CLIENT_ID` / `EXPO_PUBLIC_FATSECRET_CLIENT_SECRET`.
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

Notes:

- Supabase also supports fallback from `expo.extra` in `app.json` via `lib/supabase.ts`.
- If env usage changes, update `.env.example` in the same PR.
- Never commit `.env` or other secret-bearing local files.

## Coding Style & Conventions

- TypeScript strict mode is enabled; keep new code fully typed.
- Use 2-space indentation, single quotes, and trailing semicolons.
- Use `@/` import alias for repo-root modules.
- Naming: `PascalCase.tsx` for React components; `camelCase.ts` for services/store/helpers; route files in `app/` follow Expo Router naming (lowercase or kebab-case where relevant).
- Reuse tokens from `constants/theme.ts` and primitives from `components/ui/` before adding one-off styling.
- Keep side effects and API calls in `services/`; keep components focused on rendering + orchestration.
- For food analysis, keep `AdvancedAnalysisResult` as the source of truth from service to UI. Derive display labels from that canonical shape instead of flattening into route-specific legacy fields.

## Testing Guidelines

- Framework: Jest + `ts-jest`.
- Test environment: `__tests__/customEnvironment.js`.
- Setup file: `__tests__/setup.ts`.
- Test file pattern: `__tests__/**/*.test.ts` and `__tests__/**/*.test.tsx`.
- Add/update mocks in `__tests__/__mocks__/` for Expo, AsyncStorage, Supabase, and image tooling.
- Prioritize tests for store cache behavior, upload/error paths (meal photos + meal log), and nutrition/goal data mapping.
- When touching food analysis, prioritize tests for route-param serialization, serving/unit preservation (`g` vs `ml` vs `serving`), validation warnings, adjustment provenance, and fallback nutrition sources.

## Database & Migration Workflow

- Add schema changes as new files in `supabase/migrations/`.
- Document new migrations and schema intent in `supabase/README.md`.
- Preserve/extend RLS policies when modifying user-owned tables.
- Keep migration filenames timestamp-prefixed and descriptive.

## Commit & Pull Request Guidelines

- Preferred commit style is Conventional Commits (optionally scoped), e.g. `feat(goal-flow): ...` and `refactor(food-analysis): ...`.
- Ticket-style prefixes (`MOB-1: ...`, `feat(MOB-2): ...`) are also used in this repo.
- PR checklist: concise summary, testing notes (`npm test`, `npm run lint`), screenshots/screen recordings for UI changes, and env var + migration notes when applicable.

## Security & Repo Hygiene

- Do not commit local/generated folders: `.expo/`, `node_modules/`, `dist/`, `web-build/`, `ios/`, `android/`.
- Keep secrets out of source control; prefer environment variables and secret management in deployment tooling.
