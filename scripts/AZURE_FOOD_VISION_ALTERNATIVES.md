# Azure alternatives for food-photo analysis

Checked 2026-10-28 using primary Microsoft and provider documentation. This research did not create deployments, enable services, change secrets, or run paid inference. Catalog availability is distinct from availability in this subscription, resource region, billing country and quota.

## Recommendation for this app

Benchmark the existing Mini baseline against the already-created Terra deployment before declaring a winner. Add **Claude Sonnet 5.5** as the first independent provider comparison, **Claude Haiku 5.5** for a low-cost comparison, and **FW-Kimi-K3** as the most practical current Chinese-model candidate after its actual Azure/Fireworks price and subscription access are confirmed. Qwen vision is technically relevant, but the verified Fireworks offerings below require provisioned capacity. These priorities are engineering judgments, not demonstrated rankings of food recognition or portion accuracy.

The app currently sends OpenAI Responses requests to `/openai/v1/responses`, with image input, `reasoning.effort: low`, a 6,000-token output cap and a strict JSON schema (`supabase/functions/analyze-food/index.ts`). Only the vision deployment name is independently configurable; do not point this setting at a different API family and assume compatibility. Keep the nutrition selector fixed while comparing vision providers.

## Claude: real Azure options, with a different API

Current IDs include **`claude-sonnet-5-5`**, **`claude-haiku-5-5`**, and **`claude-opus-5-5`**. Microsoft lists Azure-hosted GA options and Anthropic-hosted options; older documentation describing all Claude on Foundry as an external preview is outdated. Image analysis and JSON-schema structured output are supported. Structured output uses `output_config.format` (Azure-hosted also accepts legacy `output_format`), rather than this app's OpenAI `text.format`. [Microsoft model/capability reference](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/claude-models)

The two hosting choices are materially different: Azure-hosted inference runs on Azure infrastructure, while Anthropic-hosted inference can run outside Azure. Anthropic remains the operator/seller for both; both use Marketplace billing. Choose the intended hosting version explicitly. [Hosting comparison](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/claude-models-hosting-comparison)

Claude uses the **Messages API**, typically `https://<resource>.services.ai.azure.com/anthropic/v1/messages`, with Anthropic request/response and image-content shapes. It requires a provider adapter in `analyze-food`, including schema, reasoning controls, token usage, errors/refusals and response parsing. This is not a deployment-name-only switch. Anthropic's current guide states **Sonnet 5.5 supports Global Standard only**; other Claude models can offer Global or US Data Zone variants. [Anthropic's Foundry integration guide](https://platform.claude.com/docs/en/build-with-claude/claude-in-microsoft-foundry)

Deployment requires a paid eligible subscription, supported billing country and deployment location, Marketplace permissions, and role/quota access. Student, free-trial and credit-only startup/sponsored subscriptions are restricted; a card-backed sponsored account can charge the card instead of Azure credits. The existing Sweden Central resource does not by itself prove Claude can be provisioned there for this account. [Microsoft deployment prerequisites](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/use-foundry-models-claude)

### Claude cost basis

Foundry bills Claude through consumption units (CCU). Microsoft explicitly says Anthropic's current per-model token rates determine the charge, after contractual discounts, before CCU conversion. Thus these are documented **Foundry token-equivalent standard rates**, not an assumption that all cloud providers copy direct-API prices. [Microsoft billing mechanics](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/claude-models-billing)

| Candidate | Standard input / output, USD per million tokens | Why test it |
|---|---:|---|
| Claude Sonnet 5.5 | $2 / $10 | Independent provider quality comparison |
| Claude Haiku 5.5 | $0.10 / $0.50 for prompts up to 100,000 tokens | Low-cost challenger; quality must be measured |
| Claude Opus 5.5 | $4 / $20 | Higher-cost ceiling if cheaper candidates fail |

Haiku prompts above 100,000 tokens have higher rates. Geography, caching, feature use, discounts and tax affect final charges. Tokenizer/image-token differences and reasoning volume mean a token-price ranking is not necessarily a cost-per-photo ranking. [Current provider rates and explicit Foundry CCU pricing](https://platform.claude.com/docs/en/about-claude/pricing)

## Chinese labs: Kimi and Qwen

**`FW-Kimi-K3`** is a GA native-vision Moonshot model offered through **Fireworks on Foundry**. Its card lists text/image input and explicitly identifies **Fireworks infrastructure**, not Azure-hosted inference. That distinction applies even though deployment and billing are exposed through Foundry. [Kimi K3 model card](https://ai.azure.com/catalog/models/FW-Kimi-K3?publisher=fireworks)

Microsoft's current deployment table lists `FW-Kimi-K3` for **pay-per-token Global Standard** and US Data Zone Standard. Older `FW-Kimi-K2.5`, `FW-Kimi-K2.6` and `FW-Kimi-K2.7-Code` pay-per-token variants have retired, even though provisioned variants remain. Separately, Azure-direct `Kimi-K2.5`, `Kimi-K2.6` and `Kimi-K2.7-Code` are different offerings; do not infer the status or API of one from the other.

The current table lists Qwen models such as **`FW-Qwen3.6-27B`** and **`FW-Qwen3.6-35B-A3B`** under **provisioned throughput**, not pay-per-token. The 27B offering has a 50-PTU minimum. That makes it a lower-priority experiment for a small app without a separately justified capacity budget. `FW-Qwen3.8-27B` is also listed as provisioned, but this research did not verify its image capabilities. Global offerings have broad region availability; account enablement and quota still apply. [Current Fireworks deployment/region/retirement table](https://learn.microsoft.com/en-us/azure/foundry/how-to/fireworks/fireworks-model-catalog)

The `FW-Qwen3.6-27B` model card explicitly confirms image input despite its coding-oriented description. Descriptions emphasizing code do not imply that a model is text-only. [Qwen model card](https://ai.azure.com/catalog/models/FW-Qwen3.6-27B)

Fireworks must first be enabled by an administrator. Microsoft documents both Chat Completions and **Responses API support for its catalog**, including the app's `/openai/v1/responses` route and a Fireworks passthrough route. Therefore it is inaccurate to claim every Kimi/Qwen option requires a Chat-only rewrite. Exact image, strict-schema, reasoning-parameter and refusal behavior must nevertheless pass a compatibility test before reusing the existing function unchanged. [Enablement and Responses routes](https://learn.microsoft.com/en-us/azure/foundry/how-to/fireworks/enable-fireworks-models)

The official Azure Fireworks pricing page returned `$-` placeholders for Kimi K3 rates in this retrieval. Its numeric Azure price is **unverified**; no claim that it is cheaper than Terra or Mini is justified from these pages. Check the account's deployment pricing/estimate before provisioning. [Azure Fireworks pricing](https://azure.microsoft.com/en-us/pricing/details/ai-foundry-models/fireworks/)

## Gemini and Google models

No native Gemini Foundry deployment was verified in the official model references inspected. This is a research finding with an explicit limit, not a claim that Azure applications cannot call Gemini. Google's Gemini API is available through Google's own service and credentials, with multimodal and structured-output capabilities. Calling it from a Supabase function would add a separate provider integration. [Google's Gemini API](https://ai.google.dev/gemini-api/docs)

Microsoft documents Gemini through Azure Databricks Unity Gateway as an **external model provider**: the gateway uses stored credentials and routes requests to that provider, with a provider-specific Gemini API path. A gateway connector does not turn Gemini into Azure-hosted inference or a model available under the current Azure resource key. [Microsoft external-provider gateway documentation](https://learn.microsoft.com/en-us/azure/databricks/ai-gateway/query-model-provider-services)

Google **Gemma** open models are a separate family from Gemini; Fireworks lists Gemma 4 provisioned offerings. Their presence is not evidence that Gemini can be deployed natively in this resource.

## Relevant visual and food-specific evidence

Official OpenAI documentation specifically positions Terra for visual reasoning, including matching product photos and comparing drawings. Its programming capabilities do not establish that it is unsuitable for image recognition. Equally, these descriptions do not establish food-portion superiority. [Official OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model)

A July 2026 **preprint** tested direct portion estimation on 100 multi-food Nutrition5k images with a common decomposition prompt/matcher. Its Table 4 reports per-food mean absolute errors of **24.1 g for Gemini 3.5 Flash**, **26.7 g for GPT-5.5**, **35.7 g for Claude Fable 5**, and **36.2 g for Claude Opus 4.8**. Recognition coverage ranks differently from portion error. Terra, current Claude versions, Kimi and Qwen were not tested. This small, older-model experiment is relevant food-specific evidence, not proof of today's best model or expected accuracy on our nine photographs. Its trained portion head also outperformed direct model estimates, suggesting that changing the recognizer alone may leave the weighing problem unresolved. [Paper, section 4.5 and limitations](https://arxiv.org/html/2607.16514v1)

## What would establish the best choice

None of the availability/capability sources above establishes a winning model for gram weights from a single food photo. Run the same dish-only images and normalization/scoring policy, track food identity/counts separately from grams and nutrition-reference quality, repeat difficult cases, record actual latency/usage/billed cost, and add weighed holdout meals. A model that names the dish better can still estimate its portion badly. Keep production configuration unchanged until that comparison supports a switch.
