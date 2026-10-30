# Photo dataset

Evaluation uses the five definitions and counting rules in [METRICS.md](METRICS.md).
Stage-isolation protocols and failure codes are in [EXPERIMENTS.md](EXPERIMENTS.md).
Collection instructions and blank templates are linked from [weighed/README.md](weighed/README.md).

The ten original photos have permanent IDs `meal_001` through `meal_010`.
Their WebP bytes are preserved. Do not rename, replace, re-encode or reuse an
existing photo ID. Assign the next unused number to each new photo, regardless
of its format or subset; keep its actual file extension.

- `photo-records.json`: one annotation record per photo, using the requested schema.
- `photo-index.json`: permanent ID, current filename, original filename and SHA-256
  checksum. Original names connect the photos to historical evaluation outputs.
- `weighed/`: reserved for new photos with documented measured ground truth.

All current photos are unweighed. All `approx_grams` values are `null`: neither
the photos nor the saved model estimates supply measured ingredient weights.
Do not use visual estimates as ground truth or score calorie accuracy on this set.

Visible items are confidently recognizable foods. Broad names deliberately avoid
claiming an uncertain species or recipe. Uncertain entries must not count as
missed visible ingredients; separately track whether the app flags the ambiguity
or requests clarification. Exclusions describe objects and food outside the
chosen meal scope; counting them is a separate scope error. For meal_004 the
orange drink follows the existing evaluation's accompaniment exclusion policy.

Known failures are observations from the dated saved evaluations, not newly run
app results. Empty lists mean no outstanding specific failure was documented,
not a verified pass. Earlier sauce/fruit/casserole lookup gaps and the salad's
HTTP 503 are omitted because later reference-recovery/resilience replays recovered
them. See `ANALYSIS_VERDICT_2026-10-29.md`, `RERUN_COMPARISON_2026-10-29.md`,
`REFERENCE_RECOVERY_RESULTS_2026-10-29.md` and
`INGREDIENT_RESILIENCE_RESULTS_2026-10-29.md` for evidence and chronology.
Difficulty is a qualitative annotation of visual complexity and ambiguity.

For a new measured meal, put the original photo in `weighed/meal_NNN.ext` at
intake, add its index entry with `filename: "weighed/meal_NNN.ext"`, and add one
record with `weighed: true`. Document measured ingredient amounts, cooked/raw
state, recipe yield and consumed portion in `weighed/meal_NNN.ground-truth.json`,
including measurement provenance. Never substitute model estimates. If ground
truth is later collected for an existing photo, retain its ID and path and place
its measurement sidecar in `weighed/`; do not move or duplicate the photo.

`photo-records.json` is a manual evaluation baseline. It is deliberately separate
from the runner's legacy `annotations.json` format. The existing evaluation
runner scans only the top-level photos; evaluating the weighed subset will need
explicit runner support. Historical outputs under ignored `evaluation/` retain
their original names. The local ignored `reference.json` filename entries have
been migrated; future generated references use the new filenames.
