# Claude Code kickoff prompt: Make or Take (paste as-is)

You are building **Make or Take** (working name), an Everborn product, as an iOS + Android app from one codebase using **Capacitor** wrapping the existing web prototype.

**Read these first, in order:** `CLAUDE.md`, `docs/DECISIONS.md`, `plan.md`, `mobile-build-plan.md`, `prototype/index.html`.

## Locked (never change, never "improve")
- The prototype's design, layout, colors, fonts, animations, copy, voice and catchphrases (including "Let's get cooking!"), pricing, and concept. Port it **1:1**. If a phase seems to need a design or copy change, write `PHASE N BLOCKED: <reason>` in `docs/BUILD-LOG.md` and stop that phase.
- Phase 1 ordering = Instacart Developer Platform + screenshot checkout reader. Phase 2 = MealMe API. Do not swap these.

## Hard rules for every run
- Don't deploy, publish, or submit to any store. Don't create or change store, RevenueCat, Instacart, MealMe or payment settings.
- No real API keys in the app or repo. Keys live server-side only. Tests use a temp data dir, demo mode and stub APIs. No real orders.
- Nothing posts or sends without a user click. No em-dashes in user-facing text.
- Commit after each phase step with a clear message. Try `git push`; if it fails on credentials, don't set up credentials, keep committing locally and note it. Cloud-first: note in the log what still needs a Drive/GitHub backup.

## Testing (must pass before every commit)
- `npm test` and `npm run smoke`, plus visual-regression screenshots (iPhone + Pixel sizes) against baselines from the current prototype, plus a copy-lock test of every catchphrase and price string.
- CI on every PR: **iOS simulator and Android emulator**, plus web.
- Real waits (wait for the element or event), not tight timeouts. Clean up every server, socket, emulator process and temp dir. Run tests that start helper processes one at a time, before the rest. Use random free ports. Release builds retry the test step once and log it.

## Phases (log each in docs/BUILD-LOG.md with what was verified and what was NOT verified)
1. Capacitor shell + 1:1 port of prototype/index.html into web/; safe areas only; tests above; CI for iOS + Android.
2. Snap it: @capacitor/camera, backend vision call returning strict JSON ingredients, editable list, craving-matched recipes in the app's existing voice.
3. Crave it: make-vs-buy all-in comparison, Instacart links for missing items, screenshot checkout reader.
4. Accounts + Pro: Supabase auth (Sign in with Apple, Google, email) with RLS; RevenueCat entitlement "pro" with server-side tier check; privacy policy draft.
5. Beta packaging: TestFlight and Play closed-test build configs (do not upload).

At the end, write a short report: what's done, what's not verified, and anything blocked.
