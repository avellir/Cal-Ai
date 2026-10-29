import { httpFailure, LookupError, retryAfterMs, withRetries } from './resilience.ts';

export type Json = Record<string, unknown>;
export type Reference = {
  id: string; name: string; source: 'fatsecret'; sourceUrl?: string;
  basisAmount: number; basisUnit: 'g' | 'ml' | 'serving';
  nutrients: { calories: number; protein: number; carbs: number; fat: number };
  servings: { name: string; grams: number; volumeMl?: number }[]; recipeAverage: boolean;
  matchQuality?: 'exact' | 'approximate'; matchReason?: string;
};
export type Dependencies = { env: (key: string) => string | undefined; fetch: typeof fetch };
const object = (value: unknown): value is Json => !!value && typeof value === 'object' && !Array.isArray(value);
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : object(value) ? [value] : [];
const number = (value: unknown): number | null => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const recipe = (name: string) => /\b(soup|broth|sauce|pancakes?|curry|salad|recipe|sandwich|pizza|borscht|casserole|gratin)\b/i.test(name);
function identity(food: Json): Pick<Reference, 'id' | 'name' | 'source' | 'sourceUrl' | 'recipeAverage'> | null {
  if (!/^\d{1,20}$/.test(String(food.food_id)) || typeof food.food_name !== 'string' || !food.food_name.trim()) return null;
  const sourceUrl = typeof food.food_url === 'string' && /^https:\/\/(?:[a-z0-9-]+\.)*fatsecret\.com\//i.test(food.food_url) ? food.food_url : undefined;
  return { id: `fatsecret:${food.food_id}`, name: food.food_name, source: 'fatsecret', sourceUrl, recipeAverage: recipe(food.food_name) };
}

// A provider may document a volume in the serving description alongside metric grams.
function explicitVolume(description: string): { volumeMl?: number } {
  const match = description.match(/^(\d+(?:\.\d+)?)\s*(ml|milliliters?|millilitres?|l|liters?|litres?)$/i);
  if (!match || Number(match[1]) <= 0) return {};
  return { volumeMl: Number(match[1]) * (/^(l|liter|litre)/i.test(match[2]) ? 1000 : 1) };
}

/** Provider nutrients describe the entire serving, not necessarily 100 g. */
export function toReference(value: unknown): Reference | null {
  if (!object(value)) return null;
  const food = object(value.food) ? value.food : value;
  const base = identity(food);
  if (!base || !object(food.servings)) return null;
  const complete = list(food.servings.serving).filter(object).flatMap(serving => {
    const calories = number(serving.calories), protein = number(serving.protein);
    const carbs = number(serving.carbohydrate), fat = number(serving.fat);
    if (calories === null || protein === null || carbs === null || fat === null) return [];
    const metric = number(serving.metric_serving_amount);
    const unit = String(serving.metric_serving_unit).toLowerCase();
    const amount = metric !== null && metric > 0 ? metric : null;
    const grams = amount && (unit === 'g' ? amount : unit === 'oz' ? amount * 28.349523125 : null);
    return [{ serving, nutrients: { calories, protein, carbs, fat }, grams, volume: amount && unit === 'ml' ? amount : null }];
  });
  const selected = complete.find(item => item.grams === 100) ?? complete.find(item => item.grams) ??
    complete.find(item => item.volume === 100) ?? complete.find(item => item.volume) ?? complete[0];
  if (!selected) return null;
  const metricAmount = selected.grams ?? selected.volume;
  const scale = metricAmount ? 100 / metricAmount : 1;
  const nutrients = Object.fromEntries(Object.entries(selected.nutrients).map(([key, amount]) => [key, amount * scale])) as Reference['nutrients'];
  if (Object.values(nutrients).some(amount => !Number.isFinite(amount))) return null;
  return { ...base, basisAmount: metricAmount ? 100 : 1,
    basisUnit: selected.grams ? 'g' : selected.volume ? 'ml' : 'serving', nutrients,
    servings: complete.flatMap(item => item.grams && typeof item.serving.serving_description === 'string'
      ? [{ name: item.serving.serving_description, grams: item.grams,
        ...explicitVolume(item.serving.serving_description) }] : []),
  };
}

/** Basic search supplies a summary; the selected food is always loaded by ID. */
export function toSearchReference(value: unknown): Reference | null {
  if (!object(value) || value.food_type !== 'Generic' || typeof value.food_description !== 'string') return null;
  const base = identity(value);
  if (!base) return null;
  const description = value.food_description;
  const amount = description.match(/^Per\s+(\d+(?:\.\d+)?)\s*(g|ml)\s*-/i);
  const nutrient = (label: string, unit: string) => number(description.match(new RegExp(`\\b${label}:\\s*(\\d+(?:\\.\\d+)?)\\s*${unit}\\b`, 'i'))?.[1]);
  const calories = nutrient('Calories', 'kcal'), protein = nutrient('Protein', 'g');
  const carbs = nutrient('Carbs', 'g'), fat = nutrient('Fat', 'g');
  if (!amount || Number(amount[1]) <= 0 || calories === null || protein === null || carbs === null || fat === null) return null;
  const scale = 100 / Number(amount[1]);
  const nutrients = { calories: calories * scale, protein: protein * scale, carbs: carbs * scale, fat: fat * scale };
  if (Object.values(nutrients).some(value => !Number.isFinite(value))) return null;
  return { ...base, basisAmount: 100, basisUnit: amount[2].toLowerCase() as 'g' | 'ml', nutrients, servings: [] };
}

export class FatSecretError extends LookupError {}

type Token = { value: string; expires: number };
// Scope caches to the injected transport as well as credentials (also isolates tests).
const tokens = new WeakMap<typeof fetch, Map<string, Promise<Token>>>();
export function getFatSecretAuthMode(deps: Dependencies): 'oauth1' | 'oauth2' | null {
  if (deps.env('FATSECRET_CONSUMER_KEY')?.trim() || deps.env('FATSECRET_CONSUMER_SECRET')?.trim()) return 'oauth1';
  if (deps.env('FATSECRET_CLIENT_ID')?.trim() || deps.env('FATSECRET_CLIENT_SECRET')?.trim()) return 'oauth2';
  return null;
}
export function isFatSecretConfigured(deps: Dependencies): boolean {
  const names = getFatSecretAuthMode(deps) === 'oauth1'
    ? ['FATSECRET_CONSUMER_KEY', 'FATSECRET_CONSUMER_SECRET'] : ['FATSECRET_CLIENT_ID', 'FATSECRET_CLIENT_SECRET'];
  return names.every(name => !!deps.env(name)?.trim());
}
const credentialKey = (deps: Dependencies) => `${deps.env('FATSECRET_CLIENT_ID')}:${deps.env('FATSECRET_CLIENT_SECRET')}`;
async function token(deps: Dependencies, signal: AbortSignal): Promise<string> {
  if (!isFatSecretConfigured(deps)) throw new FatSecretError('FatSecret nutrition lookup is not configured. Add its client ID and client secret in Supabase secrets.', 'configuration');
  let entries = tokens.get(deps.fetch);
  if (!entries) { entries = new Map(); tokens.set(deps.fetch, entries); }
  const key = credentialKey(deps);
  const existing = entries.get(key);
  if (existing) {
    const cached = await existing;
    if (cached.expires > Date.now()) return cached.value;
    if (entries.get(key) !== existing) return token(deps, signal);
    entries.delete(key);
  }
  const pending = withRetries(async attemptSignal => {
    const response = await deps.fetch('https://oauth.fatsecret.com/connect/token', {
      method: 'POST', signal: attemptSignal, headers: { 'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${deps.env('FATSECRET_CLIENT_ID')!.trim()}:${deps.env('FATSECRET_CLIENT_SECRET')!.trim()}`)}` },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'basic' }).toString(),
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = object(body) ? body.error : null;
      const description = object(body) && typeof body.error_description === 'string' ? body.error_description : '';
      const message = object(error) && typeof error.message === 'string' ? error.message : description;
      if (object(error) && String(error.code) === '21' || /\b(ip|whitelist|allowlist)\b/i.test(message)) {
        throw new FatSecretError('FatSecret rejected the server IP address. Configure IP restrictions in the FatSecret developer portal.', 'authentication');
      }
      if (error === 'invalid_client') {
        throw new FatSecretError('FatSecret rejected the OAuth 2.0 client credentials. Check the matching client ID and client secret in Supabase secrets and the allowed server IP addresses.', 'authentication');
      }
      if (error === 'invalid_scope' || error === 'unauthorized_client') {
        throw new FatSecretError('FatSecret rejected OAuth access. Check this application has client-credentials access to the basic scope.', 'authentication');
      }
      throw httpFailure(response, `FatSecret authentication is unavailable (HTTP ${response.status}). Check the OAuth 2.0 credentials and allowed server IP addresses.`);
    }
    if (!object(body) || typeof body.access_token !== 'string' || !body.access_token || !number(body.expires_in)) throw new FatSecretError('FatSecret authentication is unavailable.', 'invalid_response');
    return { value: body.access_token, expires: Date.now() + Math.max(0, Number(body.expires_in) - 60) * 1000 };
  }, signal);
  entries.set(key, pending);
  try { return (await pending).value; } catch (error) { entries.delete(key); throw error; }
}

const encodeOAuth = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, character =>
  `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

/** Signed app-level requests; no user token or OAuth 2.0 token exchange. */
async function oauth1Request(path: 'foods/search/v1' | 'food/v5', params: Record<string, string>, deps: Dependencies, signal: AbortSignal): Promise<Json> {
  return withRetries(async attemptSignal => {
    const endpoint = 'https://platform.fatsecret.com/rest/server.api';
    const query = new URLSearchParams({ ...params, format: 'json',
      method: path === 'foods/search/v1' ? 'foods.search' : 'food.get.v5',
      oauth_consumer_key: deps.env('FATSECRET_CONSUMER_KEY')!.trim(),
      oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: String(Math.floor(Date.now() / 1000)),
      oauth_nonce: crypto.randomUUID().replace(/-/g, ''), oauth_version: '1.0',
    });
    const entries = [...query.entries()].map(([key, value]) => [encodeOAuth(key), encodeOAuth(value)]);
    entries.sort(([keyA, valueA], [keyB, valueB]) => keyA < keyB ? -1 : keyA > keyB ? 1 : valueA < valueB ? -1 : valueA > valueB ? 1 : 0);
    const normalized = entries.map(([key, value]) => `${key}=${value}`).join('&');
    const base = ['GET', endpoint, normalized].map(encodeOAuth).join('&');
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(`${encodeOAuth(deps.env('FATSECRET_CONSUMER_SECRET')!.trim())}&`),
      { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(base));
    query.set('oauth_signature', btoa(Array.from(new Uint8Array(signature), byte => String.fromCharCode(byte)).join('')));
    const response = await deps.fetch(`${endpoint}?${query}`, { signal: attemptSignal, redirect: 'error' });
    const body: unknown = await response.json().catch(() => null);
    return validateProviderResponse(body, response, true);
  }, signal);
}

function validateProviderResponse(body: unknown, response: Response, oauth1 = false): Json {
  const code = object(body) && object(body.error) ? String(body.error.code) : null;
  if (code === '5' || code === '8' || code === '9') throw new FatSecretError('FatSecret rejected the OAuth 1.0 credentials or signature. Check the matching consumer key and consumer secret in Supabase secrets.', 'authentication');
  if (code === '6' || code === '7') throw new FatSecretError('FatSecret rejected the request timestamp or nonce. Please try again.', 'authentication');
  if (code === '21') throw new FatSecretError('FatSecret rejected the server IP address. Configure IP restrictions in the FatSecret developer portal.', 'authentication');
  if (code === '14') throw new FatSecretError('FatSecret access is unavailable. Check the API permissions for this application.', 'authentication');
  if (code === '11') throw new FatSecretError('FatSecret request limit reached. Please try again later.', 'quota');
  if (code === '12' || code === '20' || code === '24') throw new FatSecretError('FatSecret nutrition lookup is temporarily unavailable. Please try again later.', 'temporary', true, retryAfterMs(response));
  if (!response.ok) throw httpFailure(response, oauth1
    ? `FatSecret OAuth 1.0 lookup is unavailable (HTTP ${response.status}). Check the consumer key and consumer secret.`
    : 'FatSecret nutrition lookup is unavailable. Please try again.');
  if (code || !object(body)) throw new FatSecretError('FatSecret nutrition lookup is unavailable. Please try again.', 'invalid_response');
  return body;
}

export async function fatSecretRequest(path: 'foods/search/v1' | 'food/v5', params: Record<string, string>, deps: Dependencies, signal: AbortSignal): Promise<Json> {
  if (!isFatSecretConfigured(deps)) throw new FatSecretError('FatSecret nutrition lookup is not configured. Add the matching consumer key and consumer secret in Supabase secrets.', 'configuration');
  if (getFatSecretAuthMode(deps) === 'oauth1') return oauth1Request(path, params, deps, signal);
  for (let attempt = 0; attempt < 2; attempt++) {
    const accessToken = await token(deps, signal);
    const body = await withRetries(async attemptSignal => {
      const query = new URLSearchParams({ ...params, format: 'json' });
      const response = await deps.fetch(`https://platform.fatsecret.com/rest/${path}?${query}`, {
        signal: attemptSignal, headers: { Authorization: `Bearer ${accessToken}` },
      });
      const value: unknown = await response.json().catch(() => null);
      if (response.status === 401 || object(value) && object(value.error) && String(value.error.code) === '13') return { error: { code: '13' } };
      return validateProviderResponse(value, response);
    }, signal);
    if (object(body.error) && String(body.error.code) === '13') {
      tokens.get(deps.fetch)?.delete(credentialKey(deps));
      if (attempt === 0) continue;
      throw new FatSecretError('FatSecret authentication is unavailable. Check the server credentials.', 'authentication');
    }
    return body;
  }
  throw new FatSecretError('FatSecret authentication is unavailable.');
}

/** Rank identities before spending detail calls on short, incomplete summaries. */
export function referenceNameScore(query: string, name: string): number {
  const words = (value: string) => new Set(value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/)
    .map(word => word.endsWith('ies') ? word.slice(0, -3) + 'y' : /^(tomatoes|potatoes)$/.test(word) ? word.slice(0, -2) : word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word)
    .filter(word => word && !/^(raw|fresh|cooked|plain|sliced|chopped|the|a|an|and|with|of)$/.test(word)));
  const requested = words(query), returned = words(name);
  const overlap = [...requested].filter(word => returned.has(word)).length;
  return overlap / Math.max(1, requested.size + returned.size - overlap);
}

export async function searchFatSecret(query: string, deps: Dependencies, signal: AbortSignal): Promise<Reference[]> {
  const body = await fatSecretRequest('foods/search/v1', { search_expression: query, max_results: '50', page_number: '0' }, deps, signal);
  const candidates = [...new Map((object(body.foods) ? list(body.foods.food) : []).filter(object)
    .filter(food => food.food_type === 'Generic').flatMap(food => {
      const record = identity(food);
      return record ? [[record.id, { id: record.id, name: record.name, summary: toSearchReference(food) }] as const] : [];
    })).values()].sort((a, b) => referenceNameScore(query, b.name) - referenceNameScore(query, a.name));
  // Piece/cup summaries are not a metric nutrition basis. Recover documented
  // servings from details instead of dropping the food or inventing its mass.
  const missing = candidates.filter(candidate => !candidate.summary).slice(0, 6);
  const recovered = new Map<string, Reference>();
  const failures: unknown[] = [];
  for (let index = 0; index < missing.length; index += 2) {
    await Promise.all(missing.slice(index, index + 2).map(async candidate => {
      try {
        const reference = await getFatSecretReference(candidate.id, deps, signal);
        if (reference) recovered.set(candidate.id, reference);
      } catch (error) {
        if (signal.aborted) throw error;
        failures.push(error);
      }
    }));
  }
  const references = candidates.map(candidate => candidate.summary ?? recovered.get(candidate.id))
    .filter((reference): reference is Reference => !!reference);
  if (!references.length && failures.length) throw failures[0];
  return references;
}

const detailCache = new WeakMap<typeof fetch, Map<string, { expires: number; reference: Reference }>>();
const detailRequests = new WeakMap<typeof fetch, WeakMap<AbortSignal, Map<string, Promise<Reference | null>>>>();
export async function getFatSecretReference(id: string, deps: Dependencies, signal: AbortSignal): Promise<Reference | null> {
  if (!/^fatsecret:\d{1,20}$/.test(id)) return null;
  const key = JSON.stringify([getFatSecretAuthMode(deps), deps.env('FATSECRET_CONSUMER_KEY'), deps.env('FATSECRET_CONSUMER_SECRET'),
    deps.env('FATSECRET_CLIENT_ID'), deps.env('FATSECRET_CLIENT_SECRET'), id]);
  let cache = detailCache.get(deps.fetch);
  if (!cache) { cache = new Map(); detailCache.set(deps.fetch, cache); }
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.reference;
  // Share only within the same request signal: another user's cancellation
  // must not cancel this request's provider lookup.
  let transportRequests = detailRequests.get(deps.fetch);
  if (!transportRequests) { transportRequests = new WeakMap(); detailRequests.set(deps.fetch, transportRequests); }
  let requests = transportRequests.get(signal);
  if (!requests) { requests = new Map(); transportRequests.set(signal, requests); }
  const existing = requests.get(key);
  if (existing) return existing;
  const pending = (async () => {
    const body = await fatSecretRequest('food/v5', { food_id: id.replace(/^fatsecret:/, '') }, deps, signal);
    const reference = toReference(body);
    if (reference?.id !== id) return null;
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + 3_600_000, reference });
    return reference;
  })();
  requests.set(key, pending);
  try { return await pending; } finally { requests.delete(key); }
}
