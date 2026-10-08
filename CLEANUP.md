# Project cleanup — September 25, 2026

## Removed

29 confirmed-unused files:

- Old local-only stores: `store/foodStore.ts`, `store/userProfileStore.ts`, and their unused `components/profile-input-modal.tsx`.
- Duplicate unused calculator: `services/nutritionCalculation.ts`. The active advanced analysis, aggregation, and goal calculation services remain.
- Abandoned components: `CalorieTrendChart.tsx`, `settings/HeroMetric.tsx`, and `settings/ProfileHeader.tsx`.
- Unused UI files: `ui/Button.tsx`, `ui/InputField.tsx`, `ui/ListRow.tsx`, and `ui/collapsible.tsx`.
- Expo starter remnants: `external-link.tsx`, `hello-wave.tsx`, `parallax-scroll-view.tsx`, `themed-text.tsx`, `themed-view.tsx`, all three unused theme hooks, the demo modal route, and the reset-project script.
- Three unused standalone mock files. The active mocks are in `__tests__/setup.ts` and individual tests.
- Two obsolete planning/review documents: `advice.md` and `refactore-plan-setings.md`. The current review is retained.
- Two unused React logo images. Food examples and design references are retained.

Seven direct dependencies removed, with package-lock.json updated by npm:

| Dependency | Reason |
| --- | --- |
| `@tanstack/react-query` | No application usage |
| `expo-camera` | Capture uses expo-image-picker |
| `expo-image` | No application usage; images use React Native Image |
| `expo-web-browser` | No application usage |
| `react-native-gifted-charts` | Only used by the removed chart; progress uses wagmi-charts |
| `@supabase/auth-js` | No direct usage; supplied transitively by supabase-js |
| `@react-navigation/elements` | No direct usage; supplied transitively by navigation |

Native/web runtime dependencies and active icon, font, navigation, animation, image-picker, compression, and chart packages remain.

## Reorganized

- Moved GoalFlowContext from the route directory to `components/goal-flow/` and updated all imports.
- Moved settings labels to `constants/settings.ts`.
- Removed the redundant settings type module; settings use the canonical goal types.
- Removed unused starter theme exports, obsolete settings exports, and unused local calculations.
- Removed the demo modal registration and reset-project npm command.
- Replaced obsolete Perplexity instructions in `.env.example` with the current required Gemini configuration.
- Added `npm run typecheck`, a root README, and updated repository instructions.
- Escaped an existing JSX apostrophe to resolve the lint error without changing displayed text.

## Recovery

Because this folder has no Git history, a pre-cleanup snapshot is saved at `.cleanup-backups/before-cleanup-20260925-174744.zip`. It includes source, tests, root configuration/lockfile, the removed reference documents, `.env.example`, and the two removed logos. It excludes actual `.env` credentials. The backup directory is ignored by Git. Extract selected original files to restore them; restore both package.json and package-lock.json together if rolling back dependencies.

## Verification

- All 12 tests across 4 suites pass after removal and reorganization.
- Import graph: all 75 remaining source/test modules are reachable from routes or test roots; no unresolved local or external imports found. This is static validation, not an on-device test.
- `npm ls --depth=0` passes; lockfile root dependencies match package.json.
- Typecheck still reports the same 6 pre-existing diagnostics: missing Layout.padding, four Text.defaultProps errors, and incompatible FoodCategory types. No new type errors were introduced.
- Final lint passes with 0 errors and 6 pre-existing warnings (down from 1 error and 10 warnings in the initial review).
- No native build or live AI/backend test was performed. Existing missing app icons/splash assets are documented in README.md.
