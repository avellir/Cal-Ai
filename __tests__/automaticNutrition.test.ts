import { compatibleCandidate, resolveAutomatically, searchPhrase } from '../supabase/functions/nutrition-lookup/index';

const record = (id: number, name: string, calories = 150) => ({
  fdcId: id, description: name, foodNutrients: [
    { nutrientId: 1008, unitName: 'KCAL', value: calories },
    { nutrientId: 1003, unitName: 'G', value: 20 },
    { nutrientId: 1004, unitName: 'G', value: 5 },
    { nutrientId: 1005, unitName: 'G', value: 6 },
  ],
});
const azure = (selections: unknown[]) => new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ selections }) }] }] }));
const selection = (index: number, id: string | null, alternativeQuery = '') => ({ index, id, alternativeQuery, quality: 'approximate', reason: 'Typical compatible preparation.' });
let run = 0;
function setup(fetcher: typeof fetch) {
  const env: Record<string, string> = {
    USDA_API_KEY: 'private', SUPABASE_URL: 'https://case' + ++run + '.supabase.co',
    AZURE_OPENAI_BASE_URL: 'https://test.openai.azure.com/openai/v1', AZURE_OPENAI_API_KEY: 'private-azure', AZURE_OPENAI_DEPLOYMENT: 'model',
  };
  return { env: (name: string) => env[name], fetch: fetcher };
}

it.each([
  ['sliced cooked pork', 'Bratwurst, pork, cooked'],
  ['cooked chicken breast', 'Chicken breast tenders, breaded, cooked, microwaved'],
  ['lime slice', 'Lime souffle'],
  ['orange juice', 'Babyfood, juice, orange'],
  ['cooked carrot', 'Carrots, glazed, cooked'],
  ['raw lettuce', 'Lettuce, cooked'],
  ['cooked rice', 'Rice, raw'],
])('rejects the incompatible substitution %s -> %s', (query, name) => {
  expect(compatibleCandidate(query, name)).toBe(false);
});

it('preserves legitimate prepared foods and fresh produce rather than excluding all raw entries', () => {
  expect(compatibleCandidate('lettuce', 'Lettuce, raw')).toBe(true);
  expect(compatibleCandidate('breaded chicken', 'Chicken tenders, breaded, cooked')).toBe(true);
  expect(compatibleCandidate('lime souffle', 'Lime souffle')).toBe(true);
  expect(searchPhrase('fresh mozzarella (torn)')).toBe('fresh mozzarella');
  expect(searchPhrase('bread slice (2)')).toBe('bread slice');
  expect(searchPhrase('salad lettuce', { foodName: 'lettuce', preparation: 'raw' })).toBe('lettuce raw');
});

it('selects automatically without changing the dish and obtains nutrients from USDA details', async () => {
  const fetcher = jest.fn(async (url: string | URL | Request, options?: RequestInit) => {
    if (String(url).includes('/foods/search')) return new Response(JSON.stringify({ foods: [record(1, 'Chicken breast, cooked'), record(2, 'Breaded chicken breast')] }));
    if (String(url).includes('/responses')) {
      const input = JSON.parse(JSON.parse(String(options?.body)).input);
      expect(input[0].context.dishName).toBe('Chicken soup');
      expect(input[0].candidates.map((item: { id: string }) => item.id)).toEqual(['usda:1']);
      return azure([selection(0, 'usda:1')]);
    }
    return new Response(JSON.stringify(record(1, 'Chicken breast, cooked', 165)));
  });
  const result = await resolveAutomatically(['cooked chicken breast'], [{ dishName: 'Chicken soup', preparation: 'cooked' }], setup(fetcher), new AbortController().signal);
  expect(result[0].query).toBe('cooked chicken breast');
  expect(result[0].match?.nutrients.calories).toBe(165);
  expect(result[0].match?.source).toBe('usda');
  expect(result[0].match?.matchQuality).toBe('approximate');
});

it('retries an equivalent food search automatically when the original phrase has no candidates', async () => {
  let calls = 0;
  const fetcher = jest.fn(async (url: string | URL | Request, options?: RequestInit) => {
    if (String(url).includes('/foods/search')) {
      const query = JSON.parse(String(options?.body)).query;
      return new Response(JSON.stringify({ foods: query === 'fish cake' ? [record(4, 'Fish cake, cooked')] : [] }));
    }
    if (String(url).includes('/responses')) return azure([++calls === 1 ? selection(0, null, 'fish cake') : selection(0, 'usda:4')]);
    return new Response(JSON.stringify(record(4, 'Fish cake, cooked')));
  });
  const result = await resolveAutomatically(['narutomaki fish cake'], [{ dishName: 'Ramen' }], setup(fetcher), new AbortController().signal);
  expect(calls).toBe(2);
  expect(result[0].match?.id).toBe('usda:4');
});

it('rejects hallucinated IDs and never requests them from USDA', async () => {
  const fetcher = jest.fn(async (url: string | URL | Request) => String(url).includes('/foods/search')
    ? new Response(JSON.stringify({ foods: [record(5, 'Apple, raw')] })) : azure([selection(0, 'usda:99999999')]));
  const result = await resolveAutomatically(['apple'], [], setup(fetcher), new AbortController().signal);
  expect(result[0].match).toBeNull();
  expect(fetcher.mock.calls.some(call => String(call[0]).includes('/food/99999999'))).toBe(false);
});

it('does not confuse identical labels from regions with different preparations', async () => {
  const fetcher = jest.fn(async (url: string | URL | Request) => {
    if (String(url).includes('/foods/search')) return new Response(JSON.stringify({ foods: [record(6, 'Carrot, raw'), record(7, 'Carrot, cooked')] }));
    if (String(url).includes('/responses')) return azure([selection(1, 'usda:7'), selection(0, 'usda:6')]);
    return new Response(JSON.stringify(String(url).includes('/food/6?') ? record(6, 'Carrot, raw') : record(7, 'Carrot, cooked')));
  });
  const result = await resolveAutomatically(['carrot', 'carrot'], [{ preparation: 'raw' }, { preparation: 'cooked' }], setup(fetcher), new AbortController().signal);
  expect(result.map(item => item.match?.id)).toEqual(['usda:6', 'usda:7']);
});

it('fails cleanly when the automatic selector is unavailable instead of guessing nutrients', async () => {
  const fetcher = jest.fn(async (url: string | URL | Request) => String(url).includes('/foods/search')
    ? new Response(JSON.stringify({ foods: [record(8, 'Apple, raw')] })) : new Response('{}', { status: 429 }));
  await expect(resolveAutomatically(['apple'], [], setup(fetcher), new AbortController().signal)).rejects.toThrow('unavailable');
});
