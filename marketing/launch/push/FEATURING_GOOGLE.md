# Google Play featuring pitch: SnapCravings (READY TO SUBMIT, NOT submitted; Chris clicks Submit)
Updated Nov 2, 2026, 7 PM PT for the featuring push Chris approved. Assets: marketing/play-assets/ (screenshots in 10 languages, phone + 7" + 10" tablet, 1024x500 feature graphic, promo-draft.mp4 + PROMO_VIDEO.md).

## The pitch in one paragraph (use for "more info", emails to Google contacts, the deck cover)
SnapCravings is made by Chris Magee, a one-person founder in Sacramento, California, under his small studio Everborn. He built it to fix the nightly "there's nothing to eat" moment that ends in another $30 delivery order and a fridge of food that goes to waste. Snap your fridge, freezer, pantry and spices and SnapCravings spots what you have, then streams recipes that fit what you are craving, your diet and your allergies (allergies are hard rules, checked in every recipe, step and tip). It shows whether cooking or ordering is the better deal, plans a week of meal prep with one grocery list, scans a plated meal for estimated calories and macros, and plans a full holiday menu for your guests. It speaks 10 languages (English, Spanish, Portuguese, Hindi, Indonesian, French, German, Arabic, Russian, Turkish) and runs on free-tier AI with a free fallback, so the free plan stays genuinely useful: waste less food, save money, eat better.

## Key features (all live in the app on Nov 2, 2026; checked in code)
- Fridge, freezer, pantry and spice photo scan to recipes; recipes stream in one by one (first recipe in about 2 s), plus a growing recipe library for instant matches.
- Diet and allergy settings as hard rules (gluten-free, vegan, nut/shellfish/egg/soy allergies, keto, halal and more).
- Crave it: cook-vs-order cost check (grocery cost for the dish; delivery-app prices shown as "coming soon", never invented).
- Scan my plate (Pro; 3 free a day): dish name + estimated calories, protein, carbs, fat, fiber, sugar, sodium, with portion and servings controls and a daily total against meal-prep targets. Labeled "AI estimate, not medical advice."
- Meal prep: a week of meals, one grocery list, a prep-day guide, optional calorie and protein targets.
- Holiday mode per country (themed colors, a short animation, Holiday foods) and the Holiday planner: full menu for 2-30 guests, scaled shopping list, cooking timeline.
- Favorites, grocery list, Library with seasonal collections, family recipes adapted to your diet.
- 10 languages including right-to-left Arabic; the app follows the phone's language.
- Free: 3 fridge scans a week. Pro (Google Play Billing): unlimited scans and plate scans, full meal-prep week and holiday plan. $3.99/month founders price, then $4.99, or $39.99/year.

## Seasonal angles and when to submit
| Angle | What we show | Submit | Honest note |
|---|---|---|---|
| **Thanksgiving + holiday cooking** (Thanksgiving Nov 26; Christmas, Hanukkah, New Year's Eve) | Holiday planner menu + timeline, Holiday foods, Christmas theme, "use the leftovers" fridge scans | **The day Play approves the app** (main form + Apps Innovation Corner once rated 4.0+) | Google asks for 8 weeks' lead for new apps, so a November or December placement is unlikely; submit anyway so the app is in the editors' queue, and push the holiday angle hard in our own channels. |
| **New Year healthy eating** (Jan 1-31, 2027) | Scan my plate macros, meal prep with calorie/protein targets, cook-vs-order savings | **By about Dec 1, 2026** with desired feature date Mon Jan 4, 2027 (fallback Jan 11 or 18) | Dec 1 meets the 3-week rule but not the 8-week new-app rule for Jan 4; if the app is approved by Nov 9, submit then for Jan 4. Either way, the latest is Dec 1. |
| Spring "waste less food" (Earth Day Apr 22) | Fridge scan, leftovers, grocery list | Feb 2027 (via Promotional Content once eligible) | Optional. |

## Accessibility and quality notes (verify on a real phone before submitting)
- Large tap targets, readable text, high contrast: every holiday color pair passes WCAG AA (automated test test/holiday.test.mjs). Animations are short, never block taps and respect "reduce motion".
- Screen reader labels on icon buttons (aria-label), photos have alt text; Arabic is fully right-to-left.
- Allergy-first design: hard rules, double-checked steps and tips, plus a "check labels yourself" note. Nutrition and costs are always labeled as estimates.
- Speed: Lighthouse performance 99-100 on the web build; recipes start streaming in ~2 s; plate scan ~2 s.
- Reliability: hedged AI chain with a free Workers AI fallback, fail-open limits, 90+ automated tests run on every change.
- Privacy: no account needed; diet settings, favorites and the daily log stay on the device; see web/privacy.html for what photos and requests are used for (Chris: re-read it before quoting).
- Known gaps an editor may see: Android app is a Trusted Web Activity (web app inside Chrome), tablet layout is the phone layout centered, no iOS App Store app yet.

## Metrics to cite once we have them (fill in; never estimate)
| Metric | Where to get it | Value |
|---|---|---|
| Average rating and count | Play Console > Ratings | ___ (need 4.0+ for Apps Innovation Corner) |
| Installs, first 14 days | Play Console > Statistics | ___ |
| Day-1 / day-7 retention | Play Console > Retention | ___ |
| Crash rate / ANR | Android vitals | ___ (keep under 1.09% / 0.47%) |
| Scans and recipes per active user per week | /api/stats (STATS_KEY) | ___ |
| Share of users outside the US / using a non-English language | /api/stats by lang | ___ |
| Food-waste or savings story from a real user (with permission) | Email replies, reviews | ___ |

## Rules printed on the form (read before submitting)
- Submit **at least 3 weeks ahead, 8 weeks for newly launched apps**, of the desired featuring date. **APK/AAB must be available in Play Console.**
- App minimums: policy + launch checklist + design guidelines + core app quality; "Simultaneously launch your app across key mobile platforms"; **rating 3.0 or higher**; launched within 4 months of the featuring date; device optimization; platform parity; localize where you want featuring; Material Design UI. Meeting them "does not guarantee promotion".
- The form is for **new launches** only. Updates go through Promotional Content, which new apps cannot access.

## What this means for timing (older notes; the table above wins)
- Holidays now (Thanksgiving Nov 26, December): too close. 8 weeks from today is Dec 28, 2026, and we have no rating yet. Use holiday cooking in our own posts and videos instead (VIDEO_PLAN.md), not in the form.
- **Target: New Year meal prep, desired feature date Mon Jan 4, 2027** (or the week of Jan 11 as a fallback). Submit on **launch day or within 2 days of Play approval** (Nov 9 at the latest keeps the 8-week lead for Jan 4). Wait until the app has at least a few ratings if possible, but do not miss the lead time: the form does not say the rating must exist at submission.
- Weak spots an editor will see: no iOS store app yet (we answer "No: Android-First" truthfully), web-wrapped app (TWA), very new account. Strengths: Spanish built in, allergy-safe rules, real meal-prep feature that fits January.

## Field-by-field answers (copy/paste)
| Form field | Answer |
|---|---|
| App, Game, or Family? | **App** |
| Does your app meet all of the above minimum requirements? | **Yes** (Chris: confirm you are comfortable with "simultaneously launch across key mobile platforms": the web app works on iPhone today and the iOS build exists, but it is not in the App Store. If you are not comfortable, wait to submit until the iOS app is live.) |
| Please confirm that this is a new launch. | **Yes - New launch** |
| Company Name | Everborn Marketing LLC |
| Contact Name | Chris Magee (confirm spelling) |
| Contact email | everbornproductions@gmail.com (Chris: confirm, or use the support address on the Play listing) |
| Other contacts | (leave blank) |
| Google point of contact | (leave blank) |
| Preferred Language | English |
| App Name | SnapCravings: AI Recipe Photo (must match the live listing title; check Console) |
| Package ID | app.snapcravings.twa |
| Channel for review | **Production** |
| Version Code | **2** (from android/twa-manifest.json, versionName 1.0.1; recheck in Console > Release > App bundle explorer before submitting) |
| Desired feature date | **Thanksgiving/holiday submission:** earliest date the form allows; **New Year submission (by Dec 1):** **2027-01-04** |
| Devices | **Phone** (7\" and 10\" tablet screenshots now exist in marketing/play-assets, but the tablet layout is the phone layout centered, so leave Tablet unticked unless Chris wants to try) |
| Regions | **Americas: US** first; add Latin America, Brazil, India, Indonesia, France, Germany, Middle East, Turkey only where the localized Play listing is uploaded (drafts in marketing/play-listings/; es-419 still needs a listing) |
| Languages your App supports | **English**, **Spanish / LatAm Spanish**, Portuguese (Brazil), Hindi, Indonesian, French, German, Arabic, Russian, Turkish |
| New launch, major update or minor update? | New launch |
| Launch Date and time | The real approval date/time, e.g. "Nov 9, 2026, 9:00 AM PST" |
| Will you launch on all major platforms simultaneously? | **No: Android-First** |
| Why is featuring important for you at this time? | See text A |
| Markets prioritized with extra marketing? | See text B |
| Context for those markets | See text C |
| Would you like to provide more info? | Yes |
| Pitch materials (link) | Google Drive link to a 5-slide deck (outline below; Chris to approve sharing "anyone with link can view") |
| Marketing / user acquisition plan (incl. budget) | See text D |
| Main monetization model | **Subscription** |
| Why could your launch succeed? | See text E |
| Soft launch metrics (only shown for some paths) | "No soft launch; internal and closed testing only since Nov 1, 2026. Retention data not yet available." (Do not invent numbers.) |

### Text A: Why featuring matters now (paste)
Holiday cooking and New Year resolutions are the two moments when people most want help in the kitchen. SnapCravings, built by Sacramento founder Chris Magee at his small studio Everborn, turns a photo of your fridge into recipes that fit your diet and allergies, shows whether cooking beats ordering, plans a full holiday menu for your guests with a timeline, and in January helps people meal-prep and track macros by snapping their plate. It speaks 10 languages and runs on free-tier AI, so the free plan stays useful. We are launching Android first, and editorial placement in a holiday-cooking or New Year healthy-eating collection would put it in front of exactly the people it was made for.

### Text B: Prioritized markets
United States, with English and full Spanish (US Hispanic and Latin America). The app switches to the phone's language automatically (10 languages) and its allergy checks work in each of them.

### Text C: Why these markets
Our launch audience and email list are in the US. The app runs in 10 languages end to end (recipes, diet rules and allergy checks run in each language, with local food names), and home cooks who don't use English are poorly served by recipe apps in this category.

### Text D: Marketing / UA plan
Launch week: email announcement to our own opt-in contacts in English and Spanish, short-form videos (TikTok, Reels, Shorts) 4-5 per week for 4 weeks produced in-house, maker posts in communities that allow them (Product Hunt, r/SideProject, r/androidapps), free app directories. January: a "New Year meal prep" video series and seasonal collections inside the app (holiday cooking now, meal prep in January). Paid: an optional small test of $5-10 per day only after organic results are in. In-app: a gentle Google Play rating link after a user saves a recipe, and a "Share this recipe" button.

### Text E: Why this launch could succeed
1) Clear daily use: "what can I make with what I have?" every evening. 2) Real differentiation: allergy-safe hard rules, a cook-vs-delivery cost check, plate scans for macros, a macro-aware meal-prep planner, a holiday menu planner and 10 built-in languages, at $3.99/month founders price versus $7.99 for the closest competitor. 3) Free tier that is actually useful (3 fridge scans a week, unlimited cravings and library). 4) Seasonal content in the app (collections) gives editors a fresh angle every month.

## Before you submit (checklist)
- [ ] App is live in Production (approval email received).
- [ ] Store listing localized: add **Spanish (Latin America) es-419** listing in Console (copy in LISTING_ASO.md, translate the short and full description; the bot can draft it on request).
- [ ] Store settings > "External marketing" left ON.
- [ ] Upload the NEW screenshots (marketing/play-assets/screenshots/<lang>/phone, 8 per language) and feature-graphic-1024x500.png; optional tablet sets in tablet-7in / tablet-10in.
- [ ] Promo video: Chris approves promo-draft.mp4 (or the re-cut), uploads to YouTube (unlisted, ads off) and pastes the link in the listing.
- [ ] Pitch deck in Drive, sharing "anyone with the link can view" (needs Chris's OK to share).
- [ ] Chris clicks Submit. (Bot does not submit.)

## Pitch deck outline (5 slides, existing app style, no redesign)
1. SnapCravings: snap your fridge, cook what you crave. An Everborn Production. (Home screenshot)
2. The January problem: takeout spend, food waste, diet goals. Our answer: scan, crave, prep. (Scan result + meal-prep screenshots)
3. What is different: allergies are hard rules; Cook it or order it savings; 10 languages built in; fitness/macros mode in the meal-prep planner; holiday mode. (Settings + compare screenshots)
4. Launch and January plan: dates, channels, seasonal collections. (Calendar from VIDEO_PLAN.md)
5. Pricing and team: free 3 scans/week; Pro $3.99 founders, $4.99, $39.99/yr via Google Play Billing. Contact.

## Also free on the Google side (no form)
- Reply to every review within 24 h (Console > Ratings and reviews).
- Keep Android vitals under 1.09% crash / 0.47% ANR.

- Source: form opened live via curl; requirement summary cross-checked with appranker.net/blog/get-featured-on-google-play (Oct 16, 2026).

## Second form, better fit: Apps Innovation Corner (US homepage collection for small developers)
**URL (opened Nov 2, 2026):** https://support.google.com/googleplay/contact/indie_corners?hl=en ("Indie Games/ Up-and-Coming Apps Featuring Request").
Criteria on the form: team 1-30, self-funded or small investment; **rating 4.0+**; launched within 2 years; developer based in the US. Collection on the Apps tab of the US homepage, refreshed at least quarterly. So: **submit once we have a 4.0+ average with real ratings** (aim for launch week +7 to +14 days).
| Field | Answer |
|---|---|
| App or Game? | App |
| Developer (company) name | Everborn Marketing LLC |
| Team size | 1-5 (Chris: confirm) |
| Outside investment | $0-$5M (self-funded) |
| Contact e-mail | everbornproductions@gmail.com (confirm) |
| Contact name | Chris Magee (confirm) |
| App name | SnapCravings |
| Package ID | app.snapcravings.twa |
| Current development stage | Released |
| Business model | The form shows Premium / F2P: choose **F2P** (free with optional subscription) |
| Planned (full) launch date | actual Play approval date |
| Devices | Phone |
| Other significant update | "January 2027: New Year meal-prep collection and fitness/macros planner updates; Spanish (LatAm) store listing." |
