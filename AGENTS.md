# Repository Guidelines

## Project Structure & Module Organization
The Expo Router entry point lives in `app/`, with route groups like `app/(tabs)` for the tab navigator and `app/modal.tsx` for modal screens. Shared view logic belongs in `components/`; stubbed folders such as `components/ui` signal where reusable primitives should go. Hooks that bridge platform APIs are in `hooks/` (see `hooks/use-color-scheme.ts`), and theme tokens live in `constants/theme.ts`. Static assets reside under `assets/images/`. Keep supporting scripts, including the cleanup helper, inside `scripts/`. Path alias `@/` resolves to project root—use it for all internal imports.

## Build, Test, and Development Commands
Run `npm install` once per clone, then `npm run start` to launch Expo (or `npm run ios`, `android`, `web` for specific targets). `npm run lint` checks TypeScript styling through `eslint-config-expo`. Use `npm run reset-project` only when you need a clean starter app; it moves current source into `app-example/`.

## Coding Style & Naming Conventions
Prefer function components with PascalCase names (e.g. `HelloWave`). Colocate styles with their screen or component; keep files under 300 lines. Stick to two-space indentation and TypeScript’s strict mode defaults. Export a single default component per route file, and group shared helpers under readable module names (`themed-view`, `parallax-scroll-view`). Format imports so third-party modules appear before `@/` aliases.

## Testing Guidelines
Automated tests are not wired up yet. When adding them, base your setup on `jest-expo` with `@testing-library/react-native`. Place specs next to the code (`app/(tabs)/__tests__/index.test.tsx`) and name files `*.test.tsx`. Until the harness lands, document manual Expo Go or web verification steps in your PR.

## Commit & Pull Request Guidelines
Follow the existing convention: start commit messages with the related ticket (e.g. `MOB-1`) and an imperative summary (`MOB-1: scaffold expo-router tabs + theme`). Keep PRs scoped to a feature or bug fix, describe user-facing changes, list platforms exercised, and link issues. Screenshots or screen recordings are expected for UI tweaks. Request review before merging; do not merge with failing lint or unexplained test gaps.
