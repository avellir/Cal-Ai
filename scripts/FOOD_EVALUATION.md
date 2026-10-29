# Reliable food evaluation

Configure a Cal AI test account with `FOOD_EVAL_EMAIL` in local `.env`, separate from the Supabase dashboard login. Password accounts may set `FOOD_EVAL_PASSWORD`; otherwise run interactively and paste the unused emailed sign-in link/code into the terminal, or use `--browser-auth` for the temporary loopback page. Do not share credentials or email links in chat. `--signup` explicitly permits creating the specified test account. Supabase URL/key load from `.env`, then `app.json` extra. Requests incur normal provider usage; the evaluator saves no meals. `--prepare` creates the reference template without contacting providers.

Run from the repository root after `npx supabase login`:

```powershell
npm run evaluate:food -- --fresh
npm run evaluate:food -- --replay
```

`--fresh` makes new vision and nutrition requests. The default command reuses only caches matching the exact request/image, local edge-function source, deployed function version, and current model metadata. `--replay` uses the latest recorded deployment/model provenance without network access; changed local edge-function code invalidates its caches. Replays test client parsing, scope selection and scaling, not current vision accuracy. `--replay-legacy` explicitly reads the original unversioned predictions and marks the run as historical. Missing nutrition cache is an evaluation failure, not a zero-calorie result.

The runner snapshots existing top-level output into `evaluation/baselines/original/` once. Each new run has its own `evaluation/runs/<timestamp-id>/` folder containing results, a reference snapshot, annotation snapshot, request results, image hashes, local pipeline hash, deployment versions, model name, cache counts and run kind. `evaluation/latest.json` points to the latest non-legacy completed run. `node scripts/summarize-food-evaluation.cjs` reads that run. Original top-level files are not overwritten.

The model metadata endpoint authenticates through Supabase Auth and makes no Azure call. Fresh requests are spaced to respect the function's burst limit. Changing Azure model settings during a run fails that run; a subsequent run obtains new model metadata. Deploy the matching `analyze-food` code before evaluating a changed prompt/schema. Source hashes in a manifest describe local code; the separately recorded deployed version/bundle hash describes the server. They are not asserted to be identical hashes.

Nutrition requests use FatSecret. Optional `--nutrition-source=fatsecret` selects the same provider explicitly. The evaluator requires matching deployed provider metadata and configured credentials before running live tests. Deploy the complete `supabase/functions/nutrition-lookup/` directory after changing the provider. See `supabase/NUTRITION_SETUP.md`.

## References and annotations

Use `--only=<filename>` for a focused diagnostic run, or repeat `--exclude=<filename>` to omit images from a run without deleting them. The final food-only benchmark uses `--exclude=no-revisions-gA81ZTsql68-unsplash.jpg`. Exclusions are recorded in its manifest. Compare a completed run with the original and phase 1–2 snapshots using `node scripts/compare-food-evaluations.cjs <run-id>`; this reads saved artifacts and makes no provider calls.

Provide photos plus `reference.json` in any folder, then use `npm run evaluate:food -- path/to/folder --fresh`. A separate holdout folder uses the same format and independent images. The runner cannot create independent ground truth from the regression photos.

Reference rows retain `filename`, `expectedFoods`, `weightGrams`, `calories`, `protein`, `carbs`, and `fat`; `volumeMl` is optional. References are user estimates unless explicitly measured. A plate mass comparison requires all selected quantities to be grams; a beverage volume comparison requires all quantities to be ml. Mixed units are unscored rather than added together.

Add `annotations.json` in the photo folder for manually reviewed identity/count/scope cases. Otherwise the named regression annotations in `scripts/food-eval-regression-annotations.json` apply to matching filenames. Example:

```json
{
  "version": 1,
  "photos": {
    "bowl.jpg": {
      "dishAliases": [["tofu bowl", "grain bowl"]],
      "ingredients": [
        {"aliases": ["quail egg", "quail eggs"], "visibleCount": 2, "visibleFraction": 1, "itemType": "quail egg"}
      ],
      "scope": [{"aliases": ["tea"], "included": false}],
      "unexpectedWarningPatterns": ["penne: 200.0g is outside"]
    }
  }
}
```

Aliases use exact normalized words, not fuzzy substring similarity. A missed alias can require human review; automated identity scores are not authoritative semantic judgments. Missing annotations produce `null` metrics, not passes. Count checks combine disjoint detections; fraction checks apply to each identified item. Unknown identities remain reviewable and do not count as correct automated classifications.

Per-photo `metrics` separates dish identity, annotated ingredients/counts/fractions/types, region inclusion, mass error, volume error, unwanted warnings, and nutrition resolution coverage. Complete-meal calorie errors require complete nutrition and no pending portion/structure review. Unresolved foods remain excluded from the known subtotal. Check coverage and individual errors alongside any aggregate error.
