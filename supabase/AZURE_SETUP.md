# Azure photo analysis deployment

The app now calls `analyze-food` using the signed-in user's Supabase access token.
The function authenticates that token with Supabase Auth before calling Azure.
Existing meal tables and data are not changed. No database migration is required.

## 1. Secrets (already added in your dashboard)

In the same Supabase project used by the app, set:

| Name | Value |
| --- | --- |
| AZURE_OPENAI_API_KEY | Azure deployment key |
| AZURE_OPENAI_BASE_URL | https://cal-ai-resource.services.ai.azure.com/openai/v1 |
| AZURE_OPENAI_DEPLOYMENT | gpt-5-mini |

The function reads SUPABASE_URL and SUPABASE_ANON_KEY from Supabase's built-in secrets.
Do not put the Azure key in the phone app, chat, or an EXPO_PUBLIC variable.

## 2. Deploy through the dashboard

1. Open Edge Functions → Functions → Deploy a new function → Via Editor.
2. Set the function name to exactly `analyze-food`.
3. Replace the editor's index.ts contents with ALL of `supabase/functions/analyze-food/index.ts`.
   It is one self-contained file; no packages or additional files are needed.
4. Deploy the function.
5. In the function's configuration, turn OFF **Verify JWT with legacy secret** if enabled.
   Authentication remains mandatory in the function: it calls Supabase Auth to validate every user's token.
   The CLI equivalent is already configured in `supabase/config.toml`.

CLI alternative, from this repository after signing into the Supabase CLI:

```sh
supabase functions deploy analyze-food --project-ref lgozuyqviyhvcydyajzw
```

## 3. Test in the app

1. Restart Expo, open the app, and use real email authentication (not an OAuth development stub).
2. Select a meal photo. Analysis should return ingredients, portion estimates and nutrition.
3. Try a non-food photo: it should show a no-food message rather than save an empty meal.
4. Try a readable nutrition label; confirm the serving unit and numbers match the label.
5. Save a meal at 0.5 and 2 portions. Reopen history and check that calories scale once.

An unsigned request must return 401. Dashboard Test needs a real signed-in user's access token;
an anonymous project key alone is not a user session. Do not share tokens in chat.
Local tests use mocked provider responses; deployment and a live authenticated phone test are still required.

## Behavior and limits

Food consistency updates to this function require redeployment. The updated prompts
preserve visible counts and portions, avoid overlapping region totals and duplicate
whole-dish/component entries, and flag shared platters or uncertain serving scope.
See [food accuracy notes](../scripts/FOOD_ANALYSIS_ACCURACY.md) for client fixes,
reference sources, regression coverage and live-evaluation limits.

- Three fixed tasks: meal recognition, layered-food refinement, and nutrition-label reading.
- Prompts, model selection, and response schemas are server-controlled. No arbitrary prompt endpoint.
- Strict structured output plus numeric validation; incomplete/refused responses fail instead of repairing partial results.
- Unknown label values remain null and the app refuses to treat them as zero.
- JPEG input only, request body capped at 6 MB, Azure request deadline 90 seconds.
- Low reasoning effort, up to 6,000 output tokens including reasoning; no automatic paid retries.
- Best-effort burst guard: six calls/user/minute per running instance. This is NOT a global spending cap;
  use Azure limits/monitoring and add a persistent shared rate limiter before a public launch.
- `store: false` disables Responses API response storage; other Azure service retention policies still apply.
- Nutrition lookup currently uses a small built-in reference table and generic estimates for unknown foods.
  FatSecret is disabled; no FatSecret credentials are needed. This is NOT a live USDA integration.
  Verify nutrition quality before distributing the app.

References: [Azure Responses API](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses),
[Supabase authentication](https://supabase.com/docs/guides/functions/auth).
