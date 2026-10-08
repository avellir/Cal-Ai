# Daily tracking implementation plan

Prepared October 1, 2026 against the current app. This plan narrows `PRODUCTION_PLAN.md` to the meal diary. Changes 1 and 2 are implemented; the remaining contracts and flows below describe future work.

## Implementation status: changes 1 and 2

- The home diary filters totals and its complete meal list by the selected local date. Selection uses calendar keys, follows today across midnight/foreground refresh, and keeps explicit historical dates. Goals update reactively; no-goal intake, over-target values, loading, failed-load retry, and empty-day states are distinct.
- `MealEditor` and `MealTypePicker` provide shared name, base nutrition, custom/preset portion, type, and local date/time controls with inline validation and a scaled preview. Scan review exposes **Edit meal details**. Applying changes updates review; cancelling preserves the last applied values.
- Camera carries the diary date into an account-scoped in-memory draft and navigates by draft ID. The original canonical analysis stays intact and nutrition overrides are marked separately. Legacy result parameters remain supported. Sign-out/account changes clear drafts; session refresh preserves them.
- Saving edited scans uses the existing service with base nutrition plus quantity, meal type, and `logged_at`; no migration is needed for these fields. Successful saves return to the meal's chosen day. Failed saves keep the in-memory draft.
- Durable drafts, atomic/idempotent persistence, a standalone manual-entry route, and editing already saved meals remain in Changes 3–6. Current drafts do **not** survive restarting the app; local draft IDs are not server idempotency keys.

Validation: 85 Jest tests pass, TypeScript passes, changed files pass ESLint, and the iOS JavaScript/assets export succeeds. Browser checks with isolated fixtures verified selected-day meals/totals, reactive targets, intake without goals, required/invalid inputs, edited portions, cancellation, and return to the chosen date after a simulated save. A live Supabase save and physical-device keyboard/midnight checks still require verification. App/components lint retains 58 errors and 4 warnings in unrelated files.

## Intended result

Users can select a day, see its meals and calories/macros, add a meal manually or from a scan, choose its type and time, correct it, and save changes that survive restarting the app. Failed saves preserve their work; retrying an ambiguous save does not create another meal. Photo failure does not erase a saved meal.

Build this as seven reviewable changes. Start with the selected-day fix, which needs no schema change. Plan for roughly **12-18 engineering days**, excluding recovery of the missing backend schema and deployment access. The first usable manual-entry flow should arrive before full ingredient editing and photo recovery.

## Product decisions for this implementation

- Keep the existing visual design, shared `Text`, theme tokens, `Card`, and `Chip` components.
- The diary opens on today. Tapping another day changes both totals and meals. Adding a meal from that day carries the selected date through manual entry, camera, and review; meal date/type remain editable before saving.
- Use UTC timestamps in persistence and current device timezone for day boundaries and display. A local day runs from local midnight to the following local midnight, not a fixed 24-hour duration. Apply this policy consistently to diary, history, and progress; travel can change the displayed day of an existing timestamp.
- Show calories/macros consumed, and an explicit remaining/over-target value. Users without goals still see their intake. Subscribe to goal values so changing a goal updates the screen without an unrelated meal fetch.
- For the initial diary, compare against the current target and label it accordingly on past days. Historical targets require effective-dated goal history; do not imply today's goals were the goals used last month. Add historical targets separately if that comparison becomes a product requirement.
- Manual entry accepts name, calories, protein, carbs, fat, portion, meal type, and date/time. All nutrition fields must contain a valid number, including explicit zero; empty fields are not silently saved as zero. Defaults are one portion and a visible, editable meal type.
- Offline work is a saved draft with explicit retry. It is shown separately from confirmed diary meals and excluded from confirmed totals until the server acknowledges the save.

## Shared data contract

Extend `lib/meal-log-types.ts` rather than creating screen-specific meal shapes:

| Contract | Proposed changes |
| --- | --- |
| `AddMealInput` | Add `loggedAt` (UTC ISO), stable `clientOperationId`, and optional correction/provenance payload. Preserve nutrition for **one base serving** and `quantity` as its multiplier. |
| `MealLogEntry` | Retain scaled display totals, but also expose base nutrition, quantity, editable name/type/time, revision, photo storage path/state, and optional analysis/provenance. Separate durable storage paths from expiring signed URLs. |
| `UpdateMealInput` | Identify the meal and expected revision; supply edited base nutrition, quantity, metadata, and a stable operation ID for this edit. |
| `MealDraft` | A versioned, user-scoped local record containing draft ID, operation ID, inputs, optional original/current canonical analysis, photo reference, and save status. Create an ID once per logical operation, not on every retry. |

Keep `AdvancedAnalysisResult` as the source of truth for scanned meals. Manual meals use the meal input contract; do not fabricate an AI result or confidence for them. Original analysis and subsequent user corrections are stored separately.

Scaling rule: `scaled nutrition = base nutrition * quantity`, once. Preserve base precision. Round calories once after portion scaling to retain the existing diary/test convention; preserve macro precision until display. If users edit totals for the selected portion, convert them back to base nutrition before saving. Never submit those totals plus the same multiplier.

## Change 1: selected-day totals and diary contents

Estimate: 1-2 days. No backend changes required.

Files: `services/nutritionAggregation.ts`, `app/(app)/(tabs)/index.tsx`, and new date helpers outside `app/`.

- Replace the hardcoded today predicate with date-aware helpers and a selected-date argument, keeping a today default for existing callers if useful.
- Derive selected-day meals once and use them for both totals and the home meal list. Keep history navigation available for the complete list.
- Replace the selected array index as the durable selection with a date key; rebuild recent dates at midnight and on foregrounding. Follow the new today if today was selected; preserve an explicitly selected historical day.
- Subscribe to `goals` or selected target values rather than only stable store getter functions. Render intake even when targets are absent.
- Display distinct loading, empty, and failed-load states. Add retry using the existing fetch service. Remove or compute the hardcoded streak.

Acceptance: with meals of 400 kcal today and 600 kcal yesterday, switching days shows 400 and 600 respectively and the corresponding meals. A goal update changes remaining calories immediately. An empty day differs visibly from a failed request.

Tests: selected dates, midnight boundaries, timezone/DST behavior, no-goal intake, and target changes. Reuse existing stored data for this first change.

## Change 2: shared editor and validation contracts

Estimate: 1 day. Depends on Change 1's date semantics.

Proposed files: `components/meal-log/MealEditor.tsx`, `MealTypePicker.tsx`, `lib/meal-draft-types.ts`, and `services/mealValidation.ts`; extend existing meal types and `services/foodAnalysis.ts`.

- Build one form for name, base nutrition, portion, type, and date/time. Keep rendering in components and validation/conversion in services.
- Validate trimmed name, finite/nonnegative calories/macros, positive finite quantity, and valid date/type. Handle decimal input consistently; do not silently clamp user input.
- Add optional date/type metadata to the analysis-to-meal mapper. Represent final total overrides explicitly so ingredient-derived totals and manually overridden totals cannot silently disagree.
- Introduce account-scoped draft IDs and preserve original/current analysis. Use draft IDs for new editor navigation, with compatibility handling for the existing scan-result route during migration.

Acceptance: the same values and validation apply whether a meal started from a scan or manual entry. Portion presets and labeled `g`/`ml`/`serving` values preserve their meaning.

## Change 3: transactional, repeatable saves and account-safe state

Estimate: 2-3 days after schema confirmation. This is the backend dependency for reliable create/edit/retry.

Files: `services/mealLog.ts`, `lib/meal-log-store.ts`, `lib/session-store.ts`, new timestamped migrations, and `supabase/README.md`.

- Recover/inspect the actual `profiles`, `food_items`, `logged_meals`, and `meal_entries` schema, ownership relationships, constraints, and cascade behavior. Check existing records before changing profile or food ownership. Do not reset the current database.
- Add a create RPC that saves food/meal/entry data atomically and derives ownership from `auth.uid()`. Enforce a unique caller/operation key; simultaneous duplicates must produce one meal. If the same key arrives with a different payload, return an explicit conflict rather than silently applying different data.
- Persist `loggedAt`, meal type, correction data, revision, and optional photo state. Use caller privileges/RLS where possible and explicitly restrict RPC execution. Supabase supports remotely callable [database functions](https://supabase.com/docs/guides/database/functions).
- Add transactional update/delete operations with ownership checks. Use revisions to reject concurrent stale edits; after a lost response, an edit retry must resolve to the committed result before checking the old expected revision.
- Add `updateMeal` to the store; replace entries by ID after success. Deduplicate creates returned by retries, and prevent late fetches from overwriting newer writes. On failure keep the last confirmed data and expose the error.
- Scope meal caches/drafts to the authenticated user; clear rendered data on identity change and discard stale responses. A signed-out user cannot edit or retry another account's draft.

Acceptance: retry, double tap, concurrent duplicate request, and response loss create one complete meal. A failed transaction leaves no partial food/meal/entry data. A stale edit produces a recoverable conflict. User B cannot access user A's data.

Tests: database transaction rollback, duplicate/ambiguous writes, edit conflicts and retries, two-user RLS/RPC isolation, store races, and existing 0.5x/1x/1.5x/2x save/reload regressions. Mock tests do not replace real database tests.

## Change 4: manual logging, meal type, and backdating

Estimate: 2 days. Depends on Changes 2-3 for the complete persisted flow.

Files: home, camera/result routes, `app/(app)/_layout.tsx`, and proposed `app/(app)/meal-entry.tsx`.

- Change Log meal to offer Scan meal and Enter manually. Carry the selected day into either path.
- Wire manual entry to the shared editor, with inline errors and a single saving state.
- Add date/time and breakfast/lunch/dinner/snack controls to scan review. Avoid converting an explicitly chosen day back to today during navigation.
- After save, return to the relevant diary day and show the confirmed meal. Editing the date can move a meal to another day; refresh both affected days.

Acceptance: enter yesterday's 500-kcal lunch, save, restart, and find it under yesterday/lunch with matching totals. Manual entry works when analysis is unavailable. A 2x scanned portion remains scaled once.

## Change 5: saved-meal and ingredient corrections

Estimate: 2-3 days. Depends on Changes 2-4.

Files: `app/(app)/meal-history.tsx`, the shared editor, `app/(app)/food-result.tsx`, and proposed `services/mealCorrections.ts`.

- Add Edit to meal history and open the existing meal by ID. Support name, amount, calories/macros, type, and date/time changes with cancel/discard handling.
- For scans, support ingredient quantity changes, removal, addition, and identity correction. Recalculate through a pure service into the canonical result. Keep the whole-meal multiplier separate from ingredient amounts.
- Identity changes trigger the current nutrition lookup; keep generic/approximate warnings visible. Allow explicit nutrition correction when the reference is unsuitable, and record its source as user-entered. Renaming an ingredient must not retain an unrelated food match unnoticed.
- Store original estimate, edited analysis, total overrides, and correction provenance. Do not present the original confidence as confidence in user-entered nutrition.
- Older meals contain mostly aggregate nutrition: make their totals editable without inventing ingredient lists or original analyses.

Acceptance: correcting chicken quantity updates the meal and daily total after reload; adding sauce persists; moving a saved meal updates both days; canceled edits change nothing; an old aggregate-only meal remains editable.

Tests: correction totals, base/portion scaling, source/warning preservation, route/draft lookup, legacy compatibility, and revision conflicts.

## Change 6: durable drafts, photo recovery, and bounded reads

Estimate: 2-3 days. Depends on Change 3.

Files: meal store/services, `services/mealPhotoStorage.ts`, new draft persistence helpers, and history/progress screens.

- Save drafts per account before a write. On failure or restart, restore the form with the same operation ID. Treat uncertain writes as requiring reconciliation; avoid blindly issuing a fresh create.
- Persist nutrition before uploading its photo. Track pending/uploaded/failed state and offer Retry photo on the saved meal; retry never re-saves the meal. Copy photos into durable app storage when restart recovery is needed, and clean files after completion/discard.
- Match replacement uploads to user-scoped storage policies. Supabase requires SELECT and UPDATE for [upsert replacements](https://supabase.com/docs/guides/storage/security/access-control). Resolve expired signed URLs and fall back when cached local files disappear.
- Fetch the diary's visible date range; paginate history with stable `(logged_at, id)` ordering. Fetch progress's requested range separately. Maintain range-specific loading/error/completeness metadata and merge by meal ID so partial diary loads cannot erase progress/history data. Server-backed search/filtering must not imply a partial page is the entire history.

Acceptance: failed saving restores after restart; response-loss retry returns the existing meal; failed photo upload remains retryable without changing nutrition; signed-URL expiry recovers; diary, history, and progress remain correct with paged data.

## Change 7: end-to-end verification and delivery

Estimate: 1-2 days. Depends on the preceding changes.

- Run focused tests throughout implementation; run all Jest tests and TypeScript at integration. Verify lint for changed files and report the pre-existing full-project lint failures separately; do not disable rules to make the report green.
- Test the installed app against staging with real email authentication. Cover today/yesterday, manual/scan, edit/delete, fraction portions, offline save, restart, photo retry, account switch, midnight/foreground, and a large diary.
- Check accessibility labels, keyboard avoidance, decimal input, text scaling, and save feedback. Record screenshots of diary, entry, edit, and failure/retry states.
- Apply schema changes in staging first; verify legacy clients/data remain readable. Switch persistence to the RPC only when the migration is deployed. Document migration and rollback steps.

Done means the same confirmed nutrition is shown in review, diary, history, and progress after reload; saved edits survive restart; retries do not duplicate meals; account switching cannot expose old data; and failure states preserve a recoverable draft.

## Immediate next change

Changes 1 and 2 are complete. Next implement **Change 3: transactional, repeatable saves and account-safe state**, beginning with recovery/verification of the core backend schema. Then connect standalone manual entry and saved-meal editing to the shared editor.

Goal/weight recalculation, reminders, theme settings, subscriptions, external nutrition-provider replacement, and historical target history stay in their respective production-roadmap tasks. They do not need to block the first selected-day diary fix.
