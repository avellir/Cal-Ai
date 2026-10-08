import { handleRequest, invalidResultFields, validResult } from '../supabase/functions/analyze-food/index';

const settings: Record<string, string> = {
  SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'anon',
  AZURE_OPENAI_API_KEY: 'server-key', AZURE_OPENAI_BASE_URL: 'https://test.services.ai.azure.com/openai/v1',
  AZURE_OPENAI_DEPLOYMENT: 'gpt-5-mini',
};
const noFood = { regions: [], overallConfidence: 95, total_plate_weight_grams: 0, notes: 'No food.' };
const jpeg = '/9j/AAAAAAAAAAAA';
let id = 0;
function setup(result: unknown = noFood, status = 'completed') {
  const fetcher = jest.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: `user-${++id}` })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ status, output: [
      { type: 'reasoning', summary: [] },
      { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] },
    ] })));
  return { fetcher, deps: { env: (key: string) => settings[key], fetch: fetcher as typeof fetch } };
}
function request(body: unknown = { mode: 'analyze', base64Image: jpeg }) {
  return new Request('https://test/analyze-food', { method: 'POST', headers: { Authorization: 'Bearer user-token' }, body: JSON.stringify(body) });
}
it('requires a user token before calling any service', async () => {
  const { fetcher, deps } = setup();
  expect((await handleRequest(new Request('https://test', { method: 'POST' }), deps)).status).toBe(401);
  expect(fetcher).not.toHaveBeenCalled();
});
it('rejects expired tokens before calling Azure', async () => {
  const { fetcher, deps } = setup(); fetcher.mockReset().mockResolvedValue(new Response('{}', { status: 401 }));
  expect((await handleRequest(request(), deps)).status).toBe(401);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('handles browser preflight without authentication', async () => {
  const { deps } = setup();
  expect((await handleRequest(new Request('https://test', { method: 'OPTIONS' }), deps)).status).toBe(204);
});
it('uses server deployment, strict schema, no storage, and never returns the key', async () => {
  const { fetcher, deps } = setup();
  const res = await handleRequest(request({ mode: 'analyze', base64Image: jpeg, prompt: 'override', model: 'expensive-model' }), deps);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ result: noFood });
  const [url, options] = fetcher.mock.calls[1];
  expect(url).toBe(`${settings.AZURE_OPENAI_BASE_URL}/responses`);
  const body = JSON.parse(options.body);
  expect(body.model).toBe('gpt-5-mini'); expect(body.store).toBe(false);
  expect(body.text.format.strict).toBe(true); expect(options.headers['api-key']).toBe('server-key');
  expect(body.input[0].content[0].text).not.toBe('override');
});
it.each(['refine', 'label'])('supports %s with a server schema', async mode => {
  const result = mode === 'refine' ? { ingredients: [] } : {
    servingSize: '1 cup (240ml)', calories: null, fat: 1, carbs: 2, protein: 3, confidence: 50, notes: 'Calories unreadable', productName: '',
  };
  const { deps } = setup(result);
  const res = await handleRequest(request({ mode, base64Image: jpeg, dishLabel: 'pizza' }), deps);
  expect(res.status).toBe(200); expect(await res.json()).toEqual({ result });
});
it.each([
  { mode: 'arbitrary', base64Image: jpeg },
  { mode: 'analyze', base64Image: 'https://example.com/private' },
  { mode: 'refine', base64Image: jpeg, dishLabel: 'x'.repeat(151) },
])('rejects unsupported request %j', async body => {
  const { fetcher, deps } = setup();
  expect((await handleRequest(request(body), deps)).status).toBe(400);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('rejects a large streamed body without content-length before calling Azure', async () => {
  const { fetcher, deps } = setup();
  expect((await handleRequest(request({ mode: 'analyze', base64Image: 'a'.repeat(6_000_001) }), deps)).status).toBe(413);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('rejects incomplete output instead of repairing it', async () => {
  const { deps } = setup(noFood, 'incomplete');
  expect((await handleRequest(request(), deps)).status).toBe(502);
});
it('does not leak provider errors or retry a throttled call', async () => {
  const { fetcher, deps } = setup(); fetcher.mockReset()
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: `user-${++id}` })))
    .mockResolvedValueOnce(new Response('sensitive provider diagnostics', { status: 429 }));
  const res = await handleRequest(request(), deps);
  expect(res.status).toBe(429); expect(await res.text()).not.toContain('sensitive');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('rejects negative and nonfinite ingredient weights', () => {
  for (const weight_grams of [-1, 0, Infinity, NaN]) {
    expect(validResult({ ingredients: [{ name: 'Rice', weight_grams, confidence: 90 }] }, 'refine')).toBe(false);
  }
});

it('identifies invalid weights and bounding coordinates without leaking response text', async () => {
  const result = { ...noFood, regions: [{ description: 'private description', dishName: 'Rice', confidence: 90,
    boundingBox: { xmin: 0, ymin: 0, xmax: 1200, ymax: 1000 },
    ingredients: [{ name: 'Rice', weight_grams: 0, confidence: 90 }],
  }] };
  const { deps } = setup(result);
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const response = await handleRequest(request(), deps);
    expect(response.status).toBe(502);
    const body = await response.text();
    expect(body).toContain('regions[0].ingredients[0].weight_grams');
    expect(body).toContain('regions[0].boundingBox.xmax');
    expect(body).not.toContain('private description');
    expect(warning).toHaveBeenCalledWith(expect.any(String), { mode: 'analyze', fields: [
      'regions[0].ingredients[0].weight_grams', 'regions[0].boundingBox.xmax',
    ] });
  } finally { warning.mockRestore(); }
});

it('accepts realistic food regions and reports no invalid fields', () => {
  const result = { ...noFood, regions: [{ description: 'Rice', dishName: 'Rice', confidence: 90,
    boundingBox: { xmin: 20, ymin: 50, xmax: 900, ymax: 950 },
    ingredients: [{ name: 'Rice', weight_grams: 150, confidence: 90 }],
  }] };
  expect(validResult(result, 'analyze')).toBe(true);
  expect(invalidResultFields(result, 'analyze')).toEqual([]);
});

it('rejects reversed boxes and invalid total weights', () => {
  const reversed = { ...noFood, regions: [{ description: 'Food', dishName: 'Food', confidence: 90,
    boundingBox: { xmin: 900, ymin: 20, xmax: 100, ymax: 800 },
    ingredients: [{ name: 'Rice', weight_grams: 150, confidence: 90 }],
  }] };
  expect(validResult(reversed, 'analyze')).toBe(false);
  expect(invalidResultFields(reversed, 'analyze')).toContain('regions[0].boundingBox.width');
  expect(validResult({ ...noFood, total_plate_weight_grams: -10 }, 'analyze')).toBe(false);
});
