/* Offline S3 diagnostic on saved detections; no provider calls or ground-truth claims. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const folder = path.join(root, 'food_images');
const runId = process.argv[2] || '2026-10-29T14-32-10-853Z-01b24d';
if (!/^[\w-]+$/.test(runId)) throw new Error('Expected a saved run ID, not a path.');
const saved = path.join(folder, 'evaluation', 'runs', runId);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const index = read(path.join(folder, 'photo-index.json'));
const annotations = read(path.join(folder, 'photo-records.json'));
const manifest = read(path.join(saved, 'manifest.json'));

// Same in-memory TypeScript loading approach as evaluate-food.cjs.
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  return originalResolve.call(this, name.startsWith('@/') ? path.join(root, name.slice(2)) : name, parent, ...rest);
};
require.extensions['.ts'] = function (module, filename) {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(compiled.outputText, filename);
};
const { validatePortionSize } = require('../services/portionValidation.ts');
const { isBeverageName } = require('../services/foodNames.ts');

const photos = index.map(entry => {
  const imageHash = hash(fs.readFileSync(path.join(folder, entry.filename)));
  const recorded = manifest.photos.find(photo => photo.filename === entry.original_filename);
  if (imageHash !== entry.sha256 || recorded?.imageHash !== imageHash) {
    throw new Error(`Photo/hash mismatch for ${entry.id}; refusing mismatched evidence.`);
  }
  const resultPath = path.join(saved, `${entry.original_filename}.result.json`);
  const result = read(resultPath);
  if (!Array.isArray(result.data?.ingredients) || !result.data.ingredients.length) {
    throw new Error(`Missing saved ingredients for ${entry.id}.`);
  }
  const calls = read(path.join(saved, `${entry.original_filename}.vision.json`));
  const raw = calls.find(call => call.mode === 'analyze')?.result?.regions
    ?.flatMap(region => region.ingredients) || [];
  const components = result.data.ingredients.map(ingredient => {
    const before = ingredient.originalEstimate;
    if (!before || before.unit !== 'g' || !Number.isFinite(before.quantity) || before.quantity <= 0) {
      throw new Error(`Unsupported original estimate for ${entry.id}: ${ingredient.name}.`);
    }
    // Confirm originalEstimate against saved vision rather than assuming it is an S3 snapshot.
    const matches = raw.filter(item => item.name === ingredient.name);
    const vision = matches[0];
    const rawQuantity = vision?.amount ?? vision?.weight_grams;
    if (matches.length !== 1 || rawQuantity !== before.quantity || (vision.unit ?? 'g') !== before.unit) {
      throw new Error(`Cannot reconstruct unambiguous pre-check input for ${entry.id}: ${ingredient.name}.`);
    }
    const skipped = isBeverageName(ingredient.name);
    const region = result.data.regions?.[ingredient.regionIndex ?? 0];
    const checked = skipped ? null : validatePortionSize(ingredient.name, before.quantity, 'g', {
      representation: ingredient.representation,
      visibleCount: ingredient.visibleCount,
      visibleFraction: ingredient.visibleFraction,
      itemType: ingredient.itemType,
      servingConfirmationRequired: region?.servingConfirmationRequired && !region.servingConfirmed,
    });
    return {
      name: ingredient.name, visible_count: ingredient.visibleCount ?? null,
      representation: ingredient.representation, before_g: before.quantity,
      after_g: checked?.adjustedQuantity ?? before.quantity,
      changed: checked?.wasAdjusted ?? false, skipped,
      warning: checked?.warning ?? null, category: checked?.category ?? null,
      measured_g: null, before_error_g: null, after_error_g: null,
    };
  });
  return {
    id: entry.id, photo: entry.filename, image_hash: imageHash,
    source_result_hash: hash(fs.readFileSync(resultPath)),
    components, changed: components.filter(item => item.changed).length,
    warnings: components.filter(item => item.warning).length,
    known_failures: annotations.find(item => item.id === entry.id)?.known_failures || [],
  };
});
const components = photos.flatMap(photo => photo.components);
const report = {
  generated_at: new Date().toISOString(), kind: 'offline-portion-check-reconstruction',
  saved_run_id: runId, saved_provenance: manifest.provenance,
  current_source_hashes: Object.fromEntries(['services/portionValidation.ts', 'services/foodNames.ts'].map(file => [file, hash(fs.readFileSync(path.join(root, file)))])),
  index_hash: hash(fs.readFileSync(path.join(folder, 'photo-index.json'))),
  annotations_hash: hash(fs.readFileSync(path.join(folder, 'photo-records.json'))),
  provider_calls: 0, photos: photos.length, components: components.length,
  checked: components.filter(item => !item.skipped).length,
  changed: components.filter(item => item.changed).length,
  warning_count: components.filter(item => item.warning).length,
  photos_with_warnings: photos.filter(photo => photo.warnings > 0).length,
  weighed_photos: annotations.filter(item => item.weighed).length,
  lookup_isolation: { status: 'not_run', reason: 'No measured foods, grams or fixed-source calorie ground truth supplied.' },
  portion_accuracy: { status: 'unscored', reason: 'No measured component grams supplied.', before_mae_g: null, after_mae_g: null },
  calorie_accuracy: { mape_pct: null, bias_pct: null, mae_kcal: null, eligible: 0 },
  limitation: 'Current S3 replay on originalEstimate fields verified against saved raw vision; selected components only. No full pipeline or lookup rerun. Saved vision is historical, not a fresh scan. Warning counts do not establish warning correctness.',
  meals: photos,
};
const output = path.join(folder, 'evaluation', 'portion-check', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: path.relative(root, output), ...Object.fromEntries(Object.entries(report).filter(([key]) => !['meals', 'saved_provenance'].includes(key))), per_photo: photos.map(({ id, components, changed, warnings }) => ({ id, components: components.length, changed, warnings })) }, null, 2));
