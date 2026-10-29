/* global __dirname */
// Authenticated smoke test for the mode used by the app. Never prints credentials.
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

class DeploymentCheckError extends Error {}

async function checkNutritionDeployment({ url, key, accessToken }, fetcher = fetch) {
  async function invoke(payload) {
    const response = await fetcher(`${url}/functions/v1/nutrition-lookup`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(65000),
    });
    const body = await response.json();
    if (!response.ok) throw new DeploymentCheckError(`Nutrition ${payload.mode} failed (HTTP ${response.status}): ${body.error || 'Request failed.'}`);
    return body;
  }

  const { metadata } = await invoke({ mode: 'metadata' });
  if (metadata?.lookupVersion !== 'fatsecret-reference-v1' || metadata.referenceSource !== 'fatsecret' || metadata.retrievalVersion !== 'serving-details-v2' || metadata.resilienceVersion !== 'ingredient-failures-v1') {
    throw new DeploymentCheckError('The deployed nutrition-lookup is outdated. Deploy the FatSecret function before testing nutrition.');
  }
  if (metadata.configured !== true) {
    throw new DeploymentCheckError('FatSecret is not configured. Add FATSECRET_CONSUMER_KEY and FATSECRET_CONSUMER_SECRET in Supabase secrets, or a matching FATSECRET_CLIENT_ID / FATSECRET_CLIENT_SECRET pair for OAuth 2.0.');
  }
  const { results } = await invoke({
    mode: 'resolve', referenceSource: 'fatsecret', queries: ['cooked buckwheat'],
    contexts: [{ foodName: 'buckwheat', preparation: 'cooked' }],
  });
  const match = results?.[0]?.match;
  if (!Array.isArray(results) || results.length !== 1 || !match) {
    throw new DeploymentCheckError(`FatSecret did not resolve the test food. ${results?.[0]?.reason || 'Check provider access and automatic selection.'}`);
  }
  if (match.source !== 'fatsecret' || !/^fatsecret:\d{1,20}$/.test(match.id) ||
    results.some(result => !Array.isArray(result.candidates) || result.candidates.some(candidate =>
      candidate.source !== 'fatsecret' || !/^fatsecret:\d{1,20}$/.test(candidate.id)))) {
    throw new DeploymentCheckError('Nutrition returned an unexpected provider. Only FatSecret references are accepted.');
  }
  return { metadata, results };
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const envPath = path.join(root, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  const extra = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo?.extra ?? {};
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey;
  const email = process.env.FOOD_EVAL_EMAIL;
  const password = process.env.FOOD_EVAL_PASSWORD;
  if (!url || !key || !email || !password) throw new Error('Configure Supabase and FOOD_EVAL_EMAIL/FOOD_EVAL_PASSWORD for this noninteractive smoke test.');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error('Smoke-test account sign-in failed.');
  const result = await checkNutritionDeployment({ url, key, accessToken: data.session.access_token });
  console.log(JSON.stringify({ success: true, ...result }, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error instanceof DeploymentCheckError ? error.message : 'Nutrition deployment check failed; check configuration, authentication, and network access.');
    process.exitCode = 1;
  });
}

module.exports = { checkNutritionDeployment };
