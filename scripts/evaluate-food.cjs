/* Batch runner: reuse app services, replacing only the native photo transport. */
/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { AsyncLocalStorage } = require('node:async_hooks');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
const { authenticateInteractive, verifyEmailInput } = require('./food-eval-auth.cjs');
const { authenticateInBrowser } = require('./food-eval-browser-auth.cjs');
const { lookupNutrition } = require('./food-eval-nutrition.cjs');
const { hash, cacheKey, deploymentVersions, evaluationMetrics } = require('./food-eval-reliability.cjs');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const nutritionReferenceSource = args.find(arg => arg.startsWith('--nutrition-source='))?.split('=')[1];
if (nutritionReferenceSource && nutritionReferenceSource !== 'fatsecret') {
  throw new Error('Nutrition source must be fatsecret.');
}
const folder = path.resolve(root, args.find(arg => !arg.startsWith('--')) || 'photo-food');
const evaluationRoot = path.join(folder, 'evaluation');
let output;
let provenance;
let manifest;
let lastVisionRequest = 0;
const context = new AsyncLocalStorage();
let client;

// Load local configuration without displaying credentials.
if (fs.existsSync(path.join(root, '.env'))) {
  for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}

async function runPhotoAnalysis(request) {
  const state = context.getStore();
  const key = cacheKey(request, { imageHash: state.imageHash, ...provenance.vision });
  const cached = state.previous.find(item => item.key === key) ?? (args.includes('--replay-legacy') ? state.previous.find(item => item.mode === request.mode && item.dishLabel === request.dishLabel) : undefined);
  if (cached) {
    manifest.visionCacheHits++;
    state.calls.push(cached);
    return JSON.stringify(cached.result);
  }
  if (isReplay()) throw new Error('Missing matching vision cache for this image, request, source or deployment version. Run a live evaluation.');
  // The authenticated edge function permits six requests per minute, including metadata.
  const delay = Math.max(0, 11000 - (Date.now() - lastVisionRequest));
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  lastVisionRequest = Date.now();
  const { data, error } = await client.functions.invoke('analyze-food', {
    body: request,
    signal: AbortSignal.timeout(100000),
  });
  if (error || !data?.result) {
    const detail = error?.context && typeof error.context.json === 'function' ? await error.context.json().catch(() => null) : null;
    throw new Error(`Photo analysis failed${error?.context?.status ? ` (HTTP ${error.context.status})` : ''}: ${detail?.error || error?.message || 'Missing result.'}`);
  }
  if (JSON.stringify(data.metadata) !== JSON.stringify(provenance.vision.backend)) throw new Error('Vision model or contract changed during the run. Start a new evaluation.');
  manifest.visionLiveCalls++;
  state.calls.push({ key, mode: request.mode, dishLabel: request.dishLabel, metadata: data.metadata, result: data.result });
  return JSON.stringify(data.result);
}

// Compile repository TypeScript in memory; do not load Expo or native modules.
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
const photoPath = path.join(root, 'services', 'photoAnalysis.ts');
require.cache[photoPath] = { id: photoPath, filename: photoPath, loaded: true, exports: { runPhotoAnalysis } };
// Reuse the evaluator's authenticated client instead of loading Expo Supabase globals.
const nutritionPath = path.join(root, 'services', 'nutritionLookup.ts');
require.cache[nutritionPath] = { id: nutritionPath, filename: nutritionPath, loaded: true, exports: {
  lookupFoodNutrition: async (queries, contexts) => {
    const state = context.getStore();
    const key = cacheKey({ queries, contexts }, provenance.nutrition);
    const cached = state.previous.find(item => item.key === key) ?? (args.includes('--replay-legacy') ? state.previous.find(item => item.mode === 'nutrition' && JSON.stringify(item.queries) === JSON.stringify(queries) && JSON.stringify(item.contexts) === JSON.stringify(contexts)) : undefined);
    if (cached) {
      manifest.nutritionCacheHits++;
      state.calls.push(cached);
      return cached.result;
    }
    if (isReplay()) {
      const message = 'Missing matching nutrition cache; run live evaluation first.';
      state.failures.push(message);
      throw new Error(message);
    }
    let result;
    try { result = await lookupNutrition(client, queries, contexts, nutritionReferenceSource); }
    catch (error) { state.failures.push(error.message); throw error; }
    manifest.nutritionLiveCalls++;
    state.calls.push({ key, mode: 'nutrition', queries, contexts, result });
    return result;
  },
} };
const { analyzeFoodImageAdvanced } = require('../services/advancedFoodAnalysis.ts');
const { hasPendingAnalysisReview } = require('../services/analysisScope.ts');

const csvCell = value => `"${(value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')).replace(/"/g, '""')}"`;
const isReplay = () => args.includes('--replay') || args.includes('--replay-legacy');

async function main() {
  if (args.includes('--help')) {
    console.log('npm run evaluate:food -- [folder] [--prepare | --replay | --replay-legacy | --fresh] [--browser-auth] [--signup]\nDefault: versioned cache with live lookups on misses. --fresh measures new vision. --replay tests cached pipeline behavior. --replay-legacy explicitly imports unversioned historical predictions; it cannot measure current vision accuracy. Live runs require Supabase CLI login for deployment versions. Outputs are isolated under evaluation/runs/.');
    return;
  }
  const only = args.find(arg => arg.startsWith('--only='))?.slice('--only='.length);
  const excludedFiles = args.filter(arg => arg.startsWith('--exclude=')).map(arg => arg.slice('--exclude='.length));
  const photos = fs.readdirSync(folder).filter(name => /\.(jpe?g|png|webp)$/i.test(name) && (!only || name === only) && !excludedFiles.includes(name)).sort();
  if (!photos.length) throw new Error('No JPEG, PNG, or WebP photos found.');
  const referencePath = path.join(folder, 'reference.json');
  if (!fs.existsSync(referencePath)) {
    fs.writeFileSync(referencePath, JSON.stringify(photos.map(filename => ({
      filename, expectedFoods: [], weightGrams: null, calories: null, protein: null, carbs: null, fat: null,
    })), null, 2));
  }
  if (args.includes('--prepare')) {
    console.log(`Found ${photos.length} photos. Reference template: ${referencePath}`);
    return;
  }
  fs.mkdirSync(evaluationRoot, { recursive: true });
  const baseline = path.join(evaluationRoot, 'baselines', 'original');
  if (!fs.existsSync(baseline) && fs.existsSync(path.join(evaluationRoot, 'results.json'))) {
    fs.mkdirSync(baseline, { recursive: true });
    for (const name of fs.readdirSync(evaluationRoot)) {
      if (fs.statSync(path.join(evaluationRoot, name)).isFile()) fs.copyFileSync(path.join(evaluationRoot, name), path.join(baseline, name));
    }
    fs.copyFileSync(referencePath, path.join(baseline, 'reference.json'));
  }
  const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + require('node:crypto').randomBytes(3).toString('hex');
  output = path.join(evaluationRoot, 'runs', runId);
  fs.mkdirSync(output, { recursive: true });
  const localVision = fs.readFileSync(path.join(root, 'supabase/functions/analyze-food/index.ts'), 'utf8');
  const localNutrition = ['index.ts', 'fatsecret.ts', 'resilience.ts'].map(name =>
    fs.readFileSync(path.join(root, 'supabase/functions/nutrition-lookup', name), 'utf8')).join('\n');
  provenance = { vision: { sourceHash: hash(localVision) }, nutrition: { sourceHash: hash(localNutrition) } };
  manifest = { runId, excludedFiles, startedAt: new Date().toISOString(), kind: args.includes('--replay-legacy') ? 'legacy-replay' : args.includes('--replay') ? 'pipeline-replay' : args.includes('--fresh') ? 'fresh-vision' : 'cached-pipeline',
    referenceHash: hash(fs.readFileSync(referencePath)), localPipelineHash: hash(['services/advancedFoodAnalysis.ts', 'services/photoMeasurements.ts', 'services/analysisScope.ts', 'services/analysisNutrition.ts', 'services/localNutrition.ts', 'lib/nutritionIdentity.ts', 'services/ingredientDeduplication.ts', 'services/portionValidation.ts', 'scripts/evaluate-food.cjs', 'scripts/food-eval-reliability.cjs'].map(name => fs.readFileSync(path.join(root, name), 'utf8'))),
    visionCacheHits: 0, visionLiveCalls: 0, nutritionCacheHits: 0, nutritionLiveCalls: 0, photos: [] };
  if (args.includes('--replay')) {
    const previous = JSON.parse(fs.readFileSync(path.join(evaluationRoot, 'latest.json'), 'utf8'));
    provenance.vision = { ...previous.provenance.vision, sourceHash: hash(localVision) };
    provenance.nutrition = { ...previous.provenance.nutrition, sourceHash: hash(localNutrition) };
  }
  manifest.provenance = provenance;
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
  if (!isReplay()) {
    const extra = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo?.extra ?? {};
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey;
    const email = process.env.FOOD_EVAL_EMAIL;
    const password = process.env.FOOD_EVAL_PASSWORD;
    if (!url || !key || !email) {
      throw new Error('Set FOOD_EVAL_EMAIL in .env and Supabase URL/key in .env or app.json expo.extra. Passwordless accounts use an email link/code in the terminal.');
    }
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: true } });
    const authOptions = { shouldCreateUser: args.includes('--signup') };
    if (process.env.FOOD_EVAL_CODE) {
      const code = process.env.FOOD_EVAL_CODE;
      delete process.env.FOOD_EVAL_CODE;
      const verified = await verifyEmailInput(client, email, code, url);
      if (verified.error || !verified.data?.session) throw new Error('The supplied email code could not be verified. Request a new sign-in email.');
    } else if (args.includes('--browser-auth') && !password) {
      await authenticateInBrowser(client, email, url, authOptions);
    } else {
      await authenticateInteractive(client, email, password, url, authOptions);
    }
    const versions = deploymentVersions(url);
    const { data: backend, error: metadataError } = await client.functions.invoke('analyze-food', { body: { mode: 'metadata' } });
    lastVisionRequest = Date.now();
    const expectedVersion = localVision.match(/ANALYSIS_VERSION = '([^']+)'/)?.[1];
    if (metadataError || backend?.metadata?.analysisVersion !== expectedVersion) throw new Error('Deployed analyze-food contract does not match this repository. Deploy it before evaluating.');
    provenance.vision = { ...provenance.vision, deployment: versions['analyze-food'], backend: backend.metadata };
    const { data: nutritionBackend, error: nutritionMetadataError } = await client.functions.invoke('nutrition-lookup', {
      body: { mode: 'metadata', ...(nutritionReferenceSource ? { referenceSource: nutritionReferenceSource } : {}) },
    });
    if (nutritionMetadataError || !nutritionBackend?.metadata?.modelDeployment || nutritionBackend.metadata.referenceSource !== 'fatsecret' || !nutritionBackend.metadata.configured) throw new Error('Cannot establish nutrition-selector deployment. Deploy the current nutrition-lookup function.');
    provenance.nutrition = { ...provenance.nutrition, deployment: versions['nutrition-lookup'], backend: nutritionBackend.metadata };
    const queries = ['pancakes', 'rice crispbread', 'cooked buckwheat'];
    try {
      const results = await lookupNutrition(client, queries, queries.map(foodName => ({ foodName })), nutritionReferenceSource);
      fs.writeFileSync(path.join(output, 'fatsecret-live-preflight.json'), JSON.stringify({
        timestamp: new Date().toISOString(), mode: 'resolve', success: true, results,
      }, null, 2));
      console.log(`FatSecret resolve preflight: ${results.filter(item => item.match).length}/3 automatic matches`);
    } catch (error) {
      fs.writeFileSync(path.join(output, 'fatsecret-live-preflight.json'), JSON.stringify({
        timestamp: new Date().toISOString(), mode: 'resolve', success: false, error: error.message,
      }, null, 2));
      throw error;
    }
  }
  const sharp = require('sharp');
  const references = JSON.parse(fs.readFileSync(referencePath, 'utf8'));
  const annotationsPath = path.join(folder, 'annotations.json');
  const annotationsSource = fs.existsSync(annotationsPath) ? annotationsPath : path.join(__dirname, 'food-eval-regression-annotations.json');
  const annotations = JSON.parse(fs.readFileSync(annotationsSource, 'utf8'));
  manifest.annotationsHash = hash(fs.readFileSync(annotationsSource));
  fs.copyFileSync(annotationsSource, path.join(output, 'annotations.json'));
  fs.copyFileSync(referencePath, path.join(output, 'reference.json'));
  manifest.provenance = provenance;
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const rows = [];
  for (const filename of photos) {
    console.log(`Evaluating ${rows.length + 1}/${photos.length}: ${filename}`);
    const imageHash = hash(fs.readFileSync(path.join(folder, filename)));
    manifest.photos.push({ filename, imageHash });
    const cacheFolder = path.join(evaluationRoot, 'cache');
    fs.mkdirSync(cacheFolder, { recursive: true });
    const cachePath = args.includes('--replay-legacy') ? path.join(evaluationRoot, `${filename}.vision.json`) : path.join(cacheFolder, `${imageHash}.json`);
    const state = { imageHash, calls: [], failures: [], previous: !args.includes('--fresh') && fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : [] };
    try {
      const base64 = (await sharp(path.join(folder, filename)).rotate().resize({ width: 1200 }).jpeg({ quality: 80 }).toBuffer()).toString('base64');
      const result = await context.run(state, () => analyzeFoodImageAdvanced(filename, base64));
      fs.writeFileSync(path.join(output, `${filename}.result.json`), JSON.stringify(result, null, 2));
      const expected = { ...references.find(item => item.filename === filename), ...annotations.photos?.[filename] };
      const actual = result.data?.totalNutrition;
      const row = { filename, success: result.success && state.failures.length === 0, error: result.error || state.failures.join('; ') || undefined,
        nutritionStatus: result.data?.nutritionStatus,
        reviewPending: result.data ? hasPendingAnalysisReview(result.data) : undefined,
        resolvedIngredients: result.data?.ingredients.filter(item => item.nutritionStatus !== 'unresolved').length,
        ingredientCount: result.data?.ingredients.length,
        foods: result.data?.ingredients.map(item => item.name).join('; '),
        ...actual, confidence: result.data?.confidence,
        warnings: result.data?.warnings?.join('; '), processingTimeMs: result.metadata?.processingTimeMs,
        metrics: evaluationMetrics(result.data, expected),
        pipelineWarnings: state.calls.filter(item => item.mode === 'nutrition').length ? [] : ['No nutrition response cached; check analysis warnings.'] };
      for (const nutrient of ['calories', 'protein', 'carbs', 'fat']) {
        if (actual && !row.reviewPending && result.data?.nutritionStatus === 'complete' && Number.isFinite(expected?.[nutrient]) && expected[nutrient] >= 0) {
          row[`${nutrient}AbsoluteError`] = Math.abs(actual[nutrient] - expected[nutrient]);
          if (expected[nutrient] > 0) row[`${nutrient}ErrorPercent`] = 100 * row[`${nutrient}AbsoluteError`] / expected[nutrient];
        }
      }
      rows.push(row);
    } catch (error) {
      rows.push({ filename, success: false, error: error.message });
    } finally {
      if (state.calls.length) {
        fs.writeFileSync(path.join(output, `${filename}.vision.json`), JSON.stringify(state.calls, null, 2));
        if (!isReplay()) {
          const retained = state.previous.filter(item => item.key && !state.calls.some(call => call.key === item.key));
          fs.writeFileSync(cachePath, JSON.stringify([...retained, ...state.calls], null, 2));
        }
      }
    }
  }
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  fs.writeFileSync(path.join(output, 'results.csv'), [columns.map(csvCell).join(','), ...rows.map(row => columns.map(key => csvCell(row[key])).join(','))].join('\n'));
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(rows, null, 2));
  manifest.completedAt = new Date().toISOString();
  manifest.successfulPhotos = rows.filter(row => row.success).length;
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
  if (!args.includes('--replay-legacy')) fs.writeFileSync(path.join(evaluationRoot, 'latest.json'), JSON.stringify(manifest, null, 2));
  const measured = rows.filter(row => Number.isFinite(row.caloriesErrorPercent));
  console.log(`${rows.filter(row => row.success).length}/${photos.length} successful. Results: ${output}`);
  console.log(measured.length ? `Mean absolute calorie error: ${(measured.reduce((sum, row) => sum + row.caloriesErrorPercent, 0) / measured.length).toFixed(1)}% (${measured.length} complete references)` : 'No complete nutrition results with reference calories; numeric accuracy has not been measured.');
  if (rows.some(row => !row.success)) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.message);
  if (output && manifest) fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ ...manifest, error: error.message, completedAt: new Date().toISOString() }, null, 2));
  process.exitCode = 1;
}).finally(() => client?.auth.stopAutoRefresh());
