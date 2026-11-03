# Launch push kit (Nov 2, 2026)
- FEATURING_GOOGLE.md: filled Play featuring nomination + Apps Innovation Corner form (target Jan 4, 2027 New Year meal prep). FEATURING_APPLE.md for when iOS is live.
- VIDEO_PLAN.md: 30 scripts, 4-week calendar, hashtags.
- LAUNCH_DAY_KIT.md: hour-by-hour checklist for Play approval day, friend/text templates, community and Product Hunt/AlternativeTo copy.
- FREE_CHANNELS.md: directories with checked URLs and copy. ADS_OPTIONAL.md: optional small ad test.
- Emails with the Play link: ../../announce-play.html/.txt and ../../announce-play-es.html/.txt.

## The launch-day flag
`web/config.js` -> `PLAY_LIVE: false`. Set it to `true`, bump the `?v=ui30` cache tag in web/index.html and web/sw.js, deploy. That shows the "Get SnapCravings on Google Play" card on the home screen to Android browser visitors (not inside the app, not on iPhone/desktop; dismissible, remembered per device). Code: web/grow.js `playBanner()`.

## Shipped in the app (ui30, commit 3368da4)
- Android app only: after a recipe is saved (♡) or rated 👍, an "Enjoying SnapCravings? Rate us on Google Play" card (same card style) links to market://details?id=app.snapcravings.twa. At most once per 30 days (localStorage sc.reviewAskedAt). Android app detection: Play referrer android-app://app.snapcravings.twa on first launch (remembered as sc.twa) or Play Billing present.
- Every recipe: "📤 Share this recipe" (native share sheet, or copy to clipboard) with the recipe name, ingredients and "Made with SnapCravings ... Try it free: https://snapcravings.pages.dev/?ref=share".
- EN + ES strings. Events review_card / review_go / share_recipe / play_banner / play_go are sent to /api/ev but the database rejects them until supabase/migrations/20261102_snapcravings_growth_events.sql is applied.
