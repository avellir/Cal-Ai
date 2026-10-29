# Ingredient failure isolation and bounded retries

Implemented and deployed `ingredient-failures-v1` to the Supabase `nutrition-lookup` function on 2026-10-29. FatSecret remains the only automatic nutrition provider. Serving-reference recovery remains enabled.

## Behavior

- A search, selector or detail failure affects its ingredient. Healthy matches and their authoritative nutrition remain available. Failed entries keep their query, candidates, safe reason, failure stage, error category, retryability and attempt count.
- A malformed, missing, duplicate or invented selector row affects that row. A failed selector request affects its chunk; other chunks commit healthy details independently.
- Temporary operations receive at most two retries (three total attempts), sharing a ceiling of six extra attempts for the meal. Backoff, provider Retry-After, attempt timeouts and the sixty-second request deadline bound the work. Cancellation stops retries.
- Authentication, IP restrictions, permission errors, exhausted application quota, malformed responses and real no-match results do not receive temporary-error retries. OAuth 2.0 retains its existing single expired-token refresh. OAuth 1.0 signs every retry with a fresh nonce.
- Resolve preserves input order and duplicate ingredient names. Partial service failures return HTTP 200 with per-ingredient failures and `partial: true`. Invalid requests and unauthenticated users still receive HTTP errors.
- The app retains successful nutrition and marks its total incomplete when another ingredient remains unresolved. Failed ingredient nutrition stays null; it is not replaced with fabricated zeros. Failure results are not cached.

## Verification

325 tests passed across 32 suites. TypeScript and ESLint for the affected files passed. Deterministic tests inject failures locally; the production service was not intentionally disrupted.

| Injected condition | Verified result |
|---|---|
| One ingredient search fails | Healthy ingredient remains matched |
| One selected food detail fails | Healthy authoritative nutrition remains; failed food keeps candidates |
| Detail service repeatedly returns HTTP 503 | Three total attempts; healthy nutrition survives exhaustion |
| Temporary selector HTTP 503 followed by success | Recovery without repeating successful ingredient searches |
| Malformed, duplicate or missing selector row | Valid rows survive; only affected rows fail |
| One selector chunk stalls until deadline | Another chunk's completed nutrition survives |
| Alternative search fails | Previously selected foods remain intact |
| Later request after a failed detail | Food can recover; failed result was not cached |
| Authentication or application quota error | No transient retry loop |
| Transport ignores cancellation | Per-attempt timeout still completes; no hanging retry loop |
| One meal operation exhausts retries | Shared retry budget limits total extra attempts |
| Partial response reaches app orchestration | Healthy subtotal retained; failed ingredient and meal remain incomplete |

The authenticated live deployment check passed using OAuth 1.0, GPT-5 Mini selection and a real FatSecret buckwheat reference. Metadata confirmed `serving-details-v2` and `ingredient-failures-v1`.

## Controlled live replay

The same ten saved detections, food contexts and portions from the prior evaluation were replayed through the deployed nutrition function. All ten request payloads match the previous priority-one replay. No vision requests were made and no meals were saved.

| Measure | Previous reference-recovery deployment | With ingredient resilience |
|---|---:|---:|
| Requests completed | 10/10 | 10/10 |
| Ingredients matched | 43/44 | 43/44 |
| Meals with complete reference coverage | 9/10 | 9/10 |

The ambiguous shrimp/fish sushi roll remains unresolved for identity confirmation. Salad and broccoli casserole both completed. This live replay checks normal operation and retained reference coverage; injected local cases verify failure behavior. Reference coverage does not establish measured portion or calorie accuracy, and selector choices can vary between runs.

- [Previous replay](evaluation/reference-recovery/2026-10-29T16-09-42-184Z-after/results.json)
- [Current replay](evaluation/reference-recovery/2026-10-29T16-37-18-782Z-after/results.json)
- [Current provenance](evaluation/reference-recovery/2026-10-29T16-37-18-782Z-after/manifest.json)
- [Live deployment check](evaluation/ingredient-resilience/live-check.json)
- [Retry and response contract](../supabase/NUTRITION_SETUP.md)

No secrets, schema changes or meal recalculation are required. The backend function is deployed; updated client response validation and timeout are in the workspace for the next app build.
