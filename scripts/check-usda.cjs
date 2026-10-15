/* Provider-only smoke check: real USDA requests, no Supabase deployment or user session. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

async function main() {
  const source = fs.readFileSync(path.join(__dirname, '../supabase/functions/nutrition-lookup/index.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  new Function('module', 'exports', compiled)(loaded, loaded.exports);
  const env = {
    SUPABASE_URL: 'https://provider-smoke.invalid',
    SUPABASE_ANON_KEY: 'test-only',
    USDA_API_KEY: process.env.USDA_API_KEY || 'DEMO_KEY',
  };
  const dependencies = {
    env: name => env[name],
    fetch: async (url, options) => {
      if (url === env.SUPABASE_URL + '/auth/v1/user') return new Response(JSON.stringify({ id: 'provider-smoke' }));
      try {
        const response = await fetch(url, options);
        if (!response.ok) console.log(JSON.stringify({ upstreamPath: new URL(url).pathname, status: response.status }));
        return response;
      } catch (error) {
        console.log(JSON.stringify({ upstreamPath: new URL(url).pathname, networkError: error.cause?.code || error.name }));
        throw error;
      }
    },
  };
  const response = await loaded.exports.handleNutritionRequest(new Request('https://provider-smoke.invalid', {
    method: 'POST', headers: { Authorization: 'Bearer test-only' },
    body: JSON.stringify({ mode: 'batch', queries: ['cooked buckwheat', 'pancakes', 'rice crispbread'] }),
  }), dependencies);
  if (!response.ok) throw new Error('Provider smoke request failed: ' + response.status);
  const { results } = await response.json();
  for (const item of results) {
    console.log(JSON.stringify({
      query: item.query, matchedId: item.match?.id ?? null, matchedName: item.match?.name,
      nutrientBasis: item.match ? item.match.basisAmount + ' ' + item.match.basisUnit : null,
      servings: item.match?.servings.length ?? 0, candidateCount: item.candidates.length, reason: item.reason,
    }));
    if (!item.match && !item.candidates.length) throw new Error('No usable USDA records for ' + item.query);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
