/* Batch runner: reuse app services, replacing only the native photo transport. */
/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { AsyncLocalStorage } = require('node:async_hooks');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
const { authenticateInteractive } = require('./food-eval-auth.cjs');
const { authenticateInBrowser } = require('./food-eval-browser-auth.cjs');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const folder = path.resolve(root, args.find(arg => !arg.startsWith('--')) || 'photo-food');
const output = path.join(folder, 'evaluation');
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
  const index = state.index++;
  const cached = state.previous[index];
  if (cached && cached.mode === request.mode && cached.dishLabel === request.dishLabel) {
    state.calls.push(cached);
    return JSON.stringify(cached.result);
  }
  if (args.includes('--replay')) throw new Error('Missing cached response; run live evaluation first.');
  const { data, error } = await client.functions.invoke('analyze-food', {
    body: request,
    signal: AbortSignal.timeout(100000),
  });
  if (error || !data?.result) throw new Error('Photo analysis request failed. Check function deployment and authentication.');
  state.calls.push({ mode: request.mode, dishLabel: request.dishLabel, result: data.result });
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
const { analyzeFoodImageAdvanced } = require('../services/advancedFoodAnalysis.ts');

const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

async function main() {
  if (args.includes('--help')) {
    console.log('npm run evaluate:food -- [folder] [--prepare | --replay | --fresh] [--browser-auth] [--signup]\nDefault: analyze photos, reusing cached vision responses. --prepare creates reference template only. --signup allows creating the specified Cal AI account.');
    return;
  }
  const photos = fs.readdirSync(folder).filter(name => /\.(jpe?g|png|webp)$/i.test(name)).sort();
  if (!photos.length) throw new Error('No JPEG, PNG, or WebP photos found.');
  fs.mkdirSync(output, { recursive: true });
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
  if (!args.includes('--replay')) {
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
    if (args.includes('--browser-auth') && !password) {
      await authenticateInBrowser(client, email, url, authOptions);
    } else {
      await authenticateInteractive(client, email, password, url, authOptions);
    }
  }
  const sharp = require('sharp');
  const references = JSON.parse(fs.readFileSync(referencePath, 'utf8'));
  const rows = [];
  for (const filename of photos) {
    console.log(`Evaluating ${rows.length + 1}/${photos.length}: ${filename}`);
    const cachePath = path.join(output, `${filename}.vision.json`);
    const state = { index: 0, calls: [], previous: !args.includes('--fresh') && fs.existsSync(cachePath)
      ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : [] };
    try {
      const base64 = (await sharp(path.join(folder, filename)).rotate().resize({ width: 1200 }).jpeg({ quality: 80 }).toBuffer()).toString('base64');
      const result = await context.run(state, () => analyzeFoodImageAdvanced(filename, base64));
      fs.writeFileSync(path.join(output, `${filename}.result.json`), JSON.stringify(result, null, 2));
      const expected = references.find(item => item.filename === filename);
      const actual = result.data?.totalNutrition;
      const row = { filename, success: result.success, error: result.error,
        foods: result.data?.ingredients.map(item => item.name).join('; '),
        ...actual, confidence: result.data?.confidence,
        warnings: result.data?.warnings?.join('; '), processingTimeMs: result.metadata?.processingTimeMs };
      for (const nutrient of ['calories', 'protein', 'carbs', 'fat']) {
        if (actual && Number.isFinite(expected?.[nutrient]) && expected[nutrient] >= 0) {
          row[`${nutrient}AbsoluteError`] = Math.abs(actual[nutrient] - expected[nutrient]);
          if (expected[nutrient] > 0) row[`${nutrient}ErrorPercent`] = 100 * row[`${nutrient}AbsoluteError`] / expected[nutrient];
        }
      }
      rows.push(row);
    } catch (error) {
      rows.push({ filename, success: false, error: error.message });
    } finally {
      if (state.calls.length) fs.writeFileSync(cachePath, JSON.stringify(state.calls, null, 2));
    }
  }
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  fs.writeFileSync(path.join(output, 'results.csv'), [columns.map(csvCell).join(','), ...rows.map(row => columns.map(key => csvCell(row[key])).join(','))].join('\n'));
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(rows, null, 2));
  const measured = rows.filter(row => Number.isFinite(row.caloriesErrorPercent));
  console.log(`${rows.filter(row => row.success).length}/${photos.length} successful. Results: ${output}`);
  console.log(measured.length ? `Mean absolute calorie error: ${(measured.reduce((sum, row) => sum + row.caloriesErrorPercent, 0) / measured.length).toFixed(1)}% (${measured.length} references)` : 'No reference calories supplied; numeric accuracy has not been measured.');
  if (rows.some(row => !row.success)) process.exitCode = 1;
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => client?.auth.stopAutoRefresh());
