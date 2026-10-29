import { handleNutritionRequest, matchScore, toReference } from '../supabase/functions/nutrition-lookup/index';
import { fatSecretRequest, toSearchReference } from '../supabase/functions/nutrition-lookup/fatsecret';
import { food, search, details, accessToken } from './fixtures/fatsecret';

const settings: Record<string, string> = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'anon',
  FATSECRET_CLIENT_ID: 'test-client', FATSECRET_CLIENT_SECRET: 'private-secret' };
let sequence = 0;
function setup(responses: Response[] = []) {
  const fetcher = jest.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: 'nutrition-user-' + ++sequence })));
  responses.forEach(response => fetcher.mockResolvedValueOnce(response));
  const env: Record<string, string> = { ...settings, SUPABASE_URL: 'https://nutrition-' + sequence + '.supabase.co' };
  return { fetcher, deps: { env: (key: string) => env[key], fetch: fetcher as typeof fetch } };
}
const request = (body: unknown) => new Request('https://test/nutrition-lookup', {
  method: 'POST', headers: { Authorization: 'Bearer user-token' }, body: JSON.stringify(body),
});

it('requires an authenticated user before contacting FatSecret', async () => {
  const { fetcher, deps } = setup();
  expect((await handleNutritionRequest(new Request('https://test', { method: 'POST' }), deps)).status).toBe(401);
  expect(fetcher).not.toHaveBeenCalled();
});
it('rejects expired sessions and supports CORS', async () => {
  const { fetcher, deps } = setup();
  fetcher.mockReset().mockResolvedValue(new Response('{}', { status: 401 }));
  expect((await handleNutritionRequest(request({ mode: 'search', query: 'rice' }), deps)).status).toBe(401);
  expect((await handleNutritionRequest(new Request('https://test', { method: 'OPTIONS' }), deps)).status).toBe(204);
});
it('searches FatSecret with a server token and obtains selected nutrients from food details', async () => {
  const record = food(123456, 'Buckwheat cooked', 120);
  const { fetcher, deps } = setup([accessToken(), search([record]), details(record)]);
  const response = await handleNutritionRequest(request({ mode: 'batch', queries: ['cooked buckwheat', 'cooked buckwheat'] }), deps);
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.results).toHaveLength(1);
  expect(body.results[0].match.id).toBe('fatsecret:123456');
  expect(body.results[0].match.servings).toContainEqual({ name: '1 piece', grams: 85 });
  const [tokenUrl, tokenOptions] = fetcher.mock.calls[1];
  expect(tokenUrl).toBe('https://oauth.fatsecret.com/connect/token');
  expect(tokenOptions.headers.Authorization).toBe('Basic ' + btoa('test-client:private-secret'));
  expect(new URLSearchParams(tokenOptions.body).get('scope')).toBe('basic');
  const [url, options] = fetcher.mock.calls[2];
  expect(new URL(url).searchParams.get('search_expression')).toBe('cooked buckwheat');
  expect(options.headers.Authorization).toBe('Bearer private-access-token');
  expect(body.results[0].match.nutrients.calories).toBe(120);
  expect(JSON.stringify(body)).not.toMatch(/private-secret|private-access-token/);
});
it('retains candidates when recipes are ambiguous', async () => {
  const { deps } = setup([accessToken(), search([food(1, 'Mystery soup with chicken'), food(2, 'Mystery soup with beef')])]);
  const body = await (await handleNutritionRequest(request({ mode: 'search', query: 'mystery soup' }), deps)).json();
  expect(body.results[0].match).toBeNull();
  expect(body.results[0].candidates).toHaveLength(2);
  expect(body.results[0].candidates[0].recipeAverage).toBe(true);
});
it('normalizes per-serving nutrients and preserves all documented serving masses', () => {
  const record = food(3, 'Food', 100);
  record.servings.serving = [{ ...record.servings.serving[0], metric_serving_amount: '50' }];
  const result = toReference({ food: record });
  expect(result?.basisUnit).toBe('g');
  expect(result?.basisAmount).toBe(100);
  expect(result?.nutrients).toEqual({ calories: 200, protein: 40, fat: 10, carbs: 12 });
  expect(result?.servings[0].grams).toBe(50);
});
it('preserves zero values but rejects missing, empty, negative and non-finite nutrients', () => {
  const record = food(4, 'Water', 0);
  record.servings.serving = [{ ...record.servings.serving[0], calories: '0', protein: '0', fat: '0', carbohydrate: '0' }];
  expect(toReference(record)?.nutrients).toEqual({ calories: 0, protein: 0, fat: 0, carbs: 0 });
  for (const value of [undefined, '', 'NaN', '-1', 'Infinity']) {
    const invalid = { ...record, servings: { serving: { ...record.servings.serving[0], carbohydrate: value } } };
    expect(toReference(invalid)).toBeNull();
  }
});
it('keeps milliliters distinct from grams and never invents a density', () => {
  const record = food(5, 'Milk', 60);
  record.servings.serving = [{ ...record.servings.serving[0], metric_serving_unit: 'ml', metric_serving_amount: '200' }];
  expect(toReference(record)).toEqual(expect.objectContaining({ basisUnit: 'ml', basisAmount: 100, servings: [],
    nutrients: expect.objectContaining({ calories: 30 }) }));
  expect(toReference({ ...record, servings: { serving: { ...record.servings.serving[0], metric_serving_unit: 'oz', metric_serving_amount: '1' } } })?.basisUnit).toBe('g');
});
it('supports a serving-only record without treating it as a gram reference', () => {
  const record = food(6, 'Serving');
  const serving = { ...record.servings.serving[0], metric_serving_amount: undefined, metric_serving_unit: undefined };
  expect(toReference({ ...record, servings: { serving } })).toEqual(expect.objectContaining({ basisUnit: 'serving', basisAmount: 1, servings: [] }));
});
it('supports singleton search payloads and excludes brands and incomplete summaries', async () => {
  const record = food(7, 'Apple');
  const { deps } = setup([accessToken(), new Response(JSON.stringify({ foods: { food: record } })), details(record)]);
  const body = await (await handleNutritionRequest(request({ mode: 'search', query: 'apple' }), deps)).json();
  expect(body.results[0].match.id).toBe('fatsecret:7');
  expect(toSearchReference({ ...record, food_type: 'Brand' })).toBeNull();
  expect(toSearchReference({ ...record, food_description: 'Per 100g - Calories: 100kcal' })).toBeNull();
  expect(toSearchReference({ ...record, food_description: record.food_description.replace('100g', '200ml') })?.nutrients.calories).toBe(75);
});
it('does not replace cooked foods with raw records or components with whole dishes', () => {
  expect(matchScore('cooked rice', 'Rice raw')).toBe(0);
  expect(matchScore('tomato sauce', 'Tomatoes raw')).toBe(0);
  expect(matchScore('chicken', 'Soup chicken')).toBe(0);
  expect(matchScore('rice cake', 'Rice cooked')).toBe(0);
});
it.each([
  { mode: 'batch', queries: Array(61).fill('food') }, { mode: 'search', query: '' },
  { mode: 'details', id: 'https://untrusted.example' }, { mode: 'arbitrary' },
  { mode: 'metadata', referenceSource: 'catalog' },
])('bounds requests before contacting FatSecret: %j', async body => {
  const { fetcher, deps } = setup();
  expect((await handleNutritionRequest(request(body), deps)).status).toBe(400);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('bounds streamed bodies and rejects invalid JSON', async () => {
  const { deps } = setup();
  expect((await handleNutritionRequest(request({ query: 'x'.repeat(16001) }), deps)).status).toBe(413);
  const second = setup();
  const invalid = new Request('https://test', { method: 'POST', headers: { Authorization: 'Bearer token' }, body: '{' });
  expect((await handleNutritionRequest(invalid, second.deps)).status).toBe(400);
});
it('leaves nutrition unresolved on provider failure without leaking diagnostics', async () => {
  const { deps } = setup([accessToken(), ...Array.from({ length: 3 }, () => new Response('private provider diagnostic', { status: 429, headers: { 'Retry-After': '0' } }))]);
  const body = await (await handleNutritionRequest(request({ mode: 'search', query: 'unavailable food' }), deps)).json();
  expect(body.results[0].match).toBeNull();
  expect(body.results[0].reason).toContain('unavailable');
  expect(JSON.stringify(body)).not.toContain('private provider diagnostic');
});
it('reports missing credentials explicitly without attempting OAuth', async () => {
  const { deps, fetcher } = setup();
  const body = await (await handleNutritionRequest(request({ mode: 'search', query: 'rice' }), {
    ...deps, env: name => name === 'FATSECRET_CLIENT_SECRET' ? undefined : deps.env(name),
  })).json();
  expect(body.results[0].match).toBeNull();
  expect(body.results[0].reason).toContain('not configured');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([
  [400, { error: 'invalid_client', error_description: 'private credential diagnostic' }, 'OAuth 2.0 client credentials'],
  [403, { error: 'invalid_client', error_description: 'IP address is not allowed: private diagnostic' }, 'server IP address'],
  [400, { error: 'invalid_scope', error_description: 'private scope diagnostic' }, 'basic scope'],
])('distinguishes OAuth failure with HTTP %s without leaking provider diagnostics', async (status, body, expected) => {
  const { deps, fetcher } = setup();
  fetcher.mockReset().mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
  await expect(fatSecretRequest('food/v5', { food_id: '1' }, deps, new AbortController().signal)).rejects.toThrow(String(expected));
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('handles non-JSON OAuth failures without returning raw provider content', async () => {
  const { deps, fetcher } = setup();
  fetcher.mockReset().mockImplementation(async () => new Response('private provider diagnostic', { status: 502, headers: { 'Retry-After': '0' } }));
  await expect(fatSecretRequest('food/v5', { food_id: '1' }, deps, new AbortController().signal)).rejects.toThrow('authentication is unavailable (HTTP 502)');
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it('refreshes an invalid bearer token once, including errors returned with HTTP 200', async () => {
  const { deps, fetcher } = setup();
  fetcher.mockReset().mockResolvedValueOnce(accessToken()).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 13, message: 'private' } })))
    .mockResolvedValueOnce(accessToken()).mockResolvedValueOnce(details(food(8, 'Rice')));
  expect((await fatSecretRequest('food/v5', { food_id: '8' }, deps, new AbortController().signal)).food).toBeDefined();
  expect(fetcher.mock.calls.filter(call => String(call[0]).includes('/connect/token'))).toHaveLength(2);
});
it.each([[21, 'IP address'], [14, 'permissions'], [11, 'limit']])('handles provider error code %s without exposing messages', async (code, message) => {
  const { deps, fetcher } = setup();
  fetcher.mockReset().mockResolvedValueOnce(accessToken()).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code, message: 'private diagnostic' } })));
  await expect(fatSecretRequest('food/v5', { food_id: '1' }, deps, new AbortController().signal)).rejects.toThrow(String(message));
});
it('reuses successful lookups without repeating provider requests', async () => {
  const { deps, fetcher } = setup([accessToken(), search([food(9, 'Millet cooked')]), details(food(9, 'Millet cooked'))]);
  await handleNutritionRequest(request({ mode: 'search', query: 'cooked millet' }), deps);
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'cache-user' })));
  const body = await (await handleNutritionRequest(request({ mode: 'search', query: 'cooked millet' }), deps)).json();
  expect(body.results[0].match.id).toBe('fatsecret:9');
  expect(fetcher).toHaveBeenCalledTimes(5);
});
it('returns the FatSecret provider and configuration status without exposing credentials', async () => {
  const { deps, fetcher } = setup();
  const body = await (await handleNutritionRequest(request({ mode: 'metadata' }), deps)).json();
  expect(body.metadata).toEqual(expect.objectContaining({ referenceSource: 'fatsecret', lookupVersion: 'fatsecret-reference-v1', configured: true }));
  expect(JSON.stringify(body)).not.toContain('private-secret');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('validates provider detail IDs and rejects inconsistent responses', async () => {
  const { deps } = setup([accessToken(), details(food(10, 'Rice'))]);
  expect((await handleNutritionRequest(request({ mode: 'details', id: 'fatsecret:11' }), deps)).status).toBe(422);
});

it('shares OAuth token acquisition across concurrent provider calls', async () => {
  const { deps, fetcher } = setup();
  fetcher.mockReset().mockImplementation(async (url: string | URL | Request) =>
    String(url).includes('/connect/token') ? accessToken() : details(food(12, 'Rice')));
  await Promise.all(Array.from({ length: 4 }, () => fatSecretRequest('food/v5', { food_id: '12' }, deps, new AbortController().signal)));
  expect(fetcher.mock.calls.filter(call => String(call[0]).includes('/connect/token'))).toHaveLength(1);
  expect(fetcher).toHaveBeenCalledTimes(5);
});
it('preserves explicit ml-to-mass servings without inferring cup or piece density', () => {
  const record = food(13, 'Milk');
  const result = toReference({ ...record, servings: { serving: [
    { ...record.servings.serving[0], serving_description: '100 ml', metric_serving_amount: '104' },
    { ...record.servings.serving[0], serving_description: '1 cup', metric_serving_amount: '240' },
  ] } });
  expect(result?.servings[0]).toEqual({ name: '100 ml', grams: 104, volumeMl: 100 });
  expect(result?.servings[1].volumeMl).toBeUndefined();
});
it('returns an actionable IP restriction error without exposing provider diagnostics', async () => {
  const { deps } = setup([accessToken(), new Response(JSON.stringify({ error: { code: 21, message: 'private upstream diagnostic' } }))]);
  const body = await (await handleNutritionRequest(request({ mode: 'search', query: 'rice' }), deps)).json();
  expect(body.results[0].match).toBeNull();
  expect(body.results[0].reason).toContain('IP address');
  expect(JSON.stringify(body)).not.toContain('private upstream diagnostic');
});
