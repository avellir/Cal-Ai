# Cal AI

Expo Router / React Native app for photo-based meal estimates, calorie and macro logging, personal goals, and weight tracking. Uses Azure OpenAI through Supabase Edge Functions, a small built-in nutrition reference, Supabase, and Zustand.

This branch includes the local prototype cleanup, Expo SDK 57 upgrade, Azure analysis integration, production plans, and the first two daily-tracking changes.

## Local development

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and supply your development credentials.
3. Run `npm start`, then select a device; `npm run android`, `npm run ios`, and `npm run web` are also available. Native iOS simulator development requires macOS.

Photo analysis requires the authenticated `analyze-food` function. Follow [Azure setup](supabase/AZURE_SETUP.md). Azure credentials stay in Supabase secrets. Nutrition lookup currently uses a small built-in table; FatSecret is disabled. Unknown foods use generic estimates, so verify results before saving.

## Checks

- `npm test -- --runInBand`
- `npm run lint`
- `npm run typecheck`
- `npm run check:env` (prints presence checks, never credential values)

## Daily tracking

Select a date on Home to see that day's calories, macros, and meals. Scanning from a selected date preserves it through review. Use **Edit meal details** on scan review to correct the name, nutrition per base portion, portion multiplier, meal type, and local date/time before saving. Nutrition is multiplied by the selected portion once.

The shared editor and account-scoped in-memory scan drafts are implemented. A standalone manual-entry flow, saved-meal editing, durable drafts, and reliable retry persistence are planned in [DAILY_TRACKING_PLAN.md](DAILY_TRACKING_PLAN.md).

- Day boundaries use the device's local timezone, including daylight-saving transitions. Today refreshes at midnight and when the app returns to the foreground; an explicitly selected historical day stays selected.
- Goals update remaining calories/macros immediately. Intake remains visible without goals, and historical dates explicitly compare against the current target.
- Loading, empty days, and failed requests have separate states, including retry for loading failures.
- The editor validates required fields, nonnegative finite nutrition, positive portions, meal type, and real calendar dates/times. Decimal points and decimal commas are accepted. Empty nutrition fields require an explicit value, including zero.
- Applying edits updates review; cancelling keeps the last applied values. Original canonical analysis stays separate from nutrition corrections, which are labeled **Nutrition edited by you**.
- Sign-out or changing accounts clears in-memory drafts; refreshing the same account's session preserves them. New scan navigation uses a draft ID, with compatibility for older result parameters.

For example, 600 calories per base portion at 2x becomes 1,200 calories in both review and the saved meal. Saving returns to the meal's chosen date. These changes use the existing `logged_at`, meal type, and quantity fields and require no new migration.

## Current branch verification (October 1, 2026)

| Check | Result |
| --- | --- |
| Jest | 85 tests pass across 13 suites |
| TypeScript | Passes |
| iOS JavaScript/assets export | Passes; generated output is excluded from Git |
| ESLint for daily-tracking changes | Passes |
| Full app/components ESLint | 58 existing errors and 4 warnings in unrelated files |
| Browser checks with local fixtures | Date selection, reactive goals, no-goal intake, editor validation, portion scaling, cancellation, and simulated save return to the selected day pass |

The browser fixture made no live backend writes. Live Supabase saving and physical-device camera/keyboard/midnight behavior still need verification. An export checks the bundle; it does not verify a signed release or App Store readiness.

Next work is transactional/idempotent persistence and account-safe meal caches, followed by standalone manual entry, saved-meal editing, durable drafts, and photo recovery. Current drafts do not survive restarting the app, and local draft IDs are not server idempotency keys. The existing meal service still performs sequential writes and can leave partial data after an interrupted save.

## Structure

- `app/`: routes and navigation layouts only.
- `components/`: shared UI and feature components; goal setup context is in `components/goal-flow/`.
- `constants/`: theme tokens and settings labels.
- `lib/`: shared types, Supabase/session helpers, and the meal log store.
- `services/`: AI analysis, nutrition lookup, persistence, and calculations.
- `store/`: goals and weight state.
- `__tests__/`: Jest tests and shared mocks in `setup.ts`.
- `supabase/`: available migrations and schema notes.
- `assets/`: retained food examples and design references.

## Current limitations

See [PRODUCTION_PLAN.md](PRODUCTION_PLAN.md) for the October 1 production-readiness review, current check results, and phased implementation plan.

See [PROJECT_REVIEW.md](PROJECT_REVIEW.md) for the initial review and release priorities, and [CLEANUP.md](CLEANUP.md) for subsequent cleanup changes.

This copy is missing baseline migrations for the core meal tables, so the included migrations do not recreate the entire backend. A release build and live backend walkthrough still need verification.

## iPhone prototype setup

1. Install Expo Go compatible with SDK 57 on your iPhone, and connect it to the same Wi-Fi as this computer.
2. Run `npm start -- --lan`. Scan the terminal QR code with iPhone Camera and open in Expo Go. Windows cannot run Apple's iOS simulator.
3. Use email sign-in. Google/Apple buttons are still development stubs and do not create real authenticated sessions.
4. In Supabase Authentication URL Configuration, allow the exact callback shown by your development host: `exp://YOUR_LAN_IP:8081/--/auth-callback`. For a standalone app use `calai://auth-callback`; for web allow its `/auth-callback` URL. Do not widen the production redirect allowlist with unrestricted wildcards. Alternatively use the email-code entry option, if your Supabase email template supplies a code.
5. Deploy `analyze-food` following [Azure setup](supabase/AZURE_SETUP.md). Configure Supabase using `.env.example`. The supplied Supabase app.json fallback is used if its environment overrides are absent. Restart Expo after changing environment variables. Do not share credentials in chat or commit `.env`.

At the September 28 startup check, Supabase auth health returned HTTP 200. Health is not verification of user login or database policies.

The restored prototype icon/splash PNGs can be regenerated with `./scripts/generate-brand-assets.ps1` on Windows. Expo Go does not fully reproduce the standalone splash experience; verify the final splash in a release build.

Startup fixes include SDK 54 dependency alignment, an explicit Babel preset dependency, import.meta transformation for Zustand, and a web resolver workaround for the chart library's CommonJS worklet initialization error. The root navigator anchor now names its immediate child route group.

Verified locally on September 28: sign-in page renders, an unauthenticated `/camera` visit redirects to `/signin`, TypeScript passes, 24 tests pass, lint has no errors (6 existing warnings), and the iOS JavaScript/assets export builds. A physical iPhone launch, successful user sign-in, camera access, and photo analysis still require device verification and credentials.

## Expo SDK 57 upgrade (September 29)

The app now uses Expo SDK 57, React Native 0.86.3 and React 19.2.3. Expo modules,
Babel, Worklets, Reanimated, TypeScript and the Jest adapter were aligned together.
Router imports now use Expo Router's bundled navigation exports; obsolete native
configuration flags and removed StyleSheet APIs were updated.

After updating dependencies, stop an old Metro server with Ctrl+C and run:

```sh
npx expo start --clear --lan
```

Scan the new QR code with your iPhone on the same Wi-Fi. A successful bundle export
checks JavaScript compatibility; a physical device test is still required.
Do not use `npm audit fix --force` to complete an Expo upgrade. Current audit results
have no critical advisories, but 25 lower-severity advisories remain (8 high, 16 moderate,
1 low); those need separate dependency review.

Upgrade validation: Expo Doctor passed 21/21 checks, TypeScript passed, all 42 Jest
tests passed, and the iOS JavaScript/assets export succeeded. The SDK 57 ESLint
config also enables new React Compiler rules that flag existing animation refs,
effect-based state updates, and memoization. Lint is not clean; those findings
remain for a focused UI cleanup. The rule configuration has not been weakened.
