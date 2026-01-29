# Repository Guidelines

## Project Structure & Module Organization

- `app/`: Expo Router routes (grouped under `app/(app)` and `app/(public)`).
- `components/`: shared React Native components (`components/ui/` is the design-system layer).
- `services/`: business logic + external integrations (food analysis, APIs, storage helpers).
- `store/`: Zustand state stores.
- `lib/`: shared types/utilities (Supabase client, session store, type defs).
- `assets/`: images and other static assets.
- `__tests__/`: Jest tests and mocks.
- `supabase/`: SQL migrations and schema notes.

## Build, Test, and Development Commands

Run these from the repo root:

- `npm ci`: install dependencies from `package-lock.json`.
- `npm run start`: start Expo dev server.
- `npm run ios` / `npm run android` / `npm run web`: launch a platform target.
- `npm test`: run Jest (`__tests__/**/*.test.ts(x)`).
- `npm run lint`: run Expo ESLint configuration.
- `npm run reset-project`: reset the scaffolded project state (see `scripts/reset-project.js`).

## Coding Style & Naming Conventions

- TypeScript + React Native; `tsconfig.json` enables `strict` mode.
- Indentation: 2 spaces; prefer single quotes and trailing semicolons (match existing files).
- Imports: use the `@/` path alias for repo-root modules (e.g. `@/services/foodAnalysis`).
- File naming: `camelCase.ts` for helpers, `PascalCase.tsx` for components.

## Testing Guidelines

- Framework: Jest + `ts-jest` with a custom test environment (`__tests__/customEnvironment.js`).
- Place new tests in `__tests__/` and name them `*.test.ts` / `*.test.tsx`.
- Prefer updating/adding mocks in `__tests__/__mocks__/` for Expo/Supabase dependencies.

## Commit & Pull Request Guidelines

- Commit messages generally follow Conventional Commits with optional scope (e.g. `feat(goal-flow): …`, `refactor(food-analysis): …`). Ticket-style prefixes like `MOB-1:` also appear—use them when relevant.
- PRs should include: a short description, testing notes (`npm test`, `npm run lint`), and screenshots/screen recordings for UI changes.
- If you add env vars, update `.env.example` and never commit `.env`.
- For schema changes, add a new SQL migration under `supabase/migrations/` and reference it in `supabase/README.md`.

## Security & Configuration Tips

- Local-only folders: `.expo/`, `node_modules/`, and generated native folders (`ios/`, `android/`) should not be committed (see `.gitignore`).
