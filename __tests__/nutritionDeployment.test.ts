// eslint-disable-next-line @typescript-eslint/no-require-imports
const { checkNutritionDeployment } = require('../scripts/check-nutrition-deployment.cjs');

const configuration = { url: 'https://test.supabase.co', key: 'public-key', accessToken: 'private-user-token' };
const metadata = { lookupVersion: 'fatsecret-reference-v1', retrievalVersion: 'serving-details-v2', resilienceVersion: 'ingredient-failures-v1', referenceSource: 'fatsecret', configured: true };
const reference = { id: 'fatsecret:123', source: 'fatsecret' };
const response = (body: unknown) => new Response(JSON.stringify(body));

it('rejects the previously deployed provider before running a food lookup', async () => {
  const fetcher = jest.fn().mockResolvedValue(response({ metadata: {
    lookupVersion: 'catalog-reference-v3', referenceSource: 'live',
  } }));
  await expect(checkNutritionDeployment(configuration, fetcher)).rejects.toThrow('deployed nutrition-lookup is outdated');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('rejects missing FatSecret configuration before consuming provider quota', async () => {
  const fetcher = jest.fn().mockResolvedValue(response({ metadata: { ...metadata, configured: false } }));
  await expect(checkNutritionDeployment(configuration, fetcher)).rejects.toThrow('FATSECRET_CLIENT_ID');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('rejects FatSecret deployments that still discard per-serving search records', async () => {
  const fetcher = jest.fn().mockResolvedValue(response({ metadata: { ...metadata, retrievalVersion: undefined } }));
  await expect(checkNutritionDeployment(configuration, fetcher)).rejects.toThrow('deployed nutrition-lookup is outdated');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('rejects a deployment without per-ingredient failure handling', async () => {
  const fetcher = jest.fn().mockResolvedValue(response({ metadata: { ...metadata, resilienceVersion: undefined } }));
  await expect(checkNutritionDeployment(configuration, fetcher)).rejects.toThrow('deployed nutrition-lookup is outdated');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([
  { match: { id: 'other:123', source: 'other' }, candidates: [] },
  { match: { ...reference, id: 'other:123' }, candidates: [] },
  { match: reference, candidates: [{ id: 'other:456', source: 'other' }] },
])('rejects mixed or unexpected provider references: %j', async result => {
  const fetcher = jest.fn().mockResolvedValueOnce(response({ metadata }))
    .mockResolvedValueOnce(response({ results: [result] }));
  await expect(checkNutritionDeployment(configuration, fetcher)).rejects.toThrow('Only FatSecret references are accepted');
});

it('fails when selection returns no match even with HTTP 200', async () => {
  const fetcher = jest.fn().mockResolvedValueOnce(response({ metadata }))
    .mockResolvedValueOnce(response({ results: [{ match: null, candidates: [], reason: 'Confirm the food.' }] }));
  await expect(checkNutritionDeployment(configuration, fetcher)).rejects.toThrow('Confirm the food.');
});

it('reports provider failures from the deployed function', async () => {
  const fetcher = jest.fn().mockResolvedValueOnce(response({ metadata }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'FatSecret rejected the server IP address.' }), { status: 503 }));
  await expect(checkNutritionDeployment(configuration, fetcher)).rejects.toThrow('HTTP 503): FatSecret rejected the server IP address');
});

it('passes only after a live resolve returns FatSecret matches and candidates', async () => {
  const results = [{ query: 'cooked buckwheat', match: reference, candidates: [reference] }];
  const fetcher = jest.fn().mockResolvedValueOnce(response({ metadata }))
    .mockResolvedValueOnce(response({ results }));
  await expect(checkNutritionDeployment(configuration, fetcher)).resolves.toEqual({ metadata, results });
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
    mode: 'resolve', referenceSource: 'fatsecret', queries: ['cooked buckwheat'],
    contexts: [{ foodName: 'buckwheat', preparation: 'cooked' }],
  });
});
