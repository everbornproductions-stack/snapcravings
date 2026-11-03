# Google Play Data safety form: SnapCravings (app.snapcravings.twa)

Derived from the code on 2026-11-02 (functions/api/*, functions/_lib/*, web/*). Re-check this file whenever an endpoint starts
storing or sending something new. Privacy policy URL: https://snapcravings.pages.dev/privacy.html

## Overview answers

| Question | Answer | Why (code) |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | Photos and typed text go to AI providers; email for Pro; hashed ids for limits. |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | HTTPS only (Cloudflare Pages; every AI, Supabase, Stripe and Google call is https). |
| Do you provide a way for users to request that their data is deleted? | **Yes** | Email everbornproductions@gmail.com, subject "SnapCravings data deletion" (privacy.html#delete). On-device data: clear storage/uninstall. |
| Account creation | No account. Pro uses email (Stripe) or the Google Play purchase. | functions/api/sub, functions/api/play/verify.js |

## Data types

"Collected" = sent off the device. "Shared" = sent to a third party that is not just our service provider. Under Play's
definitions, transfers to service providers that process data on our behalf are **not sharing**, BUT free AI tiers may retain
or use inputs under their own terms, so we answer **Shared = Yes** for photos and typed text to be safe.

| Data type (Play category) | Collected | Shared | Ephemeral? | Required or optional | Purposes | Source |
|---|---|---|---|---|---|---|
| **Photos** (Photos and videos > Photos) | Yes | Yes (AI providers) | Yes on our side (not stored by us); providers may retain | Optional (only when the user snaps/picks a photo) | App functionality | /api/scan, /api/dish, /api/adapt send images to Gemini, Groq, Cerebras, Mistral, OpenRouter, Workers AI |
| **Other user-generated content** (App activity > Other user-generated content): cravings, ingredient lists, diet/allergy choices, plan requests | Yes | Yes (AI providers) | Yes on our side; AI answers cached 24 h and kept in the recipe library without any user link | Optional | App functionality | /api/recipes, /api/crave, /api/plan, /api/holiday-plan, recipelib.js |
| **Health info** (Health and fitness > Health info): diet and allergy tags, calorie/protein targets | Yes (sent with AI requests) | Yes (inside the AI prompt) | Yes (not stored server side; kept on device) | Optional | App functionality | prefs sent in request bodies; diet.js |
| **Email address** (Personal info) | Yes, Pro via Stripe only | No | No (subscription record) | Optional | Account management (restore Pro) | functions/api/sub, Supabase webhook |
| **Purchase history** (Financial info) | Yes (subscription status, Play purchase token / Stripe reference) | No | No | Optional | App functionality, account management | play/verify.js, sub |
| **Approximate location** (Location) | Yes (country from Cloudflare `request.cf.country`) | No | Country stored only with trending dish counts | Required by design (automatic) | App functionality (holidays, units, popular dishes per country) | /api/geo, trending.js |
| **Device or other IDs** (Device or other IDs): random app device id, salted hash of IP address | Yes (hashed before storage) | No | No (scan/plan gate rows self-delete after ~8 days) | Required for free limits | Fraud prevention, security, and compliance; Analytics | snap_scan_gate in [[path]].js and plan.js; ev.js |
| **App interactions** (App activity): anonymous events like page_view, scan, favorite | Yes | No | No | Required (no user setting) | Analytics | ev.js (device id hashed server side, no IP, no user agent) |
| Recipe ratings / saved shared recipes | Yes, linked to hashed device id | No | No | Optional | App functionality | recipe library RPCs |

Not collected: name, phone, address, contacts, precise location, messages, calendar, files outside the picked photo, audio,
web history, advertising id, crash logs (none are sent), payment card numbers (Stripe / Google Play handle them).

## Security practices section

- Data encrypted in transit: **Yes**
- Users can request deletion: **Yes** (email above)
- Committed to Play Families policy: **No** (app is for 18+)
- Independent security review: **No**

## Notes for whoever fills the form

- If a new AI provider key is added (OAI list in functions/api/[[path]].js and plan.js), add it to privacy.html too.
- If the free scan gate stops hashing IPs, or ev.js starts storing anything new, update the Device IDs and App activity rows.
- Do not change anything in the Play Console from this file; it is the answer sheet only.
