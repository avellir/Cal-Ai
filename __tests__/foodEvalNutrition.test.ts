// eslint-disable-next-line @typescript-eslint/no-require-imports
const { lookupNutrition } = require('../scripts/food-eval-nutrition.cjs');

it('preserves the deployed function HTTP status and error instead of suggesting a missing provider credential', async () => {
  const client = { functions: { invoke: jest.fn().mockResolvedValue({
    data: null, error: { message: 'Edge Function returned a non-2xx status code',
      context: new Response(JSON.stringify({ error: 'Invalid mode.' }), { status: 400 }) },
  }) } };
  await expect(lookupNutrition(client, ['rice'], [{ foodName: 'rice' }])).rejects.toThrow(
    'Nutrition lookup failed (HTTP 400): Invalid mode.',
  );
  expect(client.functions.invoke.mock.calls[0][1].body.mode).toBe('resolve');
});

it('reports malformed successful responses separately from request failures', async () => {
  const client = { functions: { invoke: jest.fn().mockResolvedValue({ data: {}, error: null }) } };
  await expect(lookupNutrition(client, ['rice'], [{}])).rejects.toThrow('Invalid nutrition response: expected results array.');
});

it('retains transport errors when no HTTP response exists', async () => {
  const client = { functions: { invoke: jest.fn().mockResolvedValue({ data: null, error: new Error('Failed to fetch') }) } };
  await expect(lookupNutrition(client, ['rice'], [{}])).rejects.toThrow('Nutrition lookup failed: Failed to fetch');
});

it('keeps ordered resolve results for repeated food names with different contexts', async () => {
  const results = [{ query: 'rice', match: { id: 'raw' } }, { query: 'rice', match: { id: 'cooked' } }];
  const client = { functions: { invoke: jest.fn().mockResolvedValue({ data: { results }, error: null }) } };
  await expect(lookupNutrition(client, ['rice', 'rice'], [{ preparation: 'raw' }, { preparation: 'cooked' }])).resolves.toEqual(results);
});

it('requests the fatsecret source explicitly without changing ordinary evaluation requests', async () => {
  const client = { functions: { invoke: jest.fn().mockResolvedValue({ data: { results: [] }, error: null }) } };
  await lookupNutrition(client, ['hummus'], [{}], 'fatsecret');
  expect(client.functions.invoke.mock.calls[0][1].body.referenceSource).toBe('fatsecret');
  await lookupNutrition(client, ['hummus'], [{}]);
  expect(client.functions.invoke.mock.calls[1][1].body).not.toHaveProperty('referenceSource');
});
