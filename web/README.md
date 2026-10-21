# SnapCravings web app (PWA)

- `web/` static app (design unchanged from the prototype; real data). `app.js` holds all client logic; no keys in the client.
- `functions/api/[[path]].js` Cloudflare Pages Function: `/api/scan`, `/api/recipes`, `/api/crave`, `/api/health`. Calls Gemini 3.8 Flash (gemini-2.5-flash is closed to new keys) with `GEMINI_API_KEY` (Pages secret). Limits: 4 photos, 1.5 MB each (client shrinks to 1280px JPEG), 7 MB body, per-IP hourly limits (scan 12, recipes 20, crave 20; KV binding `RATE_KV` optional, else per-isolate memory).
- Grocery list, ingredients and last results persist in localStorage. "Send list to Instacart" opens Instacart search per item. Ordering comparison = "Coming soon". Pro = no payments.

## Run locally (mock AI, no key)
    cd /workspace/craving-app && wrangler pages dev web --port 8788 --binding MOCK_AI=1
    node e2e-test.mjs http://localhost:8788 /path/to/photo.jpg   # needs puppeteer-core (see /tmp/pt)

## Go live (from /workspace/craving-app)
    export CLOUDFLARE_ACCOUNT_ID=14f579a7f08123944a6c7d89a0db6810
    wrangler pages project create snapcravings --production-branch main
    echo "$GEMINI_API_KEY" | wrangler pages secret put GEMINI_API_KEY --project-name snapcravings
    npx wrangler@3 pages deploy web --project-name snapcravings --branch main
Then: https://snapcravings.pages.dev  (noindex via meta + _headers)
