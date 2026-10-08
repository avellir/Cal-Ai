/* Offline before/after comparison of saved service inputs; no photo model calls. */
/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const folder = path.join(root, 'photo-food', 'evaluation');
const baseline = JSON.parse(fs.readFileSync(path.join(folder, 'service-probes.json'), 'utf8'));
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  return resolve.call(this, name.startsWith('@/') ? path.join(root, name.slice(2)) : name, parent, ...rest);
};
require.extensions['.ts'] = function (module, filename) {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(compiled.outputText, filename);
};
const { lookupIngredientNutrition } = require('../services/localNutrition.ts');
const { validatePortionSize } = require('../services/portionValidation.ts');
const after = {
  generatedAt: new Date().toISOString(),
  scope: 'Offline service probes using the same inputs as the saved baseline. Not live photo analysis or measured nutrition accuracy.',
  lookup: baseline.lookup.map(({ name }) => {
    const result = lookupIngredientNutrition({ name, quantity: 100, unit: 'g' });
    return {
      name, source: result.source, matchedFoodId: result.foodId,
      referencePer100g: {
        calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat,
      },
    };
  }),
  portions: baseline.portions.map(({ name, inputQuantityGrams }) => ({
    name, inputQuantityGrams, ...validatePortionSize(name, inputQuantityGrams, 'g'),
  })),
};
fs.writeFileSync(path.join(folder, 'service-probes-after.json'), JSON.stringify(after, null, 2) + '\n');

const lines = [
  '# Food algorithm comparison',
  '',
  after.scope,
  '',
  'The original baseline is preserved in service-probes.json. The current probes are saved in service-probes-after.json.',
  '',
  '## Portion handling',
  '',
  '| Input | Before | After |',
  '| --- | ---: | ---: |',
  ...after.portions.map((item, index) => '| ' + item.name + ' (' + item.inputQuantityGrams +
    ' g) | ' + baseline.portions[index].adjustedQuantity + ' g | ' + item.adjustedQuantity + ' g |'),
  '',
  'Out-of-guideline amounts are now preserved and flagged for review. A shared pan is not assumed to be one serving. The supported 10000 g/ml ceiling still applies.',
  '',
  '## Changed reference matches',
  '',
  '| Food name | Before | After |',
  '| --- | --- | --- |',
  ...after.lookup.flatMap((item, index) => item.matchedFoodId === baseline.lookup[index].matchedFoodId ? [] :
    ['| ' + item.name + ' | ' + baseline.lookup[index].matchedFoodId + ' | ' + item.matchedFoodId + ' |']),
  '',
  'A generic estimate remains approximate; preventing a false component match does not establish the correct recipe nutrition.',
  '',
  '## Additional regression coverage',
  '',
  '- Mixed dishes retain all reliable ingredients instead of being cut to five or collapsed from the caption.',
  '- Repeated labels in one region use the largest detected total; quantities in separate regions add.',
  '- Similar names for distinct foods, cooking methods and varieties remain separate.',
  '- Steak, milk chocolate, water chestnuts and wine sauce keep mass units. Chocolate milk remains a beverage.',
  '- Original confidence is never raised by validation penalties. Failed nutrition validation returns a failed result.',
  '- Unavailable optional refinement retains the original recognition and adds a warning.',
  '',
  '## Photo review and remaining work',
  '',
  'The manual review of all 14 photos is saved in [review.md](review.md), with per-photo notes in visual-review.json and visual-review.csv. Those are visual observations, not model responses.',
  '',
  'Live authenticated Azure analyses have not completed. No measured weights or recipes are available, so neither calorie error nor run-to-run vision consistency has been measured. The server prompt changes require redeploying analyze-food. Then use scripts/evaluate-food.cjs to save live results and cached responses; use --replay for a controlled client comparison.',
  '',
  'See [implementation notes](../../scripts/FOOD_ANALYSIS_ACCURACY.md) for reference sources and validation details.',
  '',
];
fs.writeFileSync(path.join(folder, 'algorithm-improvements.md'), lines.join('\n'));
console.log('Saved offline service comparison and algorithm-improvements.md in photo-food/evaluation.');
