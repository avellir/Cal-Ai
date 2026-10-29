# FatSecret nutrition lookup

Photo recognition stays in `analyze-food`. The authenticated `nutrition-lookup` function searches FatSecret, uses the existing Azure selector to choose a compatible returned ID, and loads that food's authoritative nutrition and servings. No provider secret or OAuth token is sent to the Expo app.

## Credentials and access

1. In the [FatSecret developer portal](https://platform.fatsecret.com/), open your application's API keys. For Supabase, use **REST API OAuth 1.0 Credentials**: the Consumer Key and Consumer Secret (also called Shared Secret). The function signs food requests on the server with HMAC-SHA1; no user-profile authorization is needed for these food lookups.
2. In your Supabase project, open **Edge Functions > Secrets** and add:

   - `FATSECRET_CONSUMER_KEY`: the OAuth 1.0 Consumer Key.
   - `FATSECRET_CONSUMER_SECRET`: its matching OAuth 1.0 Consumer Secret / Shared Secret.

   Keep both server-only. Local `.env` values do not automatically become deployed Supabase secrets.
3. FatSecret documents the IP allowlist requirement for **OAuth 2.0**. Supabase Edge Functions do not provide fixed outbound IPs. Signed OAuth 1.0 food requests provide an alternative to provisioning a fixed-IP proxy; verify actual account access with the live check below. Do not enter a phone, laptop, or Supabase database IP to represent Edge Function traffic.
4. OAuth 1.0 uses `GET /rest/server.api` with signed `foods.search` and `food.get.v5` methods. It uses US results by default. International localization and Premier search features require separate account access and are not enabled here.
5. Keep the existing Azure secrets for automatic selection: `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_BASE_URL`, and `AZURE_OPENAI_DEPLOYMENT`. Optional `AZURE_OPENAI_NUTRITION_DEPLOYMENT` overrides the selector deployment.

[OAuth 1.0 signing](https://platform.fatsecret.com/docs/guides/authentication/oauth1), [FatSecret's authentication examples and OAuth 2.0 IP restrictions](https://github.com/fatsecret-group/postman-fatsecret-apis), [basic food search](https://platform.fatsecret.com/docs/v1/foods.search), [food details](https://platform.fatsecret.com/docs/v5/food.get).

### Optional OAuth 2.0 configuration

Existing OAuth 2.0 setups remain supported through `FATSECRET_CLIENT_ID` and `FATSECRET_CLIENT_SECRET`. Their token exchange requests the `basic` scope and uses `GET /rest/foods/search/v1` and `GET /rest/food/v5`. This mode requires FatSecret-approved outbound IP addresses. Use a fixed-IP proxy where required; Premier and Premier Free support CIDR ranges. [OAuth 2.0 requirements](https://platform.fatsecret.com/docs/guides/authentication/oauth2), [Supabase outbound IP guidance](https://supabase.com/kb/troubleshooting/why-supabase-edge-functions-cannot-provide-static-egress-ips-for-whitelisting).

When either OAuth 1.0 secret is present, the function selects OAuth 1.0 and requires both values; it does not silently fall back to OAuth 2.0 for an incomplete pair. The OAuth 1.0 shared secret and OAuth 2.0 client secret are separate credentials. Do not substitute one for the other.

## Deploy and verify

After setting secrets, deploy the complete function directory, including `index.ts`, `fatsecret.ts`, and `resilience.ts`:

```powershell
npx supabase functions deploy nutrition-lookup --project-ref lgozuyqviyhvcydyajzw
```

The checked-in `supabase/config.toml` sets `verify_jwt = false` because this function validates every bearer token through Supabase Auth's `/user` endpoint. Anonymous API keys alone cannot use it. Restart Expo and reload the updated app.

Metadata mode returns `lookupVersion: fatsecret-reference-v1`, `retrievalVersion: serving-details-v2`, `resilienceVersion: ingredient-failures-v1`, `referenceSource: fatsecret`, `authentication` (`oauth1`, `oauth2`, or null), `configured`, and selector deployment, without making a FatSecret request. Configuration status checks presence only; it does not prove credential or account-access validity.

Use `npm run check:nutrition` with an existing test account configured in local `FOOD_EVAL_EMAIL` / `FOOD_EVAL_PASSWORD` for an authenticated live resolve check. It first requires all three version markers above and configured secrets, then verifies that the resolved food and every candidate have FatSecret sources and IDs. An older deployed provider or an HTTP 200 response without a match fails the check. It uses normal provider quota. No schema migration is needed; saved meals are not recalculated.

## Recovering complete references

Basic food search returns summaries that can describe a piece, cup, or serving rather than grams. A summary without metric quantity or all macros no longer discards an otherwise valid Generic food ID. Search examines up to 50 records, ranks food names by relevance, and recovers detailed nutrition for at most six such IDs, with two detail requests at a time. Incomplete detailed nutrition remains unresolved. Brands remain excluded from automatic photo references.

Successful food details are cached for one hour, bounded to 256 entries per transport and scoped to credentials. Concurrent detail loads share work only within the same request signal. Selecting an already recovered ID reuses its details. Metric masses and volumes retain their documented units; a serving-only food never receives an invented gram weight.

When automatic selection finds no compatible record, it can make at most two additional distinct searches and retry selection once. Same-food alternatives include sweet sauce/syrup/topping terms, yogurt-cucumber sauce/tzatziki, casserole/bake queries, shorter preparation-free searches, and same-family alternatives already supplied by vision. Material identity conflicts still require confirmation and are not automatically searched as interchangeable foods. Original food/preparation context remains attached and compatibility is checked against it, not the simplified search. Existing bounded herb/sugar aliases remain supported. Candidate lists merge and deduplicate results across searches, preserving suitable original records. Complete casserole names may include sauce ingredients; these remain distinguishable from sauce-only references. No calories or food IDs are fabricated.

## Ingredient failures and bounded retries

Search, automatic selection, and selected-food details fail independently. Resolve retains one ordered result for every input, including duplicate food names. A failed ingredient returns `match: null`, available candidates, a safe reason, and `failure: { stage, code, retryable, attempts }`. Other ingredients retain their authoritative nutrition. Resolve/search/batch return HTTP 200 and `partial: true` when any ingredient has a service failure, including when all fail. Authentication of the app user and invalid request bodies still use HTTP errors. A valid search with no compatible food is unresolved without failure metadata. The app keeps unresolved ingredients and labels the sum of healthy ingredients as incomplete; missing food nutrition is never filled with zero values.

Each temporary upstream operation gets at most two retries (three total attempts), with a shared ceiling of six extra attempts across one meal request. Network failures, HTTP 408/429/500/502/503/504, and FatSecret codes 12/20/24 can retry. Authentication/IP/permission errors, application quota exhaustion (FatSecret 11 or Azure billing/quota codes), malformed responses and genuine no-match results do not retry. OAuth 2.0's existing one-time expired-token refresh remains separate. OAuth 1.0 regenerates the nonce and signature on each retry.

Backoff starts at 250 ms, doubles, and adds up to 99 ms jitter. Provider `retry-after-ms` or `Retry-After` takes precedence; a delay longer than three seconds ends this interactive operation rather than retrying early. FatSecret/token attempts time out after eight seconds and selector attempts after fifteen seconds. The whole edge request has a sixty-second deadline, which cancels in-flight work; the client allows sixty-five seconds so the edge can return completed results. Selector chunks run at most two at a time and commit healthy details independently. Request cancellation stops backoff and further retries. Failed detail/lookup results are not cached, so a later request can recover.

[FatSecret error codes](https://platform.fatsecret.com/docs/guides/error-codes), [Azure retry guidance](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/quota).

## Contract and serving units

POST with a signed-in user's bearer token:

- `{"mode":"metadata"}`
- `{"mode":"batch","queries":["cooked shrimp","pancakes"]}`
- `{"mode":"search","query":"vegetable soup"}`
- `{"mode":"details","id":"fatsecret:1641"}`
- `{"mode":"resolve","queries":["borscht"],"contexts":[{"foodName":"borscht","preparation":"cooked","dishName":"Borscht"}]}`

Search/batch/resolve return query, nullable match, candidates and reason. References contain FatSecret IDs, source links where provided, nutrients per explicit basis, and documented serving masses. Search uses complete generic summaries; brand identity cannot be established from a meal photo. Final selection always loads food details. Missing calories/macros invalidate a serving; confirmed zero values are valid.

Details normalize mass servings to 100 g and volume-only records to 100 ml. Records without a documented metric quantity remain per serving. Milliliters never become grams through an assumed density. Incompatible quantities remain unresolved for correction. Recipe averages and approximate matches remain labeled; the detected dish name stays unchanged.

OAuth 1.0 requests receive a fresh nonce and signature per request. In OAuth 2.0 mode, tokens are cached until shortly before expiry, shared across concurrent requests, and refreshed once on expiry rejection. Successful search/lookup results are cached in memory for one hour, bounded to 256 entries per cache and scoped to credentials. Request size, per-instance bursts, lookup concurrency and resolve duration remain bounded. Unknown foods and provider failures remain unresolved rather than receiving invented fallback calories.

Before production, confirm your FatSecret agreement covers the app's meal-history storage of derived nutrition and any required attribution. Standard API documentation limits indefinite storage of provider response data to designated IDs; this change preserves the existing saved-meal schema. See [storable data](https://platform.fatsecret.com/docs/guides/storable-data).
