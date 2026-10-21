# SnapCravings: phone build plan (iOS + Android)

*Working name. An Everborn product. Draft 2026-10-20. Design, voice, catchphrases ("Let's get cooking!"), pricing and concept are LOCKED as in plan.md and prototype/index.html. This plan changes none of them.*

## 1. Recommended stack: Capacitor + the existing web prototype (PWA-first)

| Option | 1:1 port of prototype | Reuses Meldmind skills | Native camera / IAP | Verdict |
|---|---|---|---|---|
| **Capacitor (PWA wrapped)** | Exact: same HTML/CSS/JS ships | Yes: Meldmind's phone plan (cc-fix/docs/mobile.md) already picked Capacitor; same Node/vanilla JS stack | Yes via plugins (@capacitor/camera, RevenueCat Capacitor plugin) | **Recommended** |
| Expo / React Native | Rewrite every screen in RN components; drift risk | Partial (JS) | Excellent | Second choice if heavy native UI needed later |
| Flutter | Full rewrite in Dart | No | Excellent | Not recommended |
| PWA only | Exact | Yes | No store listing, no IAP, weak iOS camera/push | Ship as web beta only |

Why: the prototype is already web; Capacitor ships that exact UI to both stores from one codebase, so the look Chris loves cannot drift, and it is the same toolchain Meldmind planned for its store builds.

## 2. Porting the prototype 1:1
- Copy prototype/index.html into `web/`; split into index.html / styles.css / app.js without changing any class, color, font, copy or animation.
- Add visual regression: Playwright screenshots of every screen at iPhone 15 and Pixel 8 sizes, compared against baselines taken from the current prototype. Any pixel diff over threshold fails the PR.
- Copy-lock test: a test file lists every catchphrase and price string from the prototype and fails if one changes.
- Add safe-area insets and status-bar handling only (no visual changes).

## 3. Camera + vision AI (Snap it)
- @capacitor/camera (photo or library); resize to ~1280px, JPEG on device.
- Send to our backend, which calls a vision model (keys server-side only, never in the app) returning strict JSON: ingredients, confidence, quantity guess.
- User can edit the detected list before recipes. Recipes generated from list + craving, in the app's existing voice (system prompt includes the voice rules from plan.md).
- Photos: not stored by default; opt-in history in cloud storage.

## 4. Backend, storage, accounts
- Supabase (same as Meldmind): Auth (Sign in with Apple required on iOS if any social login, plus Google and email), Postgres with RLS (each user sees only their own rows), Storage for opt-in photos.
- Edge functions / Cloudflare Worker for vision calls, recipe generation, Instacart calls, price comparisons. Rate limits per user tier.

## 5. Payments (Pro)
- Pricing as in plan.md, unchanged. Digital subscription inside the app must use App Store / Play billing.
- RevenueCat (Capacitor SDK): one entitlement "pro", products configured in both stores, webhook to Supabase to set tier. Free tier enforced server-side.

## 6. Ordering integrations
- Phase 1: Instacart Developer Platform (shoppable recipe / cart links for missing ingredients) + screenshot checkout reader (user screenshots a DoorDash/Uber Eats/Grubhub checkout; vision model extracts subtotal, fees, tax, tip into the all-in comparison).
- Phase 2: MealMe API for live multi-platform restaurant pricing and ordering.
- Apply for Instacart and MealMe access early; both have approval steps (lead time unknown).

## 6a. Recipe results order (locked rule from Chris)
- `#recipes` shows FIRST the recipes makeable right now with what the user has, under "Ready now: let's get cooking!". BELOW, "Make it with a few more things": each card lists its missing items and has a "+ List" button into `#list`, plus a "Restock time! Build my grocery list" button.
- Within each section, sort by fewest missing items, then by time. Test: the ready section always renders above the missing section.

## 6b. Grocery List ("Restock time!")
- Screen `#list` (prototype + web): sections "Missing for <recipe>" and "Running low · spotted in your snap", manual add, +/- quantities, tap to check off, total of unchecked items, "Send list to Instacart".
- Linked from Scan result ("Restock time! Build my grocery list") and Recipe detail ("Add to my grocery list").
- Data: Supabase table `grocery_items` (user_id, name, qty, unit, source = missing|low|manual, recipe_id, done, est_price), RLS per user; works offline in local storage and syncs.
- "Running low": the vision call also returns a fill-level guess per item (e.g. eggs 2 left, soy sauce almost empty); the user confirms before it is added.
- Instacart: send unchecked items as one shoppable list/cart link via the Instacart Developer Platform; show the estimated cost before the tap and say that the final price is shown in Instacart.
- Milestone: part of M3 (Crave it + Grocery List). Tests: list math, check-off excludes items, qty 0 excluded, copy-lock includes "Restock time!".

## 7. Store accounts and costs (superseded by section 11, verified 2026-10-20)
- Apple Developer Program: $99/year (per Meldmind mobile.md; confirm on developer.apple.com). Enroll as organization (Everborn Productions) needs a D-U-N-S number.
- Google Play Console: $25 one-time (per Meldmind mobile.md; confirm on play.google.com/console). New personal accounts must run a closed test with testers before production; org account avoids some of this.
- iOS builds need a Mac/Xcode or a cloud builder (Codemagic / Ionic Appflow / GitHub macOS runners). Meldmind's doc estimates $30-100/month for a cloud builder.
- RevenueCat free until a revenue threshold; Supabase free tier to start.

## 8. Milestones
1. M0 Name: real trademark check on "SnapCravings" (USPTO search + attorney; note Snap Inc. "Snap" marks, and near matches Snapcart/SnapCrave in names.md) before any store listing. Reserve bundle id `com.everborn.snapcravings` (rename later is painful).
2. M1 Shell: Capacitor project, prototype ported 1:1, screenshot + copy-lock tests, CI on iOS + Android.
3. M2 Snap it: camera, vision, editable ingredient list, recipes.
4. M3 Crave it: make-vs-buy, Instacart links, screenshot checkout reader.
5. M4 Accounts + Pro: Supabase auth, RevenueCat, privacy policy, data safety form / privacy labels.
6. M5 Beta: TestFlight + Play closed test (Sacramento testers).
7. M6 Launch: store review, then Phase 2 MealMe.

## 9. Testing rules (Chris's standing build rule)
- Every PR runs the full suite on **iOS and Android** (iOS simulator on macOS runner, Android emulator on Linux runner) plus web.
- Real waits (wait for element/event), not tight timeouts.
- Every test cleans up its servers, sockets, emulator processes and temp dirs.
- Tests that start helper processes (local API stub, emulator bridges) run one at a time, before the rest.
- Release builds retry the test step once, and log that they retried.
- Tests use a temp data dir, demo mode and stub APIs: no real keys, no real orders.

## 10. Lessons from Meldmind
1. **Lock decisions in a file the AI reads first.** Meldmind's CLAUDE.md says "Read docs/DECISIONS.md first... Never revert or rework them", and conflicts are written as `PHASE N BLOCKED` in BUILD-LOG instead of changed. (cc-fix/CLAUDE.md) For us: DECISIONS.md locks the design/voice/pricing.
2. **Phased build plan + build log with honest "Not verified" notes.** BUILD-LOG entries record deviations and what was only syntax-checked, not clicked through. (cc-fix/docs/BUILD-LOG.md, BUILD-PLAN.md)
3. **Hard rules in the brief, one commit per fix.** No deploy, no billing changes, no real keys, never read data/, commit after each lettered fix. (cc-hotfix/docs/FIX-BRIEF-2026-10-18.md)
4. **Helper-process tests run alone first; release retries tests once.** scripts/test-all.mjs runs mcp.test.js serially before the rest; release-windows.yml retries the test step once. Note: Meldmind CI is Windows-only (windows-ci.yml, release-windows.yml); we need iOS + Android from day one. (cc-fix/scripts/test-all.mjs, cc-fix/.github/workflows/)
5. **Port/process collisions cause real bugs.** v0.3.1 root cause of "fetch failed": the installed app attached to a foreign server on port 4747; v0.3.2 fixed a reload loop from service-worker caching. Use random free ports in tests, version-bust caches, no stale service worker in the native shell. (cc-fix/docs/BUILD-LOG.md, cc-hotfix/docs/FIX-REPORT-2026-10-18.md)
6. **Trademark before launch.** Meldmind's name is provisional pending attorney review over Cisco MINDMELD. (cc-fix/docs/DECISIONS.md) Do the check for SnapCravings at M0.
7. **Cloud-first.** Nothing lives only on the PC or the box: git + Google Drive "Everborn Cloud/". The Meldmind fix run ended with work "only on Chris's PC" because push/Drive were out of scope; put the backup step in the brief. (everborn/CLAUDE_FIRST.md, cc-hotfix/docs/FIX-REPORT-2026-10-18.md)
8. **Keys server-side only; plain user-facing text** (no em-dashes in user-facing text per Meldmind rules). (cc-fix/CLAUDE.md)
9. **Route tasks to the AI that already has the login** (Chris's standing rule; not found written in the files reviewed).

## 11. Costs to publish (verified online 2026-10-20; estimates are labeled ESTIMATE)

| Item | Cost | Source |
|---|---|---|
| Apple Developer Program | $99/year (Enterprise $299/yr, not needed) | developer.apple.com/programs/ ; developer.apple.com/help/account/membership/program-enrollment/ |
| Google Play Console | $25 one-time. Personal accounts must pass a closed-testing requirement before production; Organization accounts avoid it | support.google.com/googleplay/android-developer/answer/6112435 |
| Apple commission, subscriptions | 30% in a subscriber's first year, 15% after one year of paid service. **App Store Small Business Program: 15% from the first payment** if proceeds stay at or under $1M/yr (new developers qualify; must enroll and list associated accounts; takes effect ~15 days after the month of approval) | developer.apple.com/app-store/small-business-program/ ; developer.apple.com/app-store/subscriptions/ |
| Google commission, subscriptions | US/UK/EEA since 2026-06-30: 10% service fee + 5% Play Billing fee = **15%** for auto-renewing subscriptions (no enrollment needed). Other markets: 15% for subscriptions | support.google.com/paymentscenter/answer/112622 ; developer.android.com/blog/posts/expanded-billing-choice-and-lower-fees-on-google-play |
| RevenueCat | Free up to $2,500 monthly tracked revenue, then 1% of MTR (measured before store fees) | revenuecat.com/pricing |
| Expo EAS (only if Expo is chosen) | Free: 15 iOS + 15 Android builds/mo; Starter $19/mo; Production $199/mo | expo.dev/pricing |
| iOS cloud builds for Capacitor | GitHub Actions macOS runners or Codemagic. Codemagic's free allowance not confirmed in search. ESTIMATE $0-100/mo (the Meldmind mobile.md estimate is $30-100/mo) | cc-fix/docs/mobile.md |
| Backend: Supabase | Free tier to start; Pro $25/mo | secondary sources (markaicode.com, shiporskip.io); confirm at supabase.com/pricing |
| Web hosting | Free tier on Cloudflare Pages / Netlify / Vercel Hobby / GitHub Pages for a static PWA | ESTIMATE $0; Vercel Hobby is non-commercial, so use Cloudflare Pages (Chris's sites already run there per everborn/CLAUDE.md) |
| Vision AI per scan | Gemini 2.5 Flash paid tier: $0.30 per 1M input tokens (image), $2.50 per 1M output tokens. ESTIMATE per scan, at ~1,300 image + ~500 prompt input tokens and ~800 output tokens: **about $0.0025 (a quarter of a cent)**; 10,000 scans is about $25. Batch is half price | ai.google.dev/gemini-api/docs/pricing |

**ESTIMATE, year 1 fixed cost:** $99 + $25 + $0 to $25/mo Supabase + $0 to $100/mo builds = **about $124 to $1,624**, plus vision usage. On a subscription, the store keeps 15% (Apple with the Small Business Program; Google by default in the US) and RevenueCat takes 1% only above $2,500/mo.

## 12. Web version right away (installable PWA)

Fastest route to a phone-usable app from the exact prototype design. Files are ready in `web/`:
- `web/index.html`: the prototype unchanged, plus head tags only (manifest link, apple-touch-icon, theme color, standalone meta, `viewport-fit=cover`), a hidden `<input type="file" accept="image/*" capture="environment">` that opens the back camera when "Snap it" is tapped (photo stays on the phone, Scan screen still shows example data), and service worker registration. No CSS, layout or copy changed.
- `web/manifest.webmanifest`: name "SnapCravings", standalone, portrait, colors from the prototype (#FBF6EF).
- `web/icons/`: 192, 512, maskable 512, 180 apple-touch. These are **placeholder** coral-gradient "SC" icons; swap in a real logo later.
- `web/sw.js`: offline shell, network first, versioned cache cleared on each deploy; bump VERSION in sw.js (now includes the Grocery List) (Meldmind v0.3.2 stale-cache lesson).
- Test locally: `cd web && python3 -m http.server 8080`.

Install on phones: Android Chrome shows "Install app"; on iPhone, Safari, then Share, then Add to Home Screen.

**Recommended host: Cloudflare Pages (free).** Chris's sites already deploy there, and the box can deploy with `CLOUDFLARE_API_TOKEN` and wrangler v3 (everborn/CLAUDE.md).

**Steps that need Chris:**
1. **Approve the deploy** (it is public). Nothing has been deployed.
2. **Account:** Chris's existing Cloudflare account (Everborn, already used for everbornproductions.com). No new signup needed if the box token is still valid. Command after approval: `npx wrangler@3 pages deploy web --project-name snapcravings`. Creating a new Pages project may need the token to have Pages Edit (it does per CLAUDE.md).
3. **Optional subdomain**, e.g. snapcravings.everbornproductions.com: Chris approves the DNS record in Cloudflare.
4. Alternatives that would need a new signup by Chris: Netlify (drag-and-drop `web/`), Vercel (Hobby is non-commercial only), GitHub Pages (needs the GitHub account and a public repo, or a paid plan for private).
5. Keep `<meta name="robots" content="noindex">` (it came from the prototype) until the trademark check is done.

Not verified: the PWA was not opened in a real phone browser, and no install or camera test has been run yet.
