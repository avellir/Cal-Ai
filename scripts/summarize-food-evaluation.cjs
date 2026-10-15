/* Summarize actual saved photo tests; missing nutrition is never counted as zero. */
const fs = require('node:fs');
const path = require('node:path');

const folder = path.resolve(process.argv[2] || 'photo-food');
const output = path.join(folder, 'evaluation');
const rows = JSON.parse(fs.readFileSync(path.join(output, 'results.json'), 'utf8'));
const auditPath = path.join(output, 'usda-visual-audit.json');
const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : {};
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const round = value => Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
const meals = rows.map((row, index) => {
  const resultPath = path.join(output, `${row.filename}.result.json`);
  const result = fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath, 'utf8')) : {};
  const cachePath = path.join(output, `${row.filename}.vision.json`);
  const calls = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : [];
  const lookups = calls.filter(call => call.mode === 'nutrition').flatMap(call => call.result);
  const ingredients = (result.data?.ingredients || []).map(ingredient => {
    const lookup = lookups.find(item => item.query === ingredient.name);
    return {
      name: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit,
      resolved: ingredient.nutritionStatus !== 'unresolved' && !!ingredient.nutrition,
      reference: ingredient.nutrition?.reference || null,
      nutrition: ingredient.scaledNutrition || null,
      reason: ingredient.unresolvedReason,
      candidates: lookup?.candidates?.map(candidate => ({ id: candidate.id, name: candidate.name })) || [],
    };
  });
  return {
    number: index + 1, filename: row.filename, success: result.success === true,
    name: result.data?.regions?.map(region => region.dishName || region.description).join(', ') || row.foods || row.filename,
    complete: result.data?.nutritionStatus === 'complete',
    estimatedGrams: ingredients.every(item => item.unit === 'g') && ingredients.length
      ? round(ingredients.reduce((sum, item) => sum + item.quantity, 0)) : null,
    knownNutrition: result.data?.totalNutrition || null,
    resolved: ingredients.filter(item => item.resolved).length,
    ingredients, warnings: result.data?.warnings || [], error: result.error || row.error,
    processingSeconds: round((result.metadata?.processingTimeMs || 0) / 1000),
    reviewNotes: audit.meals?.[row.filename] || [],
  };
});
const summary = {
  generatedAt: new Date().toISOString(), photos: meals.length,
  recognitionSucceeded: meals.filter(meal => meal.success).length,
  completeMeals: meals.filter(meal => meal.complete).length,
  matchedIngredients: meals.reduce((sum, meal) => sum + meal.resolved, 0),
  totalIngredients: meals.reduce((sum, meal) => sum + meal.ingredients.length, 0),
  measuredAccuracy: null,
  findings: audit.findings || [],
  limitation: 'No weighed portions or recipe nutrition supplied. These results measure lookup coverage and pipeline behavior, not numerical calorie or portion accuracy.',
  meals,
};
fs.writeFileSync(path.join(output, 'usda-review.json'), JSON.stringify(summary, null, 2));
const cards = meals.map(meal => `<article>
  <img src="../${encodeURIComponent(meal.filename)}" alt="Food test ${meal.number}">
  <div><h2>${meal.number}. ${escape(meal.name)}</h2>
  ${meal.reviewNotes.length ? `<p class="partial">Review: ${meal.reviewNotes.map(escape).join(' ')}</p>` : ''}
  <p class="${meal.complete ? 'complete' : 'partial'}">${meal.complete ? 'Complete nutrition' : meal.success ? 'Needs food matching — subtotal only' : 'Analysis failed'}</p>
  <p>Estimated amount: ${meal.estimatedGrams ?? 'unknown'} g · Matched: ${meal.resolved}/${meal.ingredients.length} foods · ${meal.processingSeconds} seconds</p>
  <p><strong>${round(meal.knownNutrition?.calories) ?? '—'} kcal ${meal.complete ? '' : 'known subtotal'}</strong> · Protein ${round(meal.knownNutrition?.protein) ?? '—'} g · Carbs ${round(meal.knownNutrition?.carbs) ?? '—'} g · Fat ${round(meal.knownNutrition?.fat) ?? '—'} g</p>
  ${meal.error ? `<p>${escape(meal.error)}</p>` : ''}
  <table><thead><tr><th>Detected food</th><th>Photo amount</th><th>USDA match / action needed</th><th>kcal</th></tr></thead><tbody>
  ${meal.ingredients.map(item => `<tr><td>${escape(item.name)}</td><td>${item.quantity} ${escape(item.unit)}</td><td>${item.reference
    ? `<a href="${escape(item.reference.sourceUrl)}">${escape(item.reference.name)}</a>${item.reference.recipeAverage ? ' (recipe average)' : ''}`
    : `${escape(item.reason)}${item.candidates.length ? `<details><summary>${item.candidates.length} choices available</summary>${item.candidates.map(candidate => `<p>${escape(candidate.name)}</p>`).join('')}</details>` : ''}`}</td><td>${item.nutrition ? round(item.nutrition.calories) : 'Unknown'}</td></tr>`).join('')}
  </tbody></table>${meal.warnings.length ? `<p class="note">${meal.warnings.map(escape).join('<br>')}</p>` : ''}</div></article>`).join('\n');
fs.writeFileSync(path.join(output, 'usda-review.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Cal AI — live USDA food tests</title>
<style>body{font:16px system-ui;background:#f5f6f8;color:#18202a;margin:0;padding:32px}main{max-width:1180px;margin:auto}h1{font-size:32px}h2{font-size:21px;margin-top:0}article{background:white;border:1px solid #dce1e8;border-radius:16px;padding:24px;margin:24px 0;display:grid;grid-template-columns:240px 1fr;gap:24px}img{width:100%;max-height:280px;object-fit:contain;border-radius:10px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}a{color:#175cc3}.partial{color:#8c4d00;font-weight:650}.complete{color:#12653c;font-weight:650}.note{font-size:14px;color:#536171}details{margin-top:8px}details p{margin:6px 0}@media(max-width:800px){body{padding:16px}article{grid-template-columns:1fr;padding:16px}img{max-height:240px}table{font-size:12px}}</style>
<main><h1>Live food analysis with USDA</h1><p>${summary.recognitionSucceeded}/${summary.photos} photos recognized · ${summary.matchedIngredients}/${summary.totalIngredients} ingredients matched automatically · ${summary.completeMeals}/${summary.photos} meals with complete nutrition.</p><p>${escape(summary.limitation)}</p><p>Automatic matches are selections made by the app, not a count of correct identifications. Incomplete meals show only nutrition from matched foods. Unknown entries are excluded and require correction before saving.</p>${summary.findings.length ? `<ul>${summary.findings.map(finding => `<li>${escape(finding)}</li>`).join('')}</ul>` : ''}${cards}</main></html>`);
console.log(JSON.stringify({ ...summary, meals: meals.map(({ ingredients, warnings, ...meal }) => ({
  ...meal, ingredientCount: ingredients.length,
  unresolved: ingredients.filter(item => !item.resolved).map(item => item.name),
})) }, null, 2));
