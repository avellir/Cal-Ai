# Implementation: reliable evaluation, counts and scope

## Tasks

- [x] E1 Preserve existing evaluation output and write isolated, reproducible runs.
- [x] E2 Key vision and nutrition caches by image/request, local function source, and deployed function version; record model metadata.
- [x] E3 Report mass/volume, nutrition coverage, and annotated identity/count/scope checks separately. Missing annotations remain unscored.
- [x] C1 Add validated scope, count, item type, visible fraction, whole/component representation and serving-review fields; preserve legacy parsing.
- [x] C2 Select the main dish by default, retain optional detections for region selection, and require explicit review of shared pans and structural contradictions.
- [x] C3 Preserve metadata and original estimates through deduplication, correction, draft serialization and saving; run regression tests and live verification.

Verification and remaining model errors are recorded in [the results](FOOD_ANALYSIS_PHASE_1_2_RESULTS.md). Completed tasks describe the implemented behavior; they do not imply that every photo estimate is accurate.

## Boundaries

This increment retains the existing gram-based vision contract. End-to-end ml nutrition support, lookup identity improvements and a full warning redesign follow separately. Count/fraction metadata explains an already-totaled edible weight; the client never multiplies that weight by count again or assigns benchmark weights to a photo.

The ten available photos form the regression set. A separate holdout folder/reference format is supported; new independent photos and weighed ground truth must be supplied before holdout accuracy can be measured. Evaluation distinguishes cached pipeline reprocessing from fresh vision measurements.
