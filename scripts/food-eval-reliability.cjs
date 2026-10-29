const { createHash } = require('node:crypto');
const { Buffer } = require('node:buffer');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex');
const cacheKey = (request, provenance) => hash({ request, provenance });

function deploymentVersions(url) {
  const project = new URL(url).hostname.split('.')[0];
  if (!/^[a-z0-9]{20}$/.test(project)) throw new Error('Live evaluation requires a hosted Supabase project for deployment provenance.');
  const npmEntry = process.env.npm_execpath;
  const npxEntry = npmEntry ? path.join(path.dirname(npmEntry), 'npx-cli.js') : path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
  if (!fs.existsSync(npxEntry)) throw new Error('Run the evaluator through npm run evaluate:food so the Supabase CLI can be located.');
  const output = execFileSync(process.execPath,
    [npxEntry, '--yes', 'supabase', 'functions', 'list', '--project-ref', project, '--output', 'json'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
  const start = output.search(/[\[{]/);
  const parsed = JSON.parse(output.slice(start));
  const functions = Array.isArray(parsed) ? parsed : parsed.functions;
  const result = {};
  for (const slug of ['analyze-food', 'nutrition-lookup']) {
    const item = functions?.find(item => item.slug === slug || item.name === slug);
    if (!item?.version) throw new Error(`Cannot establish deployed version of ${slug}. Log into the Supabase CLI.`);
    result[slug] = { version: item.version, sourceHash: item.ezbr_sha256 ?? null, updatedAt: item.updated_at };
  }
  return result;
}

const normalized = text => String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const matches = (actual, aliases) => aliases.some(alias => normalized(actual) === normalized(alias));
const measure = (actual, expected) => ({ actual, expected, absoluteError: Math.abs(actual - expected),
  errorPercent: expected > 0 ? 100 * Math.abs(actual - expected) / expected : null });

function evaluationMetrics(data, reference = {}) {
  if (!data) return { nutritionCoverage: null, identity: null, counts: null, scope: null, falseWarnings: null };
  const ingredients = data.ingredients;
  const selectedRegions = data.regions.filter(region => region.selected !== false);
  const totals = unit => ingredients.filter(item => item.unit === unit).reduce((sum, item) => sum + item.quantity, 0);
  const onlyMass = ingredients.length > 0 && ingredients.every(item => item.unit === 'g');
  const hasVolume = ingredients.some(item => item.unit === 'ml');
  const metrics = {
    nutritionCoverage: { resolved: ingredients.filter(item => item.nutritionStatus !== 'unresolved' && item.source !== 'generic').length, total: ingredients.length },
    mass: Number.isFinite(reference.weightGrams) && onlyMass ? measure(totals('g'), reference.weightGrams) : null,
    volume: Number.isFinite(reference.volumeMl) && hasVolume ? measure(totals('ml'), reference.volumeMl) : null,
    visibleFat: { detected: ingredients.filter(item => item.isAddedFat).map(item => item.name),
      assessments: selectedRegions.map(region => ({ assessment: region.fatAssessment ?? null, evidence: region.fatEvidence ?? null })),
      reviewRequested: selectedRegions.some(region => region.fatAssessment === 'ambiguous'), expected: reference.fatExpected ?? null },
    identity: null, counts: null, scope: null, falseWarnings: null,
  };
  if (Array.isArray(reference.dishAliases)) metrics.identity = reference.dishAliases.map(aliases => ({ aliases,
    found: selectedRegions.some(region => matches(region.dishName ?? region.description, aliases)) }));
  if (Array.isArray(reference.ingredients)) metrics.counts = reference.ingredients.map(expected => {
    const found = ingredients.filter(item => matches(item.foodName ?? item.name, expected.aliases));
    return { aliases: expected.aliases, matchedDetections: found.length,
      found: found.length > 0,
      countCorrect: expected.visibleCount === undefined ? null : found.length > 0 && found.every(item => Number.isFinite(item.visibleCount)) && found.reduce((sum, item) => sum + item.visibleCount, 0) === expected.visibleCount,
      fractionCorrect: expected.visibleFraction === undefined ? null : found.length > 0 && found.every(item => item.visibleFraction === expected.visibleFraction),
      typeCorrect: expected.itemType === undefined ? null : found.length > 0 && found.every(item => normalized(item.itemType) === normalized(expected.itemType)),
    };
  });
  if (Array.isArray(reference.scope)) metrics.scope = reference.scope.map(expected => ({ ...expected,
    correct: selectedRegions.some(region => matches(region.dishName ?? region.description, expected.aliases)) === expected.included }));
  if (Array.isArray(reference.unexpectedWarningPatterns)) metrics.falseWarnings = reference.unexpectedWarningPatterns.map(pattern => ({
    pattern, triggered: (data.warnings ?? []).some(warning => normalized(warning).includes(normalized(pattern))),
  }));
  return metrics;
}

module.exports = { hash, cacheKey, deploymentVersions, evaluationMetrics };
