# SnapCravings Google Play launch plan (Nov 2 – launch day L+7)
Launch day "L" = the day Play approves production (expected ~Nov 6-9). Dates below are relative where review timing is unknown. Sources: SOURCES.md. Owners: **Chris** (Console/accounts/money/approvals), **Bot** (main Grok Bot: copy, assets, analytics, email drafts), **Everborn Reels / Capital City Reels** (IG reels).

## Principles (what actually moves a new Play app)
- Google-confirmed: listing text relevance (title > short desc > long desc), ratings/reviews, engagement/retention, Android vitals (stay < 1.09% crash, < 0.47% ANR or you lose visibility).
- Industry-observed (not confirmed): install velocity and uninstall rate. So: concentrate traffic into launch week (email + reels same 3-4 days), but send people who will actually use it (low uninstall).
- No pre-registration: it only works before a production release and the app is already in review — skip it.
- LiveOps/promotional content: not available to us (apps need Premium Growth Tools: 120k MAU + $ thresholds). Skip.
- Free & useful now: custom store listings, store listing experiments (after ~1-2k listing visitors), promo codes, review replies.

## Pre-launch (Nov 2 → L-1)
| Day | Owner | Action | Done when |
|---|---|---|---|
| Nov 2 | Chris | Decide Pro billing in the Android build (Stripe vs Play Billing – see IN_APP_REVIEW_SPEC.md "launch blocker"). If review rejects for payments, everything slips. | Decision made |
| Nov 2 | Bot | Paste LISTING_ASO.md title/short/long into Console Main store listing draft (Chris approves & saves). | Listing saved |
| Nov 2-3 | Chris | Console: Store settings tags, contact email, privacy policy, Data safety, content rating all green. Set countries (US first; add CA/UK/AU English later). | No warnings |
| Nov 3 | Bot | Make 15-30s promo video from existing reel (fridge → recipes), upload unlisted to YouTube, hand Chris the URL. Optional 2 extra screenshots in existing style (diet/allergy, cook-vs-delivery). | URL ready |
| Nov 3 | Chris | Create 3 custom store listings: Email (unique URL), Reels (unique URL), Allergy (keyword-targeted). | URLs saved in this file |
| Nov 3-4 | Bot | Build in-app review per spec (branch only, Chris approves), test on internal track. | Card shows on test device |
| Nov 3-5 | Chris | Email wave 0: tester-invite to ~500 warmest contacts → closed/internal testing or web app; collect bug reports. Fix crashes before L. | <1% crash in test |
| Nov 4 | Chris | Promo codes: create one-time codes (e.g., 200 × 30-day Pro trial) for creators/testers — NO review requirement attached. (Requires Play Billing subscription product.) | Codes exported |
| Nov 4-5 | Reels bots | Pre-produce 6 reels (see LAUNCH_POSTS.md), schedule nothing until L. | 6 drafts approved |
| Nov 5 | Bot | Draft launch emails: L (announce), L+2 (how-to + neutral review ask), L+5 (founders price countdown). Plain-text style per DELIVERABILITY.md. Chris sends. | Drafts approved |
| L-1 | Bot | Prep Reddit/Product Hunt posts; check subreddit self-promo rules; PH listing as draft. | Ready |

## Launch week
| Day | Owner | Actions | Metrics to watch |
|---|---|---|---|
| **L (approved)** | Chris | Verify live listing on a phone, install from Play, do a full scan. Send email wave 1 (~5k most engaged) with the Email custom listing URL. | Installs, listing conversion rate (Console > Store performance), crashes |
| L | Reels bots | Post reel #1 + #2; link in bio → Reels custom listing URL. | Reel views, link taps |
| L | Bot | Post nothing itself; hourly-ish check: vitals, reviews (draft replies for Chris to post within 24h). | Crash/ANR rate, first ratings |
| L+1 | Chris | Product Hunt launch (12:01am PT), Reddit post #1 (r/SideProject or r/androidapps per rules). Email wave 2 (~8k). | PH upvotes, referral installs |
| L+1 | Reels | Reel #3 + TikTok cross-post. | |
| L+2 | Chris | Email wave 3 (~10k) "how to get the best scan" + neutral review ask. Reddit post #2 (r/EatCheapAndHealthy / r/MealPrepSunday only if rules allow; else comment helpfully). | Day-1 retention, ratings count/avg |
| L+3 | Chris | Optional Google Ads App campaign (installs) — see budget below. Reply to all reviews. | CPI, install→scan rate |
| L+3 | Reels | Reel #4 (allergy angle). | |
| L+4 | Chris | Email wave 4 (~10k). Fix top complaint from reviews; ship update if needed (reply "fixed in vX"). | Uninstall rate (Console > Statistics), D1/D3 retention |
| L+5 | Chris | Email wave 5 (rest ~10k) incl. founders-price countdown (only if spots truly remain). Reel #5. | Pro conversions, founders count |
| L+6 | Bot | Start store listing experiment if listing visitors > ~1,000: test title alt or screenshot order (50/50, 1 variant). | Experiment running |
| L+7 | Bot | Week-1 report: installs by source (custom listing URLs), conversion %, D1/D7 retention, rating avg/count, vitals, Pro subs, CPI. Recommend week 2. | Report |

## Small Google Ads budget (cost-conscious)
- Google recommends daily budget ≥ 50× target CPI; at a realistic ~$1-2 food-app CPI that's $50-100/day — above "cost-conscious". Recommendation: **skip ads launch week** (organic email + reels give the velocity). If Chris wants a test: App campaign, "Install volume", US, target CPI ~$1.00, $25-30/day for 10-14 days (~$350 cap), assets = existing screenshots + reels, route to Reels custom listing. Expect inflated CPI the first days (conversion delay; learning up to 7 days); judge after 2 weeks, then move to in-app action (scan) optimization.

## Targets (week 1, rough)
Listing conversion ≥ 25% (Food & Drink peers ~25-35%); D1 retention ≥ 25%; crash < 1.09%, ANR < 0.47%; ≥ 30 ratings avg ≥ 4.3; uninstall within 1 day < 20%.

## Do NOT
Offer anything for reviews; ask team/friends to review; buy installs/reviews; keyword-stuff or claim "#1"/"best"; send all 43k in one day (deliverability).

## Google Play featuring push (approved by Chris Nov 2, 2026; status as of Nov 2, 7 PM PT)
| # | Item | Status | Owner |
|---|---|---|---|
| 1 | Store screenshots: 8 screens x 10 languages, phone 1080x1920 + 7" + 10" tablet, captioned (marketing/play-assets/screenshots/) | Done (draft) | Bot |
| 2 | Feature graphic 1024x500 (marketing/play-assets/feature-graphic-1024x500.png) | Done (draft) | Bot |
| 3 | Promo video script + shot list (PROMO_VIDEO.md) and 30 s draft (promo-draft.mp4, silent, stills-based) | Done (draft) | Bot |
| 4 | Real promo cut with motion capture, music, voice-over | To do after Chris likes the draft | Bot builds, Chris approves |
| 5 | Upload promo video to YouTube (unlisted, ads off) and paste link in listing | Waiting | Chris |
| 6 | Upload screenshots, feature graphic and the 9 localized full descriptions in Play Console | Waiting on Play approval / review | Chris |
| 7 | Featuring pitch ready to submit (push/FEATURING_GOOGLE.md) | Done (draft) | Bot |
| 8 | Submit featuring form, holiday-cooking angle: the day Play approves the app | Waiting | Chris |
| 9 | Submit New Year healthy-eating angle (plate macros + meal prep), desired date Jan 4, 2027: by about Dec 1 | Waiting | Chris |
| 10 | Apps Innovation Corner form once rating is 4.0+ | Waiting on ratings | Chris |
| 11 | Reviews and ratings plan + email/text drafts + reply templates (push/REVIEWS_AND_PRESS.md) | Done (draft) | Bot |
| 12 | Neutral wording for the in-app rating card (drop "Enjoying SnapCravings?") | Needs Chris's yes | Bot builds |
| 13 | Press list (20 outlets: Sacramento, food, Android tech, Spanish-language) + pitch draft | Done (draft) | Bot |
| 14 | Verify press contacts and send pitches (Sacramento + holiday week after approval; tech launch day +1; fitness Dec 1-15) | Waiting | Chris sends (Bot can draft per outlet) |
| 15 | Fill the metrics table in the pitch (rating, installs, retention, vitals) | After 14 days live | Bot pulls, Chris checks |
| 16 | Reply to every Play review within 24 h | Ongoing after launch | Bot drafts, Chris posts |
