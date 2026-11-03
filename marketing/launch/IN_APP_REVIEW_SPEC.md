# In-app review prompt – spec (no code changed)
Sources: https://developer.android.com/guide/playcore/in-app-review , https://developer.android.com/guide/playcore/in-app-review/kotlin-java , https://support.google.com/googleplay/android-developer/answer/9898684

## Google's rules that constrain us
- Trigger after the user has experienced enough of the app; not on first launch.
- NO questions before the card ("Enjoying SnapCravings?", "Would you give 5 stars?") — this forbids the common "pre-filter happy users" gate.
- Don't modify/overlay the card; no button that calls the API (use a Play Store link for any "Rate us" button).
- Quota is hidden (~ once per month-ish); API gives no result, so our own throttle is required.
- Pre-cache ReviewInfo shortly before the moment; skip if not ready (never block UI).

## When to trigger (SnapCravings)
Fire `requestReview()` on return to home / recipe list (a screen transition), when ALL are true:
1. A success moment just happened: `recipes_shown` after a scan in this session AND (user favorited a recipe OR opened a recipe's steps), OR completed 2nd successful scan on a different day.
2. Installed >= 2 days and >= 3 sessions (use existing 30-min visibility logic as sessions).
3. Not right after a paywall/"free scans used up", error, or checkout screen.
4. Never asked before, or last ask > 90 days ago (store `sc.reviewAskedAt` in LS). Max 3 lifetime asks.
5. Running inside the TWA (Android Play install) — not on web/iOS.
Delay ~1.5s after the transition, after the "Saved to favorites" toast.

## Code changes needed (TWA = web app inside Chrome, so the API is native-only)
A. Android (android/app): add Play Core review dependency `com.google.android.play:review:2.0.x` (+ review-ktx optional).
   Add a transparent `ReviewActivity` (Theme.Translucent.NoTitleBar, excludeFromRecents) registered with an intent-filter for custom scheme `snapcravings://review`. onCreate: `ReviewManagerFactory.create(this).requestReviewFlow()` → on success `launchReviewFlow(this, info)` → `finish()` on complete; on failure just `finish()`. Bump versionCode; update twa-manifest.json / build via Bubblewrap so the activity survives regeneration (Bubblewrap overwrites generated files – keep the activity in a non-generated source file or re-apply after `bubblewrap update`).
B. Web (web/app.js): add `maybeAskReview(trigger)` implementing the rules above; detect TWA via `document.referrer.startsWith('android-app://app.snapcravings.twa')` captured on first load into LS (`sc.twa=1`). When eligible: `LS.set('reviewAskedAt', Date.now()); track('review_prompt', trigger); location.href = 'snapcravings://review';`
   Call it from: toggleFav (when adding), and on showing home after a session with `recipes_shown`.
C. Settings/About: plain "Rate on Google Play" link → `https://play.google.com/store/apps/details?id=app.snapcravings.twa` (allowed; it's not the API).
D. Test via internal test track (quota not enforced there); internal app sharing can't submit reviews.

## Compliant early-review generation (no incentives)
- Allowed: ask everyone (not just happy users) neutrally — "If SnapCravings helped, a review on Google Play helps others find it." in launch email #2 and in-app after success; reply to every review within 24h in Console (replies can prompt users to update ratings).
- Not allowed: giving free scans/Pro/promo codes/contest entries for reviews, asking friends/team/Everborn staff to post reviews, review exchanges, paid review services, asking for 5 stars specifically.
- Promo codes CAN be given to testers/influencers for trying Pro, as long as there's no review requirement.

## Separate launch blocker to check
web/app.js sells Pro via Stripe. Play Payments policy generally requires Google Play Billing for digital subscriptions in Play-distributed apps (US alternative-billing/link-out rules changed after the Epic ruling — verify current US terms in Play Console before launch): https://support.google.com/googleplay/android-developer/answer/9858738 . Lowest-risk path: in the TWA build, hide the Stripe checkout or implement Play Billing via the Digital Goods API (Bubblewrap supports `playBilling` feature). A rejection or post-launch suspension would kill launch week.
