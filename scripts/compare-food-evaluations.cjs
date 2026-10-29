/* Compare saved predictions only; never calls providers or treats missing nutrition as zero. */
/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const { hash } = require('./food-eval-reliability.cjs');
const root = path.resolve(__dirname, '..');
const folder = path.join(root, 'photo-food');
const evaluation = path.join(folder, 'evaluation');
const latestId = process.argv[2] || JSON.parse(fs.readFileSync(path.join(evaluation, 'latest.json'), 'utf8')).runId;
if (!/^[0-9TZ-]+-[a-f0-9]+$/.test(latestId)) throw new Error('Expected a saved evaluation run ID.');
const latest = path.join(evaluation, 'runs', latestId);
const previous = path.join(evaluation, 'runs', '2026-10-28T15-57-53-935Z-346091');
const beforeFix = path.join(evaluation, 'runs', '2026-10-28T17-55-45-925Z-fa5a76');
const first = path.join(evaluation, 'baselines', 'original');
const manifest = JSON.parse(fs.readFileSync(path.join(latest, 'manifest.json'), 'utf8'));
if (!manifest.completedAt) throw new Error('The fresh evaluation has not completed yet.');
const references = JSON.parse(fs.readFileSync(path.join(latest, 'reference.json'), 'utf8'));
const selected = new Set(manifest.photos.map(photo => photo.filename));
const labels = ['Cheesecake', 'Ramen', 'Tofu bowl', 'Buddha bowl', 'Ice cream', 'Breakfast', 'Salmon pan', 'Panzanella', 'Cocktail', 'Penne'];
const read = (directory, filename) => {
  const filenamePath = path.join(directory, `${filename}.result.json`);
  return fs.existsSync(filenamePath) ? JSON.parse(fs.readFileSync(filenamePath, 'utf8')) : null;
};
const known = item => item.nutritionStatus !== 'unresolved' && item.nutrition && item.source !== 'generic';
function stage(result, reference) {
  if (!result?.success || !result.data) return { success: false, error: result?.error || 'No successful prediction.', mass: null, massErrorPercent: null, calories: null };
  const data = result.data;
  const mass = data.ingredients.length > 0 && data.ingredients.every(item => item.unit === 'g')
    ? data.ingredients.reduce((sum, item) => sum + item.quantity, 0) : null;
  const parts = ['g', 'ml'].map(unit => {
    const amount = data.ingredients.filter(item => item.unit === unit).reduce((sum, item) => sum + item.quantity, 0);
    return amount ? `${Math.round(amount)} ${unit}` : '';
  }).filter(Boolean).join(' + ');
  return { success: true, amount: parts, mass,
    massErrorPercent: mass !== null && reference.weightGrams > 0 ? 100 * Math.abs(mass - reference.weightGrams) / reference.weightGrams : null,
    calories: data.ingredients.some(known) ? data.totalNutrition.calories : null,
    resolved: data.ingredients.filter(known).length, total: data.ingredients.length, nutritionStatus: data.nutritionStatus,
    dishes: data.regions.filter(region => region.selected !== false).map(region => region.dishName || region.description),
    ingredients: data.ingredients.map(item => ({ name: item.name, foodName: item.foodName, amount: item.quantity, unit: item.unit,
      uncertain: item.identityUncertain, nutritionIdentityKnown: item.nutritionIdentityKnown, alternatives: item.identityAlternatives,
      reference: item.nutrition?.foodName ?? null, referenceQuality: item.nutrition?.reference?.matchQuality,
      referenceReason: item.nutrition?.reference?.matchReason, reason: item.unresolvedReason ?? null, isAddedFat: item.isAddedFat ?? false })),
    regions: data.regions.filter(region => region.selected !== false).map(region => ({ fatAssessment: region.fatAssessment,
      fatEvidence: region.fatEvidence, servingConfirmationRequired: region.servingConfirmationRequired, reviewReasons: region.reviewReasons })),
  };
}
const rows = references.flatMap((reference, index) => selected.has(reference.filename) ? [{
  dish: labels[index] || reference.filename, filename: reference.filename, reference,
  first: stage(read(first, reference.filename), reference), previous: stage(read(previous, reference.filename), reference),
  beforeFix: stage(read(beforeFix, reference.filename), reference),
  latest: stage(read(latest, reference.filename), reference),
}] : []);
const summary = Object.fromEntries(['first', 'previous', 'beforeFix', 'latest'].map(key => {
  const eligible = rows.filter(row => row[key].massErrorPercent !== null);
  return [key, { successful: rows.filter(row => row[key].success).length, photos: rows.length,
    comparableMass: eligible.length, massWithin25: eligible.filter(row => row[key].massErrorPercent <= 25).length,
    meanMassErrorPercent: eligible.length ? eligible.reduce((sum, row) => sum + row[key].massErrorPercent, 0) / eligible.length : null }];
}));
const pairedRows = rows.filter(row => ['first', 'previous', 'beforeFix', 'latest'].every(key => row[key].massErrorPercent !== null));
const pairedSummary = Object.fromEntries(['first', 'previous', 'beforeFix', 'latest'].map(key => [key, {
  photos: pairedRows.length, within25: pairedRows.filter(row => row[key].massErrorPercent <= 25).length,
  meanMassErrorPercent: pairedRows.length ? pairedRows.reduce((sum, row) => sum + row[key].massErrorPercent, 0) / pairedRows.length : null,
}]));
const amountCell = item => item.success ? item.amount || 'Unknown' : 'Failed';
const kcalCell = item => item.calories === null ? 'Unknown' : `${Math.round(item.calories)}${item.nutritionStatus !== 'complete' ? ' subtotal' : ''}`;
const change = row => !row.latest.success ? 'Failed' : row.latest.massErrorPercent === null ? 'Units differ' :
  row.previous.massErrorPercent === null ? 'No comparison' : row.latest.massErrorPercent < row.previous.massErrorPercent ? 'Closer' :
    row.latest.massErrorPercent > row.previous.massErrorPercent ? 'Farther' : 'Same';
const lines = ['# Food-only progress comparison', '',
  `Run: ${latestId}. Kind: ${manifest.kind}. Model: ${manifest.provenance.vision.backend.modelDeployment}. Analyze-food version ${manifest.provenance.vision.deployment.version}; nutrition-lookup version ${manifest.provenance.nutrition.deployment.version}.`, '',
  `Vision requests: ${manifest.visionLiveCalls} live, ${manifest.visionCacheHits} cached. Nutrition reference source: ${manifest.provenance.nutrition.backend.referenceSource ?? 'live'}.`, '',
  'Standalone cocktail excluded. References are user estimates, not weighed ground truth. First = original validation; previous = phase 1–2; beforeFix = the phase 3–4 regression. Current failures and mixed units remain visible; they are not replaced by older successful results.', '',
  `Latest pipeline: ${summary.latest.successful}/${rows.length} successful results. On the ${pairedRows.length}-photo paired mass subset, mean absolute portion error is ${pairedSummary.latest.meanMassErrorPercent?.toFixed(1)}%, versus ${pairedSummary.previous.meanMassErrorPercent?.toFixed(1)}% for phase 1–2 and ${pairedSummary.beforeFix.meanMassErrorPercent?.toFixed(1)}% before this fix. A single run does not establish general accuracy or run-to-run stability.`, '',
  '| Dish | Reference | First | Phase 1–2 | Before fix | Latest | Latest vs phase 1–2 |',
  '|---|---:|---:|---:|---:|---:|---|',
  ...rows.map(row => `| ${row.dish} | ${row.reference.weightGrams} g | ${amountCell(row.first)} | ${amountCell(row.previous)} | ${amountCell(row.beforeFix)} | ${amountCell(row.latest)} | ${change(row)} |`), '',
  '| Stage | Successful pipeline results | Portions within ±25% | Mean absolute mass error |', '|---|---:|---:|---:|',
  ...Object.entries(summary).map(([key, value]) => `| ${key} | ${value.successful}/${value.photos} | ${value.massWithin25}/${value.comparableMass} comparable | ${value.meanMassErrorPercent === null ? 'Unknown' : value.meanMassErrorPercent.toFixed(1) + '%'} |`), '',
  'A successful result is not a correct food identification or a meal ready to save. Portion denominators exclude failed results and mixed mass/volume; compare their counts together. All-stage paired comparisons should use the same eligible photos.', '',
  `Paired mass subset (${pairedRows.length} photos comparable in every stage): ${Object.entries(pairedSummary).map(([key, value]) => key + ' ' + value.within25 + '/' + value.photos + ' within ±25%').join('; ')}.`, '',
  '| Dish | Reference kcal | First kcal | Phase 1–2 kcal | Before fix kcal | Latest kcal |', '|---|---:|---:|---:|---:|---:|',
  ...rows.map(row => `| ${row.dish} | ${row.reference.calories} | ${kcalCell(row.first)} | ${kcalCell(row.previous)} | ${kcalCell(row.beforeFix)} | ${kcalCell(row.latest)} |`), '',
  'First-run calories were unavailable because lookup rejected resolve mode. Subtotals include only matched ingredients and cannot be compared with complete-meal reference calories. Complete lookup status still does not prove correct record selection or food identity.', '',
  `Latest nutrition: ${rows.filter(row => row.latest.success && row.latest.nutritionStatus === 'complete').length} complete results; ${rows.filter(row => row.latest.success && row.latest.nutritionStatus !== 'complete').length} incomplete results. No full-meal calorie error is reported for incomplete predictions.`, '',
  '## Latest identity and review details', '',
  ...rows.flatMap(row => [`### ${row.dish}`, '', row.latest.success ?
    `Detected: ${row.latest.dishes.join('; ')}. Nutrition references: ${row.latest.resolved}/${row.latest.total} included ingredients.` : row.latest.error, '',
    ...(row.latest.ingredients || []).map(item => `- ${item.name}: ${item.amount} ${item.unit}; ${item.reference || 'unresolved: ' + item.reason}${item.referenceQuality === 'approximate' ? ' (ordinary compatible estimate)' : ''}${!item.reference && item.nutritionIdentityKnown === false ? '; identity/recipe needs confirmation' : ''}${item.alternatives?.length ? '; alternatives: ' + item.alternatives.join(' / ') : ''}.`),
    ...(row.latest.regions || []).filter(region => region.fatAssessment).map(region => `- Fat assessment: ${region.fatAssessment}. ${region.fatEvidence || ''}`), '']),
];
const comparison = { generatedAt: new Date().toISOString(), latestId, previousId: path.basename(previous),
  beforeFixId: path.basename(beforeFix),
  referenceHash: hash(fs.readFileSync(path.join(latest, 'reference.json'))), summary, pairedSummary, rows };
fs.writeFileSync(path.join(latest, 'comparison.json'), JSON.stringify(comparison, null, 2));
fs.writeFileSync(path.join(latest, 'comparison.md'), lines.join('\n'));
fs.writeFileSync(path.join(folder, 'food-only-progress-comparison.md'), lines.join('\n'));
console.log(JSON.stringify({ latestId, summary, rows: rows.map(row => ({ dish: row.dish, reference: row.reference.weightGrams,
  first: amountCell(row.first), previous: amountCell(row.previous), latest: amountCell(row.latest), change: change(row),
  beforeFix: amountCell(row.beforeFix),
  latestKcal: kcalCell(row.latest) })) }, null, 2));
