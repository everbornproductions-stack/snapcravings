# Free AI providers for SnapCravings (checked 2026-11-02 on each provider's own docs)

Each provider turns itself on in functions/api/[[path]].js once its Pages secret exists. Order (fastest first):
Cerebras, Groq (3.5 s head start each) -> Gemini 3.5-flash-lite -> Gemini 3.1-flash-lite -> Gemini 3-flash-preview -> Mistral -> OpenRouter -> Workers AI.
Add a key with: `wrangler pages secret put GROQ_API_KEY --project-name snapcravings` (same for the others).

| Provider | Secret | Free? Card? | Limits (free) | Models we use |
|---|---|---|---|---|
| Google Gemini (have key) | GEMINI_API_KEY | Free tier, no card | Per project, per model (each model is its own bucket); exact RPM/RPD only in AI Studio. Free on this key: 3.5-flash-lite, 3.1-flash-lite, 3-flash-preview, 3.6-flash (often 503), gemma-4. No free quota: 3.7/3.8-flash (429), 2.5-flash* (404 for new users). Free-tier data is used to improve Google products. | 3.5-flash-lite (scan + recipes), 3.1-flash-lite, 3-flash-preview |
| Groq | GROQ_API_KEY | Free plan, no card (spend limits exist only on paid) | Per model: gpt-oss-120b / gpt-oss-20b / qwen3.8-27b = 30 RPM, 1K RPD, 8K TPM, 200K TPD. Llama models are now Enterprise-only (not on the free list). 8K TPM means about 2 recipe calls a minute. | text openai/gpt-oss-20b (~1000 tok/s), vision qwen/qwen3.8-27b |
| Cerebras | CEREBRAS_API_KEY | NOT permanently free: $5 trial credits that expire in 30 days, and API access needs a verified payment method (card) | Trial: 5 RPM, 30K TPM, 1M TPD | gpt-oss-120b, vision qwen-3.8-27b. Skip unless Chris accepts adding a card. |
| OpenRouter `:free` | OPENROUTER_API_KEY | Free models, no card | 20 RPM and 50 requests/day across all :free models (1000/day only after buying 10 credits, which is paid). 14 free models today, e.g. google/gemma-4-26b-a4b-it:free (vision), nvidia/nemotron-3.5-super-vl:free. | google/gemma-4-26b-a4b-it:free (late backup) |
| Mistral | MISTRAL_API_KEY | "Free mode", no card; phone SMS check reported | Mistral publishes no numbers (see Admin > Limits). Third-party reports in Oct 2026 say some free orgs see "Upgrade to activate your API keys" and 429s on Small/Medium. Treat as unconfirmed until a key works. | mistral-small-latest (vision) |
| Cloudflare Workers AI (have binding) | env.AI binding | 10,000 neurons/day free | CF_BUDGET guard 6000/day | Llama 4 Scout (scan), Qwen3 30B (recipes) |

Sources: console.groq.com/docs/rate-limits, console.groq.com/docs/models, inference-docs.cerebras.ai/support/rate-limits,
openrouter.ai/docs/api-reference/limits + /api/v1/models, ai.google.dev/gemini-api/docs/pricing + rate-limits, docs.mistral.ai/admin/billing-usage/usage-limits.
