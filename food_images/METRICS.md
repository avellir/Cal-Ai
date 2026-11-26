# Food-photo evaluation metrics

Use these five metrics for every recorded run against `photo-records.json`.
Score each photo separately and retain the numerator and denominator beside
each rate. These are definitions for manual review; the current runner does not
automatically compute them from this annotation schema.

| Metric | Computation | Report |
|---|---|---|
| Visible-item recall | Correct annotated visible items found / total annotated visible items | Percentage and found/total; higher is better |
| False-item rate | Listed items confirmed absent from the selected meal / total listed items | Percentage and false/listed; lower is better |
| Background leakage | Number of annotated excluded items included as part of the meal | Count; lower is better |
| Uncertainty handling | For each uncertain entry: did the app explicitly flag that ambiguity or ask a relevant question? | Yes/no per entry; photo is yes only when every entry is handled |
| Calorie error (weighed meals only) | Signed relative error = (predicted kcal - actual kcal) / actual kcal; absolute error = abs(predicted kcal - actual kcal) | Signed percentage and absolute kcal; also retain absolute relative percentage |

## Counting rules

Evaluate the app result before manual correction, using the selected meal scope
and consumed portion. Record the run ID, photo ID, source result and annotation
revision so comparisons use the same inputs and labels.

Count distinct food items at the annotation's level of detail, accepting clear
synonyms and equivalent broad descriptions. Repeated mentions do not create new
items. For example, three eggs are one visible-item category; egg count and mass
are separate observations, not extra recall points. A broad dish name alone does
not demonstrate detection of every visible ingredient: count ingredients only
when the output explicitly identifies them. A wrong specific identity does not
match a broader visible item when it contradicts the evidence.

Recall is independent of nutrition lookup success: a correctly detected food
still counts when its reference is unresolved. Each visible entry can earn at
most one match. An omission on the uncertain list does not reduce visible recall.

For false-item rate, use distinct foods the app actually includes in the meal,
including assumed ingredients used in nutrition. Questions, explicitly excluded
regions and unselected alternatives do not count as included items. Absence from
the visible list alone is not proof an item is false. Review unannotated claims;
if their presence cannot be established, mark them indeterminate rather than
calling them correct or false. If an included claim remains indeterminate, report
the confirmed false count and listed count but leave the final false-item rate
unscored until reviewed. Uncertain ingredients explicitly presented as possible
and excluded from the nutrition estimate are not false positives.

Background leakage counts distinct excluded entries included as meal food or in
nutrition. Mentioning a fork or identifying a drink as excluded is not leakage.
A leaked food also counts as false for false-item rate; these measure related
errors and must not be added together into a combined score.

Uncertainty handling requires an item-specific caveat or clarification request.
A generic "this meal is an estimate" is insufficient. For an entry describing
an uncertain recipe or amount, an explicit statement that it cannot be confirmed
qualifies. Silence or a confident unsupported choice is no. With no uncertain
entries, report not applicable rather than yes.

## Missing data and summaries

Zero-denominator rates are not applicable. If the app returns a completed empty
food list, recall is zero when visible items exist, false-item rate is not
applicable, and leakage is zero. If analysis fails without an assessable result,
all five metrics are unscored; report the failure separately. Missing results or
labels never become passes.

Score calories only when `weighed` is true, documented actual calories are
positive and cover the same consumed portion, and the prediction is a complete
meal total with portion/structure review resolved. A subtotal or unavailable
prediction is unscored. Positive signed error means overestimation; negative
means underestimation. For example, 600 predicted versus 500 actual is +20%,
100 kcal absolute error, and 20% absolute relative error. Weighed mass alone does
not establish actual calories; documented recipe/nutrition evidence is required.

Across photos, sum eligible numerators and denominators for recall and false-item
rate. Report leakage as a total count with the number of scored photos.
Summarize uncertainty as yes/no photo counts, retaining entry-level judgments.
For eligible weighed meals, report mean signed relative error, mean absolute kcal
error and mean absolute relative error; signed errors can cancel. Always show
eligible, unscored and failed photo counts and the run's total photo count beside
summaries. Keep each repeated run separate; compare the same photo set and labels.

For `n` eligible weighed meals, name the calorie summaries consistently:

- MAPE (%) = `(100 / n) * sum(abs(predicted - actual) / actual)`.
- Bias (%) = `(100 / n) * sum((predicted - actual) / actual)`.
- Mean absolute error (kcal) = `sum(abs(predicted - actual)) / n`.

Positive bias indicates average overestimation; negative bias indicates average
underestimation. Report MAPE alongside bias because opposite signed errors can
cancel. These are equally weighted per meal; do not replace MAPE with error on
the sum of calories. With no eligible meals, report unavailable, never zero.
See [EXPERIMENTS.md](EXPERIMENTS.md) for stage attribution and gram diagnostics.
