import { alternativeSearchPhrases, compatibleCandidate, resolveAutomatically } from '../supabase/functions/nutrition-lookup/index';
import { accessToken, details, food, search } from './fixtures/fatsecret';

let sequence = 0;
const deps = (fetcher: typeof fetch) => {
  const settings: Record<string, string> = { FATSECRET_CLIENT_ID: 'client', FATSECRET_CLIENT_SECRET: 'private',
    SUPABASE_URL: 'https://search-variants-' + ++sequence + '.supabase.co',
    AZURE_OPENAI_BASE_URL: 'https://test.openai.azure.com/openai/v1', AZURE_OPENAI_API_KEY: 'private', AZURE_OPENAI_DEPLOYMENT: 'selector' };
  return { env: (name: string) => settings[name], fetch: fetcher };
};
const selection = (id: string | null) => new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ selections: [
  { index: 0, id, quality: 'approximate', reason: 'Compatible reference.', alternativeQuery: '' },
] }) }] }] }));

it.each([
  ['chocolate sauce', 'chocolate syrup', 'Chocolate Syrup'],
  ['yogurt cucumber sauce', 'tzatziki', 'Tzatziki'],
  ['broccoli cheese casserole', 'broccoli cheese', 'Broccoli Cheese Casserole'],
])('recovers %s using a bounded same-food alternative', async (query, alternative, name) => {
  let rounds = 0;
  const fetcher = jest.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (address.includes('/connect/token')) return accessToken();
    if (address.includes('/foods/search')) return search(new URL(address).searchParams.get('search_expression') === alternative ? [food(501, name)] : []);
    if (address.includes('/responses')) return selection(++rounds === 1 ? null : 'fatsecret:501');
    return details(food(501, name));
  });
  const result = await resolveAutomatically([query], [{ foodName: query }], deps(fetcher), new AbortController().signal);
  expect(result[0].match?.id).toBe('fatsecret:501');
  const searches = fetcher.mock.calls.filter(call => String(call[0]).includes('/foods/search'));
  expect(searches.length).toBeLessThanOrEqual(3);
  expect(rounds).toBe(2);
});

it('preserves raw preparation when a shorter query returns only cooked foods', async () => {
  const fetcher = jest.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (address.includes('/connect/token')) return accessToken();
    if (address.includes('/foods/search')) return search([food(502, 'Tomatoes cooked')]);
    if (address.includes('/responses')) return selection(null);
    throw new Error('Incompatible details must not be requested.');
  });
  const result = await resolveAutomatically(['tomato'], [{ foodName: 'tomato', preparation: 'raw' }], deps(fetcher), new AbortController().signal);
  expect(result[0].match).toBeNull();
  expect(result[0].candidates).toEqual([]);
});

it('recognizes sweet-sauce and yogurt-sauce aliases without allowing other sauce families', () => {
  expect(compatibleCandidate('chocolate sauce', 'Chocolate Syrup')).toBe(true);
  expect(compatibleCandidate('chocolate sauce', 'Caramel Syrup')).toBe(false);
  expect(compatibleCandidate('tomato sauce', 'Chocolate Syrup')).toBe(false);
  expect(compatibleCandidate('yogurt cucumber sauce', 'Tzatziki')).toBe(true);
  expect(alternativeSearchPhrases('cooked broccoli cheese casserole')).toHaveLength(2);
});

it('keeps broccoli casserole records whose complete recipe name includes sauce', () => {
  expect(compatibleCandidate('broccoli cheese casserole', 'Broccoli Casserole (Broccoli, Rice, Cheese and Mushroom Sauce)', { representation: 'whole_dish' })).toBe(true);
  expect(compatibleCandidate('broccoli cheese casserole', 'Cheeseburger Casserole', { representation: 'whole_dish' })).toBe(false);
  expect(compatibleCandidate('broccoli cheese casserole', 'Cooked Broccoli with Cheese Sauce', { representation: 'whole_dish' })).toBe(false);
});

it('uses same-family alternatives supplied by vision when a generic grain search fails', async () => {
  let rounds = 0;
  const fetcher = jest.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (address.includes('/connect/token')) return accessToken();
    if (address.includes('/foods/search')) return search(new URL(address).searchParams.get('search_expression') === 'barley cooked' ? [food(503, 'Pearled Barley Cooked')] : []);
    if (address.includes('/responses')) return selection(++rounds === 1 ? null : 'fatsecret:503');
    return details(food(503, 'Pearled Barley Cooked'));
  });
  const result = await resolveAutomatically(['Cooked grains'], [{ foodName: 'Cooked grains', preparation: 'cooked',
    identityAlternatives: ['barley', 'wheat berries'], nutritionIdentityKnown: false }], deps(fetcher), new AbortController().signal);
  expect(result[0].match?.id).toBe('fatsecret:503');
  expect(result[0].match?.matchQuality).toBe('approximate');
});

it('does not crowd a recovered vision-supported alternative out of a full candidate list', async () => {
  let rounds = 0;
  const fetcher = jest.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (address.includes('/connect/token')) return accessToken();
    if (address.includes('/foods/search')) {
      const phrase = new URL(address).searchParams.get('search_expression');
      return search(phrase === 'barley cooked' ? [food(599, 'Pearled Barley Cooked')] : Array.from({ length: 25 }, (_, i) => food(600 + i, 'Cooked grain rice ' + i)));
    }
    if (address.includes('/responses')) return selection(++rounds === 1 ? null : 'fatsecret:599');
    return details(food(599, 'Pearled Barley Cooked'));
  });
  const result = await resolveAutomatically(['Cooked grains'], [{ foodName: 'Cooked grains', preparation: 'cooked',
    identityAlternatives: ['barley', 'wheat berries'], identityUncertain: true }], deps(fetcher), new AbortController().signal);
  expect(result[0].match?.id).toBe('fatsecret:599');
});
