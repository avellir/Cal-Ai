# Food analysis recheck - 29 October 2026

**Later update:** The OAuth 1.0 credentials resolved the authentication blocker. The subsequent live benchmark completed all nine photos and matched 34/42 ingredients. See [the successful FatSecret verification and comparison](FATSECRET_LIVE_RESULTS_2026-10-29.md). The failed attempts below are retained as historical evidence.

FatSecret is the deployed nutrition provider, but both live checks still fail at OAuth authentication. The fresh benchmark stopped at preflight; no food photos were evaluated and there are no new calorie, macro, or portion-accuracy results.

## Yesterday's recap

The original scripts/SESSION_RECAP_2026-10-29.md is absent from this worktree. Its content was recovered from the 28 October session record and checked against the saved comparison artifacts. It recorded restored gram-based portions and ordinary compatible references, Terra for vision, Mini for nutrition selection, a failing live nutrition provider, and a Foundation experiment that matched 15/43 ingredients with 0/9 complete meals. The old catalog-expansion plan has since been superseded by the requested FatSecret-only integration.

## Tests rerun

- node scripts/check-nutrition-deployment.cjs: failed with HTTP 503; FatSecret rejected the OAuth 2.0 client credentials (invalid_client).
- npm run evaluate:food -- --fresh --exclude=no-revisions-gA81ZTsql68-unsplash.jpg: failed at the three-food nutrition preflight with the same authentication error, before any photo request.
- npm test -- --runInBand: 264 tests passed across 26 suites.
- npm run typecheck: passed.

Current run: 2026-10-29T13-25-48-804Z-eb95ef. Previous completed run: 2026-10-28T22-07-24-070Z-71ac87. The latest.json pointer and prior results were preserved. Current metadata: fatsecret-reference-v1, referenceSource=fatsecret, configured=true. Configured checks presence, not credential validity.

## Comparison on the same nine food photos

| Stage | Photos processed | Portions within +/-25% | Mean absolute portion error | Ingredients matched | Complete nutrition |
|---|---:|---:|---:|---:|---:|
| Initial validation | 9/9 | 6/9 | 47.3% | 0/62 | 0/9 |
| Phase 1-2 | 9/9 | 8/9 | 11.4% | 36/37 | 8/9 |
| Restored Mini | 9/9 | 7/9 | 16.6% | 41/42 | 8/9 |
| Yesterday: Terra + Foundation | 9/9 | 7/9 | 17.0% | 15/43 | 0/9 |
| Today: FatSecret | Not run; authentication blocked | Unmeasured | Unmeasured | Unmeasured | Unmeasured |

Complete nutrition means that all included ingredients have nutrition references. It does not mean correct food identity or that portion/structure review is finished. References are user estimates rather than weighed ground truth; these errors measure agreement with those estimates. Historical stages used different detections and providers, so their coverage changes are not a controlled estimate of provider quality.

| Dish | User target | Initial validation | Phase 1-2 | Yesterday | Today |
|---|---:|---:|---:|---:|---|
| Cheesecake | 230 g | 412 g | 240 g | 256 g | Blocked before photo analysis |
| Ramen | 695 g | 567 g | 650 g | 550 g | Blocked before photo analysis |
| Tofu bowl | 435 g | 525 g | 595 g | 558 g | Blocked before photo analysis |
| Buddha bowl | 580 g | 595 g | 525 g | 645 g | Blocked before photo analysis |
| Ice cream | 165 g | 205 g | 175 g | 235 g | Blocked before photo analysis |
| Breakfast | 125 g | 406 g | 133 g | 143 g | Blocked before photo analysis |
| Salmon pan | 640 g | 535 g | 558 g | 775 g | Blocked before photo analysis |
| Panzanella | 470 g | 650 g | 560 g | 483 g | Blocked before photo analysis |
| Penne | 325 g | 330 g | 320 g | 324 g | Blocked before photo analysis |

## Comparison with requirement 1

No item explicitly named requirement 1 was found in the recap or current project documents. The table uses the original photo-food reference targets, and includes phase 1-2 as a separate historical comparator. Confirmation of the intended requirement is pending; no pass/fail claim is made for an unidentified requirement. Today's failed preflight cannot establish improved recognition, portion estimation, or nutrition accuracy.

## Remaining blocker

Supabase project lgozuyqviyhvcydyajzw shows both FatSecret secrets present, but their fingerprints are unchanged from the previous failed check. FATSECRET_CLIENT_ID was last updated at 2026-10-29 12:26:55 UTC; FATSECRET_CLIENT_SECRET at 2026-10-29 12:26:21 UTC. No credential or fingerprint is included in this report. USDA_API_KEY remains absent.

Update the matching OAuth 2.0 client ID and secret in this project's Edge Function Secrets, verify the FatSecret server-IP restrictions, and rerun the live preflight. To isolate the nutrition-provider effect once authentication works, reuse yesterday's saved Terra responses for one nutrition-only comparison, then run fresh vision separately. Do not treat the stopped benchmark as nine wrong photo predictions.

## Evidence

- [Failed current preflight](../photo-food/evaluation/runs/2026-10-29T13-25-48-804Z-eb95ef/fatsecret-live-preflight.json)
- [Current manifest](../photo-food/evaluation/runs/2026-10-29T13-25-48-804Z-eb95ef/manifest.json)
- [Yesterday's Foundation comparison](../photo-food/evaluation/runs/2026-10-28T22-07-24-070Z-71ac87/foundation-comparison.md)
- [Yesterday's detailed comparison](../photo-food/evaluation/runs/2026-10-28T22-07-24-070Z-71ac87/comparison.md)
