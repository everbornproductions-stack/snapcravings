# Make or Take: phone build plan (iOS + Android)

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

## 7. Store accounts and costs (verify before paying)
- Apple Developer Program: $99/year (per Meldmind mobile.md; confirm on developer.apple.com). Enroll as organization (Everborn Productions) needs a D-U-N-S number.
- Google Play Console: $25 one-time (per Meldmind mobile.md; confirm on play.google.com/console). New personal accounts must run a closed test with testers before production; org account avoids some of this.
- iOS builds need a Mac/Xcode or a cloud builder (Codemagic / Ionic Appflow / GitHub macOS runners). Meldmind's doc estimates $30-100/month for a cloud builder.
- RevenueCat free until a revenue threshold; Supabase free tier to start.

## 8. Milestones
1. M0 Name: real trademark check on "Make or Take" (USPTO search + attorney) before any store listing. Reserve bundle id `com.everborn.makeortake` (rename later is painful).
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
6. **Trademark before launch.** Meldmind's name is provisional pending attorney review over Cisco MINDMELD. (cc-fix/docs/DECISIONS.md) Do the check for Make or Take at M0.
7. **Cloud-first.** Nothing lives only on the PC or the box: git + Google Drive "Everborn Cloud/". The Meldmind fix run ended with work "only on Chris's PC" because push/Drive were out of scope; put the backup step in the brief. (everborn/CLAUDE_FIRST.md, cc-hotfix/docs/FIX-REPORT-2026-10-18.md)
8. **Keys server-side only; plain user-facing text** (no em-dashes in user-facing text per Meldmind rules). (cc-fix/CLAUDE.md)
9. **Route tasks to the AI that already has the login** (Chris's standing rule; not found written in the files reviewed).
