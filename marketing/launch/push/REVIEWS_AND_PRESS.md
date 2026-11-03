# Reviews, ratings and press (drafts only — nothing sent, nothing posted)
Written Nov 2, 2026 for the Google Play featuring push. Goal: a real 4.0+ average with 25+ ratings within ~2 weeks of Play approval (Apps Innovation Corner needs 4.0+), and a few honest stories in food, tech and Sacramento press.

## 1. The in-app rating card that already exists (web/grow.js, checked in code)
- Shows only inside the Android app from Google Play (TWA detection: Play referrer or Play Billing).
- Trigger: the first time a user saves a recipe to favorites (a success moment), 1.5 s after the save.
- Throttle: at most once every 30 days per device (`sc.reviewAskedAt`), once per session.
- It is a plain card with a "Rate us on Google Play" link (market:// link) and "Not now". It does not call the native In-App Review API.
- Policy note for Chris: the card's title is "Enjoying SnapCravings?". Google's rules forbid asking a question before the native review dialog; for a plain link card it is allowed, but the neutral wording is safer: "A quick rating on Google Play helps other cooks find us." (already the subline). Suggested change (needs your yes; web/ is another worker's area): drop the question title.
- Next step already specced: marketing/launch/IN_APP_REVIEW_SPEC.md (native Play In-App Review via a tiny Android activity; trigger after recipes + favorite or a 2nd scan on another day, installed 2+ days, never after a paywall or error).
- Add (suggested): a second trigger after a successful plate scan "Add to today" and after a Holiday planner menu, same 30-day throttle.

## 2. Asking early users (neutral, no rewards, everyone gets the same ask)
Allowed: ask everyone neutrally, reply to every review within 24 h, fix what reviews report and say so in the reply.
Not allowed (Play policy): free Pro/scans/codes for reviews, asking only happy users, asking for 5 stars, asking friends, family or Everborn staff to post reviews, review swaps, paid reviews.

### Email to early testers (L+3; reuse marketing/launch/emails/L2-howto.txt slot) — DRAFT
Subject: Did SnapCravings help with dinner?
> Hi {FIRST_NAME},
> Thanks for trying SnapCravings early. If it helped you cook something (or saved you a delivery order), an honest rating on Google Play helps other home cooks find it: https://play.google.com/store/apps/details?id=app.snapcravings.twa
> If something went wrong, just reply. I read every email and fix what I can.
> Chris, SnapCravings (an Everborn Production)

### Text for friends who already USE the app (Chris sends from his phone; only people who really used it)
> Hey! If SnapCravings has been useful, an honest Play Store rating would help a ton. If it bugged you, tell me instead and I'll fix it 🙏 [Play link]

### Review replies (templates; reply within 24 h)
- Positive: "Thank you, {name}! Glad {feature they named} helped. Tip: try Scan my plate for a quick macro estimate. — Chris"
- Bug: "Sorry about that, {name}. I fixed {issue} in today's update / I'm working on it now. Could you email us at the support address on this listing with your phone model? — Chris"
- Wrong ingredient/estimate: "Thanks for flagging it. You can tap an ingredient to fix it, or use 'Fix it' on a plate scan and recalculate. I'm also tuning the AI. — Chris"

## 3. Press list (verify each contact on the outlet's site before sending; no addresses guessed here)
| # | Outlet | Beat / why | How to reach (verify) | Angle |
|---|---|---|---|---|
| 1 | The Sacramento Bee | Local business + food | sacbee.com > Contact / newsroom tips; food writers' bylines | Sacramento founder builds a food-waste app in 10 languages |
| 2 | Sacramento Business Journal | Local startups | bizjournals.com/sacramento > Contact the newsroom | Self-funded local studio, Android launch |
| 3 | Comstock's Magazine | Capital-region business | comstocksmag.com > Contact | Small studio, AI on a free tier |
| 4 | Sactown Magazine | Local lifestyle | sactownmag.com > Contact | Holiday planner for Sacramento hosts |
| 5 | Sacramento Magazine | Food & local | sacmag.com > Contact | Thanksgiving menu + leftovers |
| 6 | CapRadio (NPR Sacramento) | Local news, tech/food | capradio.org > News tips | Food waste and family budgets |
| 7 | KCRA 3 / ABC10 / FOX40 / KCRA "Sacramento & Co." | Local TV segments | station "Contact / news tips" pages | Holiday-hosting demo segment |
| 8 | Sacramento News & Review | Local culture | newsreview.com/sacramento | Local maker story |
| 9 | Android Police | Android apps | androidpolice.com > Contact / tips | New Android app: fridge photo to recipes, plate macros |
| 10 | Android Authority | Android apps | androidauthority.com > Contact | Same; 10 languages |
| 11 | 9to5Google | Google/Play apps | 9to5google.com > Tips | Play Billing + TWA indie app |
| 12 | Droid Life / Phandroid | Android apps | site contact pages | App of the week pitch |
| 13 | Lifehacker | Practical apps | lifehacker.com > Contact | Use what's in your fridge, save on takeout |
| 14 | The Kitchn | Home cooking | thekitchn.com > Contact | Leftovers + meal prep with a photo |
| 15 | Serious Eats / Food & Wine / Bon Appétit (digital) | Food | site contact pages | Holiday menu planner with a timeline |
| 16 | Eater (national) / Eater SF | Food culture | eater.com > Tips | Cook vs order cost check |
| 17 | Food Tank / ReFED newsletter | Food waste | foodtank.com contact; refed.org > Contact | Reducing household food waste |
| 18 | Product Hunt | Tech launch | producthunt.com (Chris posts as maker) | Launch day (see LAUNCH_DAY_KIT.md) |
| 19 | Fitness/nutrition blogs (e.g., Nerd Fitness, MyFitnessPal blog) | January macros | site contact pages | New Year: snap your plate for macros |
| 20 | Spanish-language: Univision Sacramento (KUVS 19), Telemundo Sacramento | Local Spanish news | station tips pages | App fully in Spanish for local families |

### Pitch email — DRAFT (send nothing; Chris approves wording, recipient and timing)
Subject: Sacramento founder's app turns a fridge photo into dinner (and a Thanksgiving plan)
> Hi {NAME},
> I'm Chris Magee, a one-person founder here in Sacramento (Everborn). I just launched SnapCravings on Google Play. You snap your fridge and it suggests recipes that fit your diet and allergies, shows whether cooking beats ordering, and plans a full holiday menu with a shopping list and cooking timeline for your guests. You can also snap a plated meal for an estimated calorie and macro count.
> I built it because my own nights ended with "nothing to eat," a $30 delivery order and food going bad in the fridge. It works in 10 languages, including Spanish, Hindi and Arabic, and the free plan stays useful because it runs on free-tier AI.
> Happy to do a quick demo, send screenshots (attached) or give you Pro access to try it.
> Chris Magee · SnapCravings · {PHONE} · https://play.google.com/store/apps/details?id=app.snapcravings.twa
Attach: 3 phone screenshots from marketing/play-assets/screenshots/en/phone (1-home, 6-hplan, 4-dish) + feature graphic.

### Timing
- Sacramento + holiday angle: the week after Play approval, before Thanksgiving (Nov 26).
- Android tech sites: launch day + 1 (with the Play link live).
- Food sites: holiday angle now; fitness/nutrition angle Dec 1-15 for January stories.
