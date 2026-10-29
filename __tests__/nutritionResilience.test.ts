import { handleNutritionRequest, resolveAutomatically } from '../supabase/functions/nutrition-lookup/index';
import { accessToken, details, food, search } from './fixtures/fatsecret';

const response = (selections: unknown[]) => new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ selections }) }] }] }));
const choose = (index: number, id: string | null, alternativeQuery = '') => ({ index, id, alternativeQuery, quality: 'exact', reason: 'Compatible food.' });
let run = 0;
function deps(fetcher: typeof fetch) {
  const env: Record<string, string> = { SUPABASE_URL: 'https://resilience-' + ++run + '.supabase.co', SUPABASE_ANON_KEY: 'anon',
    FATSECRET_CLIENT_ID: 'client', FATSECRET_CLIENT_SECRET: 'private', AZURE_OPENAI_API_KEY: 'private',
    AZURE_OPENAI_BASE_URL: 'https://test.openai.azure.com/openai/v1', AZURE_OPENAI_DEPLOYMENT: 'selector' };
  return { env: (name: string) => env[name], fetch: fetcher };
}

it('preserves healthy ingredients when another ingredient search fails', async () => {
  const fetcher = jest.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (address.includes('/connect/token')) return accessToken();
    if (address.includes('/foods/search')) return new URL(address).searchParams.get('search_expression') === 'apple'
      ? search([food(1, 'Apple')]) : new Response('{}', { status: 400 });
    if (address.includes('/responses')) return response([choose(0, 'fatsecret:1')]);
    return details(food(1, 'Apple'));
  });
  const results = await resolveAutomatically(['apple', 'carrot'], [{}, {}], deps(fetcher), new AbortController().signal);
  expect(results[0].match?.id).toBe('fatsecret:1');
  expect(results[1]).toEqual(expect.objectContaining({ match: null, failure: expect.objectContaining({ stage: 'search' }) }));
});

it('preserves healthy authoritative nutrition when another food detail request fails', async () => {
  const fetcher = jest.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (address.includes('/connect/token')) return accessToken();
    if (address.includes('/foods/search')) return search([food(1, 'Apple'), food(2, 'Carrot')]);
    if (address.includes('/responses')) return response([choose(0, 'fatsecret:1'), choose(1, 'fatsecret:2')]);
    return new URL(address).searchParams.get('food_id') === '1' ? details(food(1, 'Apple')) : new Response('{}', { status: 400 });
  });
  const results = await resolveAutomatically(['apple', 'carrot'], [{}, {}], deps(fetcher), new AbortController().signal);
  expect(results[0].match?.nutrients.calories).toBe(150);
  expect(results[1]).toEqual(expect.objectContaining({ match: null, failure: expect.objectContaining({ stage: 'details' }) }));
  expect(results[1].candidates.length).toBeGreaterThan(0);
});

it('keeps valid selector rows when one returned selection is malformed', async () => {
  const fetcher = jest.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (address.includes('/connect/token')) return accessToken();
    if (address.includes('/foods/search')) return search([food(1, 'Apple'), food(2, 'Carrot')]);
    if (address.includes('/responses')) return response([choose(0, 'fatsecret:1'), { index: 1, id: 'fatsecret:2' }]);
    return details(food(1, 'Apple'));
  });
  const results = await resolveAutomatically(['apple', 'carrot'], [{}, {}], deps(fetcher), new AbortController().signal);
  expect(results[0].match?.id).toBe('fatsecret:1');
  expect(results[1]).toEqual(expect.objectContaining({ failure: expect.objectContaining({ stage: 'selection', code: 'invalid_response' }) }));
});

it('does not erase selected foods when an alternative search fails', async () => {
  const fetcher = jest.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (address.includes('/connect/token')) return accessToken();
    if (address.includes('/foods/search')) {
      const query = new URL(address).searchParams.get('search_expression');
      return query === 'apple' ? search([food(1, 'Apple')]) : query === 'carrot' ? search([]) : new Response('{}', { status: 400 });
    }
    if (address.includes('/responses')) return response([choose(0, 'fatsecret:1'), choose(1, null, 'fresh carrot')]);
    return details(food(1, 'Apple'));
  });
  const results = await resolveAutomatically(['apple', 'carrot'], [{}, {}], deps(fetcher), new AbortController().signal);
  expect(results[0].match?.id).toBe('fatsecret:1');
  expect(results[1]).toEqual(expect.objectContaining({ match: null, failure: expect.objectContaining({ stage: 'search' }) }));
});

it('returns HTTP 200 with partial results rather than a meal-wide HTTP 503', async () => {
  const fetcher = jest.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (address.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: 'user' }));
    if (address.includes('/connect/token')) return accessToken();
    if (address.includes('/foods/search')) return new URL(address).searchParams.get('search_expression') === 'apple'
      ? search([food(1, 'Apple')]) : new Response('{}', { status: 403 });
    if (address.includes('/responses')) return response([choose(0, 'fatsecret:1')]);
    return details(food(1, 'Apple'));
  });
  const request = new Request('https://test', { method: 'POST', headers: { Authorization: 'Bearer user-token' },
    body: JSON.stringify({ mode: 'resolve', queries: ['apple', 'carrot'], contexts: [{}, {}] }) });
  const result = await handleNutritionRequest(request, deps(fetcher));
  expect(result.status).toBe(200);
  const body = await result.json();
  expect(body.partial).toBe(true);
  expect(body.results[0].match.id).toBe('fatsecret:1');
  expect(body.results[1].failure.stage).toBe('search');
});

it('recovers a temporary selector error without redoing successful ingredient searches', async () => {
  let selectorCalls = 0;
  const fetcher = jest.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (address.includes('/connect/token')) return accessToken();
    if (address.includes('/foods/search')) return search([food(1, 'Apple')]);
    if (address.includes('/responses')) return ++selectorCalls === 1
      ? new Response('{}', { status: 503, headers: { 'Retry-After': '0' } }) : response([choose(0, 'fatsecret:1')]);
    return details(food(1, 'Apple'));
  });
  const results = await resolveAutomatically(['apple'], [{}], deps(fetcher), new AbortController().signal);
  expect(results[0].match?.id).toBe('fatsecret:1');
  expect(results[0].failure).toBeUndefined();
  expect(selectorCalls).toBe(2);
  expect(fetcher.mock.calls.filter(call => String(call[0]).includes('/foods/search'))).toHaveLength(1);
});

it('keeps a completed selector chunk when another chunk stalls until cancellation', async () => {
  const controller = new AbortController();
  let ready!: () => void;
  const detailed = new Promise<void>(resolve => { ready = resolve; });
  const fetcher = jest.fn(async (url: string | URL | Request, options?: RequestInit) => {
    const address = String(url);
    if (address.includes('/connect/token')) return accessToken();
    if (address.includes('/foods/search')) return search([food(1, 'Apple')]);
    if (address.includes('/responses')) {
      const input = JSON.parse(JSON.parse(String(options?.body)).input);
      return input[0].index === 0 ? new Promise<Response>(() => undefined) : response([choose(19, 'fatsecret:1')]);
    }
    ready();
    return details(food(1, 'Apple'));
  });
  const result = resolveAutomatically(Array(20).fill('apple'), Array(20).fill({}), deps(fetcher), controller.signal);
  await detailed;
  await new Promise(resolve => setTimeout(resolve, 0));
  controller.abort(new DOMException('Meal deadline.', 'TimeoutError'));
  const results = await result;
  expect(results).toHaveLength(20);
  expect(results[19].match?.id).toBe('fatsecret:1');
  expect(results.slice(0, 19).every(item => item.failure?.stage === 'selection' && item.failure.code === 'timeout')).toBe(true);
});

it('isolates duplicate or missing selector rows to their own ingredient', async () => {
  const fetcher = jest.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (address.includes('/connect/token')) return accessToken();
    if (address.includes('/foods/search')) return search([food(1, 'Apple'), food(2, 'Carrot')]);
    if (address.includes('/responses')) return response([choose(0, 'fatsecret:1'), choose(1, 'fatsecret:2'), choose(1, 'fatsecret:2')]);
    return details(food(1, 'Apple'));
  });
  const results = await resolveAutomatically(['apple', 'carrot', 'apple'], [{}, {}, {}], deps(fetcher), new AbortController().signal);
  expect(results[0].match?.id).toBe('fatsecret:1');
  expect(results[1].failure?.code).toBe('invalid_response');
  expect(results[2].failure?.code).toBe('invalid_response');
  expect(results.map(item => item.query)).toEqual(['apple', 'carrot', 'apple']);
});

it('distinguishes a real no-match from a provider failure', async () => {
  const fetcher = jest.fn(async (url: string | URL | Request) => String(url).includes('/connect/token') ? accessToken()
    : String(url).includes('/responses') ? response([choose(0, null)]) : search([]));
  const results = await resolveAutomatically(['apple'], [{}], deps(fetcher), new AbortController().signal);
  expect(results[0].match).toBeNull();
  expect(results[0].failure).toBeUndefined();
});

it('does not cache a failed food detail and recovers it on the next meal request', async () => {
  let fail = true;
  let detailCalls = 0;
  const fetcher = jest.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (address.includes('/connect/token')) return accessToken();
    if (address.includes('/foods/search')) return search([food(1, 'Apple')]);
    if (address.includes('/responses')) return response([choose(0, 'fatsecret:1')]);
    detailCalls++;
    return fail ? new Response('{}', { status: 400 }) : details(food(1, 'Apple'));
  });
  const dependencies = deps(fetcher);
  const first = await resolveAutomatically(['apple'], [{}], dependencies, new AbortController().signal);
  fail = false;
  const second = await resolveAutomatically(['apple'], [{}], dependencies, new AbortController().signal);
  expect(first[0].failure?.stage).toBe('details');
  expect(second[0].match?.id).toBe('fatsecret:1');
  expect(second[0].failure).toBeUndefined();
  expect(detailCalls).toBe(2);
});

it('preserves healthy nutrition after another ingredient exhausts its temporary-error retries', async () => {
  let carrotCalls = 0;
  const fetcher = jest.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (address.includes('/connect/token')) return accessToken();
    if (address.includes('/foods/search')) return search([food(1, 'Apple'), food(2, 'Carrot')]);
    if (address.includes('/responses')) return response([choose(0, 'fatsecret:1'), choose(1, 'fatsecret:2')]);
    if (new URL(address).searchParams.get('food_id') === '1') return details(food(1, 'Apple'));
    carrotCalls++;
    return new Response('{}', { status: 503, headers: { 'Retry-After': '0' } });
  });
  const results = await resolveAutomatically(['apple', 'carrot'], [{}, {}], deps(fetcher), new AbortController().signal);
  expect(results[0].match?.nutrients.calories).toBe(150);
  expect(results[1].failure).toEqual({ stage: 'details', code: 'temporary', retryable: true, attempts: 3 });
  expect(results[1].candidates).toContainEqual(expect.objectContaining({ id: 'fatsecret:2' }));
  expect(carrotCalls).toBe(3);
});
