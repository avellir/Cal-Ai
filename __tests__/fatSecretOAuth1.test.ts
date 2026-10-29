import { createHmac, webcrypto } from 'node:crypto';
import { handleNutritionRequest } from '../supabase/functions/nutrition-lookup/index';
import { fatSecretRequest, getFatSecretAuthMode, isFatSecretConfigured } from '../supabase/functions/nutrition-lookup/fatsecret';
import { details, food, search } from './fixtures/fatsecret';

const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
beforeAll(() => Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true }));
afterAll(() => {
  if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
  else Reflect.deleteProperty(globalThis, 'crypto');
});

const settings: Record<string, string> = {
  SUPABASE_URL: 'https://oauth1-test.supabase.co', SUPABASE_ANON_KEY: 'anon',
  FATSECRET_CONSUMER_KEY: 'consumer-key', FATSECRET_CONSUMER_SECRET: "private-secret&!'()",
};
const request = (body: unknown) => new Request('https://test/nutrition-lookup', {
  method: 'POST', headers: { Authorization: 'Bearer user-token' }, body: JSON.stringify(body),
});
const dependencies = (fetcher: typeof fetch, overrides: Record<string, string> = {}) => ({
  env: (name: string) => ({ ...settings, ...overrides })[name], fetch: fetcher,
});

it('searches and loads food details using signed OAuth 1.0 without a token exchange', async () => {
  const record = food(9001, 'Buckwheat cooked', 92);
  const fetcher = jest.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: 'oauth1-user' })))
    .mockResolvedValueOnce(search([record])).mockResolvedValueOnce(details(record));
  const response = await handleNutritionRequest(request({ mode: 'batch', queries: ['cooked buckwheat'] }), dependencies(fetcher));
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.results[0].match).toEqual(expect.objectContaining({ id: 'fatsecret:9001', source: 'fatsecret' }));
  expect(fetcher).toHaveBeenCalledTimes(3);
  const urls = fetcher.mock.calls.slice(1).map(call => new URL(String(call[0])));
  expect(urls.map(url => url.searchParams.get('method'))).toEqual(['foods.search', 'food.get.v5']);
  expect(urls[1].searchParams.get('food_id')).toBe('9001');
  for (const url of urls) {
    expect(url.origin + url.pathname).toBe('https://platform.fatsecret.com/rest/server.api');
    expect(url.searchParams.get('oauth_signature_method')).toBe('HMAC-SHA1');
    expect(url.searchParams.get('oauth_signature')).toBeTruthy();
    expect(url.toString()).not.toContain('private-secret');
  }
  expect(JSON.stringify(body)).not.toMatch(/private-secret|consumer-key|oauth_signature/);
});

it('signs the exact encoded request, including spaces, Unicode and reserved characters', async () => {
  const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ foods: { food: [] } })));
  const query = "tofu & rice! (caf\u00e9)";
  await fatSecretRequest('foods/search/v1', { search_expression: query }, dependencies(fetcher), new AbortController().signal);
  const url = new URL(String(fetcher.mock.calls[0][0]));
  expect(url.searchParams.get('search_expression')).toBe(query);
  expect(url.searchParams.get('oauth_consumer_key')).toBe('consumer-key');
  expect(url.searchParams.has('oauth_token')).toBe(false);
  const signature = url.searchParams.get('oauth_signature');
  url.searchParams.delete('oauth_signature');
  const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, character => '%' + character.charCodeAt(0).toString(16).toUpperCase());
  const parameters = [...url.searchParams].map(([name, value]) => encode(name) + '=' + encode(value)).sort().join('&');
  const base = ['GET', url.origin + url.pathname, parameters].map(encode).join('&');
  const expected = createHmac('sha1', encode(settings.FATSECRET_CONSUMER_SECRET) + '&').update(base).digest('base64');
  expect(signature).toBe(expected);
  expect(fetcher.mock.calls[0][1]).toEqual(expect.objectContaining({ redirect: 'error' }));
});

it('generates a unique nonce for each signed request', async () => {
  const fetcher = jest.fn().mockImplementation(async () => details(food(9002, 'Rice')));
  const deps = dependencies(fetcher);
  await Promise.all([1, 2].map(() => fatSecretRequest('food/v5', { food_id: '9002' }, deps, new AbortController().signal)));
  const nonces = fetcher.mock.calls.map(call => new URL(String(call[0])).searchParams.get('oauth_nonce'));
  expect(new Set(nonces).size).toBe(2);
});

it('re-signs a temporary-error retry with a fresh OAuth nonce', async () => {
  const fetcher = jest.fn().mockResolvedValueOnce(new Response('{}', { status: 503, headers: { 'Retry-After': '0' } }))
    .mockResolvedValueOnce(details(food(9002, 'Rice')));
  await fatSecretRequest('food/v5', { food_id: '9002' }, dependencies(fetcher), new AbortController().signal);
  const urls = fetcher.mock.calls.map(call => new URL(String(call[0])));
  expect(urls).toHaveLength(2);
  expect(urls[0].searchParams.get('oauth_nonce')).not.toBe(urls[1].searchParams.get('oauth_nonce'));
  expect(urls[0].searchParams.get('oauth_signature')).not.toBe(urls[1].searchParams.get('oauth_signature'));
});

it('prefers OAuth 1.0 when both credential pairs are configured', async () => {
  const fetcher = jest.fn().mockResolvedValue(details(food(9003, 'Rice')));
  const deps = dependencies(fetcher, { FATSECRET_CLIENT_ID: 'oauth2-id', FATSECRET_CLIENT_SECRET: 'oauth2-secret' });
  expect(getFatSecretAuthMode(deps)).toBe('oauth1');
  await fatSecretRequest('food/v5', { food_id: '9003' }, deps, new AbortController().signal);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get('oauth_consumer_key')).toBe('consumer-key');
});

it('reports an incomplete OAuth 1.0 pair instead of silently falling back to IP-restricted OAuth 2.0', async () => {
  const fetcher = jest.fn();
  const deps = dependencies(fetcher, { FATSECRET_CONSUMER_SECRET: '', FATSECRET_CLIENT_ID: 'oauth2-id', FATSECRET_CLIENT_SECRET: 'oauth2-secret' });
  expect(isFatSecretConfigured(deps)).toBe(false);
  await expect(fatSecretRequest('food/v5', { food_id: '1' }, deps, new AbortController().signal)).rejects.toThrow('not configured');
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([[5, 'credentials or signature'], [8, 'credentials or signature'], [6, 'timestamp or nonce'], [11, 'request limit']])(
  'handles OAuth 1.0 provider error %s without exposing diagnostics', async (code, message) => {
    const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code, message: 'private provider diagnostic' } })));
    let failure: unknown;
    try { await fatSecretRequest('food/v5', { food_id: '1' }, dependencies(fetcher), new AbortController().signal); }
    catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain(message);
    expect((failure as Error).message).not.toContain('private provider diagnostic');
  },
);

it('reports the selected authentication mode without exposing any credential', async () => {
  const fetcher = jest.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'metadata-user' })));
  const response = await handleNutritionRequest(request({ mode: 'metadata' }), dependencies(fetcher));
  const body = await response.json();
  expect(body.metadata).toEqual(expect.objectContaining({ authentication: 'oauth1', configured: true, referenceSource: 'fatsecret' }));
  expect(JSON.stringify(body)).not.toMatch(/consumer-key|private-secret/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
