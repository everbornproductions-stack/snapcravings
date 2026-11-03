# Free channels: directories, AI-app lists, launch sites (prepared, NOT submitted)
Each submission is public and needs **Chris's yes**. URL check done Nov 2, 2026 ~2:10 AM PT from the box with curl (desktop Chrome user agent) and headless Chrome:
- **200** = page loaded. **CF** = site exists but shows a Cloudflare "Just a moment" bot check to the box (open it in a normal browser; it will load). Dropped from the list: futurepedia.io/submit-tool (404), aitoolhunt.com (domain now serves an unrelated APK site), allthingsai.com (no response).
- Many AI directories now charge for fast-track listing. Use the **free** option only; if a site only offers paid, skip it (paid = needs Chris).

## Shared copy (paste into any form)
- **Name:** SnapCravings
- **URL:** https://snapcravings.pages.dev  (after launch also: https://play.google.com/store/apps/details?id=app.snapcravings.twa)
- **Tagline (60):** Snap your fridge, get recipes that fit your diet
- **Short (140):** Snap your fridge and get recipes for your cravings, diet and allergies. Plan meal prep, compare cooking vs delivery. In 10 languages.
- **Long (~600):** SnapCravings turns photos of your fridge, pantry and spices into recipes for what you're craving, fitted to your diet, with allergies treated as hard rules (never suggestions). "Cook it or order it" shows whether making a dish beats delivery once fees and tip are in. A weekly meal-prep planner with a fitness/macros mode builds a week of meals and one grocery list. There is a rated recipe library with seasonal collections, and a place to save family recipes and adapt them to your diet. Recipes stream in one by one, a growing library gives instant matches, and holiday mode adds Holiday foods for your country's holidays. In 10 languages, including full Spanish and right-to-left Arabic. Free: 3 scans a week. Pro: $3.99/mo founders price (first ~100), then $4.99/mo, or $39.99/yr.
- **Pricing:** Freemium. **Platforms:** Android (Google Play), Web, iPhone via web app.
- **Category:** Food & Drink / Lifestyle / AI recipe generator. **Tags:** recipes, meal planning, meal prep, AI, cooking, food waste, allergies, holiday recipes, multilingual
- **Maker:** Everborn ("An Everborn Production"). **Contact:** everbornproductions@gmail.com (confirm which address Chris wants public)
- **Competitors to name (only where the form asks):** SuperCook, DishGen, ChefGPT, RecipeGenie
- **Assets:** icon web/icons/icon-512.png; the 4 Play screenshots; feature graphic 1024x500; 30 s demo (VIDEO_PLAN #1)
- **Spanish short:** Tómale foto a tu refri y recibe recetas para tus antojos, tu dieta y tus alergias. Planea tu semana y compara cocinar vs pedir.

## Launch sites
| Site | URL | Check | Copy notes |
|---|---|---|---|
| Product Hunt | https://www.producthunt.com/posts/new | CF | Full kit in LAUNCH_DAY_KIT.md. Launch 12:01 AM PT Tue-Thu. |
| AlternativeTo | https://alternativeto.net/manage-item/ | CF | Kit in LAUNCH_DAY_KIT.md; list as alternative to SuperCook, DishGen. |
| BetaList | https://www.betalist.com/submit | 200 | Free queue is slow (weeks); fine for pre-iOS. Use Short + Long. |
| Indie Hackers products | https://www.indiehackers.com/products | 200 | Add product + a "how I built it" post (TWA + Play Billing story). |
| SaaSHub | https://www.saashub.com/submit | 200 | Use Long; alternatives: SuperCook, DishGen. |
| Launching Next | https://www.launchingnext.com/submit/ | 200 | Free listing. |
| Uneed | https://www.uneed.best/submit-a-tool | 200 | Free waiting line; pick a launch day. |
| Peerlist Launchpad | https://peerlist.io/launchpad | 200 | Weekly launches, needs a Peerlist profile. |
| DevHunt | https://devhunt.org/ | 200 | Dev-tool focused; low fit, optional. |
| Microlaunch | https://www.microlaunch.net/ | CF (526 to curl) | Optional. |
| TinyLaunch | https://tinylaunch.com/ | 200 | Free weekly launch. |
| Startupbase | https://www.startupbase.io/ | 200 | Simple listing. |
| Show HN | https://news.ycombinator.com/showhn.html | 200 | Title: "Show HN: SnapCravings, recipes from a photo of your fridge (allergies as hard rules)". Be around for comments. |

## AI tool directories
| Site | URL | Check | Notes |
|---|---|---|---|
| There's An AI For That | https://www.theresanaiforthat.com/submit/ | CF | Has paid tiers; use free only if offered. |
| Futurepedia | https://www.futurepedia.io/ | 200 (submit page 404) | Find "Submit a tool" in the site menu; often paid. |
| Future Tools | https://www.futuretools.io/submit-a-tool | 200 | Free form, curated. |
| TopAI.tools | https://topai.tools/submit | 200 | |
| AI Tools Directory | https://aitoolsdirectory.com/submit-tool | 200 | |
| Toolify | https://www.toolify.ai/submit | CF | Has paid option. |
| Aixploria | https://www.aixploria.com/en/add-ai/ | 200 | |
| Insidr | https://insidr.ai/submit-tools/ | 200 | |
| EasyWithAI | https://www.easywithai.com/submit-tool/ | 200 | |
| AI Finder | https://ai-finder.net/submit | 200 | |
| AITopTools | https://aitoptools.com/account/submit-tool/ | 200 | Needs an account. |

## App directories and stores
| Site | URL | Check | Notes |
|---|---|---|---|
| AppAgg | https://www.appagg.com/ | 200 | Android app index; usually picks up Play apps itself; claim the listing. |
| Crunchbase | https://www.crunchbase.com/ | 200 | Add Everborn + SnapCravings product (free account). |
| G2 | https://www.g2.com/ | CF | Listing is free but B2B-oriented; low priority. |
| GetApp / Capterra | https://www.capterra.com/vendors/sign-up | CF (403) | B2B software; skip unless cheap. |

## Search and discovery basics (free, high value)
| Item | URL | Check | Note |
|---|---|---|---|
| Google Search Console | https://search.google.com/search-console | 200 | Verify snapcravings.pages.dev, submit sitemap. **Blocker:** web/_headers sends `X-Robots-Tag: noindex` for every page, so Google will NOT index the site. Recommend removing it for `/` and `/privacy.html` (needs Chris's yes, it changes how the public site is found). |
| Bing Webmaster Tools | https://www.bing.com/webmasters/ | 200 | Same, after noindex decision. |
| Google Business Profile | https://g.page/ | 429 to curl (rate limit) | Only if Chris wants a local business listing for Everborn. |
| Pinterest business | https://www.pinterest.com/business/create/ | 200 | Recipe pins are a strong free channel: 1 pin per Library recipe image + link. |
| YouTube (Shorts) | https://www.youtube.com/ | 200 | Same cuts as TikTok/Reels; also the Play listing promo video. |
| TikTok | https://www.tiktok.com/ | 200 | |

## Communities (rules first, see LAUNCH_DAY_KIT.md)
r/SideProject, r/androidapps, r/AndroidAppShowcase (200 each). r/MealPrepSunday, r/EatCheapAndHealthy, r/glutenfree: answer questions only, no promo posts. Reddit blocked rule-page reads from the box, so read rules in a browser on the day.

## Allergy and food orgs (outreach, not directories)
- FARE (https://www.fare.org/, 200) and AllergyEats (https://www.allergyeats.com/, 200): no submission form; possible later outreach email to their partnerships contacts once the app has ratings. Draft on request; sending needs Chris.
