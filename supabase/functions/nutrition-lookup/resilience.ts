export type FailureCode = 'temporary' | 'authentication' | 'quota' | 'configuration' | 'invalid_response' | 'unavailable' | 'timeout' | 'cancelled';
export type LookupFailure = { stage: 'search' | 'selection' | 'details'; code: FailureCode; retryable: boolean; attempts: number };

export class LookupError extends Error {
  attempts = 1;
  constructor(message: string, readonly code: FailureCode = 'unavailable', readonly retryable = false, readonly retryAfterMs?: number) {
    super(message);
  }
}

export function retryAfterMs(response: Response): number | undefined {
  const milliseconds = response.headers.get('retry-after-ms');
  if (milliseconds !== null && /^\d+(?:\.\d+)?$/.test(milliseconds)) return Number(milliseconds);
  const value = response.headers.get('retry-after');
  if (value === null) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

export function httpFailure(response: Response, message: string): LookupError {
  const temporary = [408, 429, 500, 502, 503, 504].includes(response.status);
  const code = response.status === 401 || response.status === 403 ? 'authentication' : temporary ? 'temporary' : 'unavailable';
  return new LookupError(message, code, temporary, retryAfterMs(response));
}

function aborted(signal: AbortSignal): LookupError {
  const timedOut = signal.reason?.name === 'TimeoutError';
  return new LookupError(timedOut ? 'Nutrition request deadline reached. Try again shortly.' : 'Nutrition request was cancelled.', timedOut ? 'timeout' : 'cancelled', timedOut);
}

function wait(delay: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(aborted(signal));
  if (delay === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); reject(aborted(signal)); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, delay);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

// Shared across searches, token acquisition, selector calls and details in one meal.
const budgets = new WeakMap<AbortSignal, { retries: number }>();
export async function withRetries<T>(operation: (signal: AbortSignal) => Promise<T>, signal: AbortSignal, timeoutMs = 8_000): Promise<T> {
  let budget = budgets.get(signal);
  if (!budget) { budget = { retries: 0 }; budgets.set(signal, budget); }
  for (let attempt = 0; ; attempt++) {
    if (signal.aborted) throw aborted(signal);
    const controller = new AbortController();
    let timedOut = false;
    let cancelAttempt!: () => void;
    const cancellation = new Promise<never>((_, reject) => {
      cancelAttempt = () => { controller.abort(signal.reason); reject(aborted(signal)); };
    });
    signal.addEventListener('abort', cancelAttempt, { once: true });
    let expire!: () => void;
    const expiration = new Promise<never>((_, reject) => {
      expire = () => {
        timedOut = true;
        controller.abort(new DOMException('Upstream request timed out.', 'TimeoutError'));
        reject(new LookupError('Nutrition service timed out. Try again shortly.', 'timeout', true));
      };
    });
    const timer = setTimeout(expire, timeoutMs);
    let failure: LookupError;
    try {
      return await Promise.race([operation(controller.signal), cancellation, expiration]);
    } catch (error) {
      if (signal.aborted) throw aborted(signal);
      failure = timedOut ? new LookupError('Nutrition service timed out. Try again shortly.', 'timeout', true)
        : error instanceof LookupError ? error
          : error instanceof TypeError ? new LookupError('Nutrition service connection failed. Try again shortly.', 'temporary', true)
            : new LookupError('Nutrition service returned an invalid response.', 'invalid_response');
      failure.attempts = attempt + 1;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancelAttempt);
    }
    const delay = failure.retryAfterMs ?? 250 * 2 ** attempt + Math.floor(Math.random() * 100);
    // Never shorten a provider's Retry-After to fit this interactive request.
    if (!failure.retryable || attempt >= 2 || budget.retries >= 6 || delay > 3_000) throw failure;
    budget.retries++;
    await wait(delay, signal);
  }
}

export function failureFor(stage: LookupFailure['stage'], error: unknown): { reason: string; failure: LookupFailure } {
  const known = error instanceof LookupError;
  return {
    reason: known ? error.message : `Nutrition ${stage} is unavailable. Try again shortly.`,
    failure: { stage, code: known ? error.code : 'unavailable', retryable: known ? error.retryable : false, attempts: known ? error.attempts : 1 },
  };
}
