import { fatSecretRequest } from '../supabase/functions/nutrition-lookup/fatsecret';
import { httpFailure, LookupError, retryAfterMs, withRetries } from '../supabase/functions/nutrition-lookup/resilience';
import { accessToken, details, food } from './fixtures/fatsecret';

afterEach(() => jest.useRealTimers());

it('recovers a transient connection failure with at most two retries', async () => {
  jest.useFakeTimers();
  const operation = jest.fn().mockRejectedValueOnce(new TypeError('private network diagnostic')).mockResolvedValue('recovered');
  const result = withRetries(operation, new AbortController().signal);
  await jest.runAllTimersAsync();
  await expect(result).resolves.toBe('recovered');
  expect(operation).toHaveBeenCalledTimes(2);
  expect(jest.getTimerCount()).toBe(0);
});

it('stops after three attempts and reports exhaustion without leaking connection diagnostics', async () => {
  jest.useFakeTimers();
  const operation = jest.fn().mockRejectedValue(new TypeError('private network diagnostic'));
  const result = expect(withRetries(operation, new AbortController().signal)).rejects.toMatchObject({ code: 'temporary', retryable: true, attempts: 3 });
  await jest.runAllTimersAsync();
  await result;
  expect(operation).toHaveBeenCalledTimes(3);
  expect(jest.getTimerCount()).toBe(0);
});

it('shares a six-retry ceiling across operations for one meal', async () => {
  jest.useFakeTimers();
  const counts: number[] = [];
  const signal = new AbortController().signal;
  const result = (async () => {
    for (let index = 0; index < 4; index++) {
      const operation = jest.fn().mockRejectedValue(new LookupError('Temporary.', 'temporary', true, 0));
      await withRetries(operation, signal).catch(() => undefined);
      counts.push(operation.mock.calls.length);
    }
  })();
  await jest.runAllTimersAsync();
  await result;
  expect(counts).toEqual([3, 3, 3, 1]);
});

it.each(['authentication', 'quota', 'configuration', 'invalid_response'] as const)('does not retry permanent %s failures', async code => {
  const operation = jest.fn().mockRejectedValue(new LookupError('Unavailable.', code));
  await expect(withRetries(operation, new AbortController().signal)).rejects.toMatchObject({ code, attempts: 1 });
  expect(operation).toHaveBeenCalledTimes(1);
});

it('honors Retry-After and stops rather than retrying earlier than a long provider delay', async () => {
  jest.useFakeTimers();
  const operation = jest.fn().mockRejectedValueOnce(httpFailure(new Response('', { status: 429, headers: { 'retry-after-ms': '1000' } }), 'Throttled.')).mockResolvedValue('ok');
  const result = withRetries(operation, new AbortController().signal);
  await jest.advanceTimersByTimeAsync(999);
  expect(operation).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  await expect(result).resolves.toBe('ok');
  const longDelay = jest.fn().mockRejectedValue(httpFailure(new Response('', { status: 503, headers: { 'Retry-After': '10' } }), 'Unavailable.'));
  await expect(withRetries(longDelay, new AbortController().signal)).rejects.toMatchObject({ attempts: 1, retryable: true });
  expect(longDelay).toHaveBeenCalledTimes(1);
  expect(retryAfterMs(new Response('', { headers: { 'Retry-After': '2' } }))).toBe(2000);
  expect(retryAfterMs(new Response('', { headers: { 'Retry-After': new Date(Date.now() + 2000).toUTCString() } }))).toBeGreaterThan(1000);
});

it('bounds each attempt even when a stalled transport ignores AbortSignal', async () => {
  jest.useFakeTimers();
  const signals: AbortSignal[] = [];
  const operation = jest.fn((signal: AbortSignal) => { signals.push(signal); return new Promise<never>(() => undefined); });
  const result = expect(withRetries(operation, new AbortController().signal, 100)).rejects.toMatchObject({ code: 'timeout', attempts: 3 });
  await jest.runAllTimersAsync();
  await result;
  expect(operation).toHaveBeenCalledTimes(3);
  expect(signals.every(signal => signal.aborted)).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

it('cancels backoff without another attempt and cleans up timers', async () => {
  jest.useFakeTimers();
  const controller = new AbortController();
  const operation = jest.fn().mockRejectedValue(new LookupError('Temporary.', 'temporary', true, 1000));
  const result = expect(withRetries(operation, controller.signal)).rejects.toMatchObject({ code: 'cancelled', retryable: false });
  await jest.advanceTimersByTimeAsync(1);
  controller.abort();
  await result;
  expect(operation).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it.each([12, 20, 24, 'http503'])('retries temporary FatSecret error %s and recovers authoritative details', async code => {
  const fetcher = jest.fn().mockResolvedValueOnce(accessToken())
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code, message: 'private diagnostic' } }), { status: code === 'http503' ? 503 : 200, headers: { 'Retry-After': '0' } }))
    .mockResolvedValueOnce(details(food(99, 'Apple')));
  const env: Record<string, string> = { FATSECRET_CLIENT_ID: 'client', FATSECRET_CLIENT_SECRET: 'private' };
  const result = await fatSecretRequest('food/v5', { food_id: '99' }, { fetch: fetcher, env: name => env[name] }, new AbortController().signal);
  expect(result.food).toEqual(expect.objectContaining({ food_id: '99' }));
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('does not retry a FatSecret application quota error even when HTTP is 429', async () => {
  const fetcher = jest.fn().mockResolvedValueOnce(accessToken()).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 11 } }), { status: 429 }));
  const env: Record<string, string> = { FATSECRET_CLIENT_ID: 'client', FATSECRET_CLIENT_SECRET: 'private' };
  await expect(fatSecretRequest('food/v5', { food_id: '99' }, { fetch: fetcher, env: name => env[name] }, new AbortController().signal))
    .rejects.toMatchObject({ code: 'quota', retryable: false, attempts: 1 });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
