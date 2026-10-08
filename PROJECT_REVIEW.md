# Cal AI project review

Update after cleanup and fixes: the double-scaled calorie save bug and all six TypeScript diagnostics are resolved. Meal persistence now stores base nutrition and applies quantity once, with regression coverage for saving/reloading portions. App text uses an explicit shared component instead of mutating native Text.defaultProps. Historical meal records have not been repaired. Other findings below describe the original review and remain a roadmap unless noted in CLEANUP.md.

Reviewed September 25, 2026. Scope: local source, configuration, migrations, and available automated checks. Live Supabase configuration, real AI accuracy, and native device appearance were not verified. This folder has no Git metadata.

## Overall assessment

A substantial prototype with a sensible foundation. Keep the Expo/React Native app, Supabase integration, shared UI primitives, and canonical AdvancedAnalysisResult model. Prioritize reliable calorie accounting, authentication, and server-side analysis before adding features or redesigning screens.

Existing features include photo capture/library selection, Gemini ingredient recognition, FatSecret nutrition lookup and fallback estimates, portion controls, meal logging/history, goal setup, and weight history. Their presence in source does not establish that they work end to end against a live backend.

## Release blockers

1. **Portions are applied twice when meals are saved.** `app/(app)/food-result.tsx:329` supplies already-scaled calories/macros and `:339` also supplies the portion multiplier. `services/mealLog.ts:163` stores those values as food nutrition, then `:325` multiplies them by quantity again. A 500 kcal scan at 2x displays 1,000 kcal but maps to 2,000 kcal in the log. Choose one consistent contract for base nutrition and quantity. Cover 0.5x, 1x, 1.5x, and 2x through saving and reloading.

2. **Social sign-in is a development stub.** `app/(public)/signin.tsx:56` constructs fake Google/Apple sessions, then installs them into Zustand. These do not authenticate requests made by the Supabase client. Implement provider authentication or remove these options until supported; retain and verify the existing email flow.

3. **Provider credentials are used in the mobile client.** `services/advancedFoodAnalysis.ts:286` reads a public Gemini key; `services/fatSecretApi.ts:97` reads a public FatSecret client secret. Move provider calls behind authenticated server endpoints with per-user quotas and request limits. Rotate previously distributed provider secrets if applicable. Expo explicitly states EXPO_PUBLIC values are bundled in plaintext: https://docs.expo.dev/guides/environment-variables/. Google also recommends a backend proxy: https://ai.google.dev/gemini-api/docs/api-key. The Supabase anon key is a separate case; database access must be protected by RLS.

4. **Account changes do not clear user data.** Logout only calls Supabase signOut; the auth listener only updates session state. Meals, goals, and weight stores are not reset there, and persisted goals/latest weight are not keyed by user. Previous-account data can remain visible until replacement fetches succeed. Centralize account-boundary cleanup and reject stale in-flight responses.

5. **The portion slider captures its initial zero width.** The PanResponder in `app/(app)/food-result.tsx:96` is retained in a ref and its callbacks capture the first render's sliderWidth/percentage. Layout updates do not refresh those callbacks. The value calculation can divide by zero and produce NaN. Repair the gesture state and verify dragging on a device.

6. **Database setup is incomplete in this copy.** Migrations alter logged_meals but do not create profiles, food_items, logged_meals, or meal_entries. Their RLS policies cannot be audited from these files. Recover baseline migrations and verify a clean database setup and cross-user isolation before release.

## Reliability and AI quality

- Meal creation uses three separate inserts without a transaction or idempotency key. A later failure can leave partial data; retrying can create duplicates. Use a transactional server operation for the records and track photo upload separately.
- FatSecret search selects the first result (`services/fatSecretApi.ts:941`). Evaluate preparation, units, generic versus branded food, and serving equivalence instead of treating ranking as a verified match.
- Ingredient filtering removes some uncertain ingredients and limits some mixed dishes to five ingredients. This may improve consistency but can omit calorie-dense ingredients. Evaluate against measured meals before adding further heuristics.
- Confidence is model output adjusted by heuristics, not demonstrated calorie accuracy. Label results as estimates and make corrections easy.
- Allow editing ingredient identities and quantities, adding missed ingredients, manual meal entry, and correcting a saved meal. Current result controls scale the whole meal only.
- Preserve useful analysis provenance with the saved meal: original estimate, corrections, nutrition source, and model/prompt version. The current save path mainly keeps aggregate nutrition and a serving note.
- Add a fixed evaluation set of roughly 30–50 measured meals covering drinks, mixed dishes, sauces, packaged food, and poor photos. Track calorie/portion error, repeated-scan variation, latency, failures, and cost.
- Add request deadlines and cancellation. The current analysis screen promises a few seconds, while queues and retries can take much longer.
- Resize/normalize images before inference. The current base64 path reads the original image, while the Gemini request declares JPEG regardless of the input format.
- Fetch meal history by date range/page rather than downloading all meals and signing every photo URL on each load. Handle expired signed URLs and missing temporary local images explicitly.

## Product and UI polish

The source already has shared cards, buttons, macro colors, typography, and animated screens. A complete visual assessment needs an actual phone build.

- Center the flow on photo -> review estimate -> correct -> save -> updated daily total.
- Add meal type and date selection: the current save path defaults meals to snack, despite history having meal-type filters.
- Replace the static zero streak with real data or remove it.
- Preferences for reminders and theme currently change local screen state; connect them to actual behavior and persistence or hide them. Units also need a consistent app-wide preference.
- Subscription, export, and support currently open unavailable-feature alerts. Remove unfinished options from an initial release or implement their complete flows.
- Provide meaningful empty, loading, offline, error, and retry states. Avoid making a failed load look like an empty diary.
- Consolidate screen-local color palettes into the existing design tokens. Check contrast, text scaling, icon-button labels, touch targets, safe areas, and keyboard behavior on devices.
- Consider maintenance as a goal alongside losing and gaining weight.
- Complete account deletion, data handling disclosures, release identifiers, build profiles, and real-device release testing before distribution.

## Maintainability and setup

- `.env.example` still describes Perplexity and omits the required Gemini key; setup documentation does not match the implementation.
- The main combined Gemini analysis does not pass the documented model override to runGeminiRequest; the shared helper defaults to a moving model alias.
- Non-route modules live under `app/constants`, `app/types`, and the goal-flow route directory. Move support modules outside the route tree.
- Keep service boundaries but break down the large FatSecret adapter and AI orchestrator by responsibility after correctness is covered.
- Four existing test files focus on storage/cache/weight behavior. Add coverage for portion accounting, auth transitions, canonical analysis serialization, serving units, fallback nutrition, and goal calculations.
- Restore Git history if available and add a root README and continuous checks. Avoid broad dependency upgrades until a working baseline is established.

## Suggested delivery order

1. **Correctness and security:** auth, backend provider calls, portion math/slider, account isolation, baseline migrations, atomic meal saves. Exit when saved totals match displayed totals and accounts cannot see each other's data.
2. **Complete the everyday flow:** ingredient/manual corrections, meal editing, meal type/date, analysis recovery, photo persistence. Exit when a real user can log and correct meals across app restarts.
3. **Measure AI quality:** run the benchmark, improve matching and quantities from observed failures, and capture model/prompt versions and latency.
4. **Polish and release:** consistent visuals, accessible controls, honest settings, device testing, release configuration, and a small external beta.

## Verification

- Installed locked dependencies with `npm ci --ignore-scripts --no-audit --no-fund`. The initial sandboxed attempt could not access npm; the permitted network retry succeeded. Lifecycle scripts were intentionally not executed.
- `npm test -- --runInBand`: **4 suites, 12 tests passed**. Logged storage errors are expected mocked failure cases.
- `npx tsc --noEmit --pretty false`: **failed with 6 diagnostics**. One missing `Layout.padding` property in goal-flow/sex-activity, four uses of unsupported `Text.defaultProps` typings in app/_layout, and incompatible FoodCategory types in advancedFoodAnalysis (including `oil`).
- `npm run lint` with `EXPO_NO_TELEMETRY=1`: **1 error, 10 warnings**. The error is an unescaped apostrophe in progress.tsx:325. Warnings include hook dependencies and unused values. This script scanned app and components; it is not a full service-layer lint audit.
- No native build, on-device walkthrough, live login, live AI request, or live database verification was performed. No runtime credentials were supplied for analysis. UI recommendations are based on source inspection, not screenshots.
- No application source was changed during this review. Added this report; dependency installation and lint generated local dependency/cache files.
