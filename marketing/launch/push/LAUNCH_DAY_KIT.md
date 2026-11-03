# Launch Day Kit: the day Google Play approves SnapCravings
Play link: https://play.google.com/store/apps/details?id=app.snapcravings.twa
Everything marked **[CHRIS YES]** is public, sends something, or spends money: the bot prepares it, Chris says go.
Times are Pacific (PT). If approval lands late in the day, do hours 0-2 that day and start the waves at 9 AM the next morning.

## Hour 0: confirm it is really live (bot can do all of this)
- [ ] Open the Play link logged out and on a phone: listing shows, Install works, app opens to the home screen (not a browser bar; if a URL bar shows, Digital Asset Links broke: check https://snapcravings.pages.dev/.well-known/assetlinks.json).
- [ ] In the installed app: snap 1 photo, open a recipe, tap ♡: the "Enjoying SnapCravings?" card should show ~1.5 s later and open the Play listing.
- [ ] Pro screen shows Google Play prices ($3.99/mo and $39.99/yr), not Stripe.
- [ ] Console: no policy warnings; Android vitals page reachable.

## Hour 1: flip the site to Play (one line) [CHRIS YES for deploy]
1. In `web/config.js` set `PLAY_LIVE: true`. This turns on the "Get SnapCravings on Google Play" card at the top of the home screen for Android **browser** visitors only (never inside the app, never on iPhone/desktop, dismissible).
2. Bump the cache tag: `sed -i 's/v=ui30/v=ui31/g' web/index.html` and the same in `web/sw.js` (VERSION and SHELL). Use whatever the current tag is (`grep -o 'v=ui[0-9]*' web/index.html | head -1`).
3. `node --test test/`, then `npx wrangler pages deploy web --project-name snapcravings --branch main` (export CLOUDFLARE_ACCOUNT_ID first, see lessons), commit, push.
4. Check: `curl -s https://snapcravings.pages.dev/config.js | grep PLAY_LIVE` says true; open the site in Chrome on an Android phone and see the card.

## Hour 1-2: email [CHRIS YES to send]
- Use `marketing/announce-play.html` + `announce-play.txt` (English) and `announce-play-es.html` + `announce-play-es.txt` (Spanish). The big button and the Android line now go to the Play link; iPhone keeps the web app.
- Subject ideas: see marketing/SUBJECTS.md. Suggested: "SnapCravings is on Google Play 📲" / "SnapCravings ya está en Google Play".
- Follow DELIVERABILITY.md waves (do not send the whole list in one day).

## Hour 2: friends wave (26 people) [CHRIS YES to send]
Lists: `marketing/contacts/friends_wave1.csv` (17) and `friends_maybe.csv` (9). Columns: email, first_name, account_found_in, threads_count, last_contact_date. These are private, gitignored, never posted.
- Wave 1 (17): personal email from Chris's own Gmail, one by one or BCC-free (each to one person), using the friend email below.
- Maybe list (9): send only to people Chris really knows; skip anyone he would not text.

### Friend email (EN)
Subject: I made an app, would love you to try it
> Hey {first_name}, I just launched SnapCravings on Google Play. You snap a photo of your fridge and it gives you recipes for what you're craving, and it can plan a week of meals. It's free to try: https://play.google.com/store/apps/details?id=app.snapcravings.twa (iPhone: https://snapcravings.pages.dev in Safari, then Add to Home Screen).
> If you try it, tell me honestly what worked and what didn't. That helps more than anything. Thanks! Chris

### Friend email (ES)
Asunto: Hice una app, me encantaría que la probaras
> Hola {first_name}, acabo de lanzar SnapCravings en Google Play. Le tomas foto a tu refri y te da recetas para lo que se te antoja, y te planea una semana de comidas. Es gratis para probar: https://play.google.com/store/apps/details?id=app.snapcravings.twa (iPhone: https://snapcravings.pages.dev en Safari y luego Agregar a inicio).
> Si la pruebas, dime con toda honestidad qué te gustó y qué no. Eso me ayuda muchísimo. ¡Gracias! Chris

## Text-message templates for close friends [CHRIS sends from his phone]
**Policy note:** Google Play forbids incentivized or fake ratings and the existing plan says not to ask friends/team to post reviews. Safe wording: ask them to *try it* and, *if they actually used it*, leave an *honest* review. Never offer anything for a review, never ask for "5 stars", never ask people who haven't used it.
1. "Hey! I finally launched my app SnapCravings on Google Play 🎉 Snap your fridge, get recipes. Would mean a lot if you tried it tonight: https://play.google.com/store/apps/details?id=app.snapcravings.twa"
2. (2-3 days later, only if they said they used it) "Thanks for trying SnapCravings! If it was useful, an honest review on Google Play really helps a new app get found. And tell me anything that bugged you."
3. Short: "My app is live 🙌 SnapCravings, free on Android: https://play.google.com/store/apps/details?id=app.snapcravings.twa. Tell me what you cook!"
4. ES: "¡Ya salió mi app SnapCravings en Google Play! 🎉 Le tomas foto a tu refri y te da recetas. ¿La pruebas hoy? https://play.google.com/store/apps/details?id=app.snapcravings.twa"
5. ES seguimiento (solo si la usó): "¡Gracias por probarla! Si te sirvió, una reseña honesta en Google Play ayuda mucho a que la gente la encuentre."
6. iPhone friends: "It's on Android today; on iPhone open https://snapcravings.pages.dev in Safari and tap Share > Add to Home Screen. App Store version soon."

## Hour 3: social posts [CHRIS YES to post]
Use LAUNCH_POSTS.md (X/Facebook short post, reels #1-#2) with [PLAY_LINK] = the Play link (or a custom store listing URL). Video scripts and calendar: VIDEO_PLAN.md.
- Instagram/TikTok bio link: switch to the Play link.
- Facebook personal post (EN): "After a lot of late nights: SnapCravings is live on Google Play. Snap your fridge, get recipes for what you're craving, plan a week of meals, and see if cooking beats delivery. Free to try. Feedback welcome! [PLAY_LINK] An Everborn Production."
- Facebook personal post (ES): "¡Después de muchas noches de trabajo, SnapCravings ya está en Google Play! Tómale foto a tu refri, recibe recetas para tus antojos, planea tu semana y mira si cocinar sale mejor que pedir. Gratis para probar. [PLAY_LINK]"

## Hour 4+: communities (follow each group's rules, no spam) [CHRIS YES per post]
Reddit's rules pages could not be read from the box (blocked), so **open each sub's sidebar/rules on the day** before posting. General rules: post as the maker, disclose it, one post per community, reply to every comment, no vote asking, no cross-posting the same text everywhere the same day.
| Where | Fit | Angle | Notes |
|---|---|---|---|
| r/SideProject | Yes, maker posts welcome (check rules) | "I built..." story + what I learned | Body in LAUNCH_POSTS.md |
| r/androidapps | Usually a weekly self-promo thread or flair | Android launch | Check for "Self-promotion" thread first |
| r/AndroidAppShowcase | Built for this | Short description + screenshots | |
| r/MealPrepSunday, r/EatCheapAndHealthy, r/glutenfree, r/FoodAllergies | Usually NO self-promo | Don't post the app. Answer real questions helpfully; mention the app only if directly asked | Risk of ban |
| Show HN (news.ycombinator.com/showhn.html) | OK if it's something people can try | "Show HN: SnapCravings, recipes from a photo of your fridge, allergies as hard rules" | Technical angle (TWA, Play Billing via Digital Goods API, allergy rule engine in Spanish) |
| Facebook groups (meal prep, allergy parents, Spanish-language cooking, Sacramento local) | Only groups that allow promo posts or have a promo day | "Free tool I made" + ask for feedback | Ask an admin first when unsure |
| Nextdoor (Sacramento) | Local business posts only in the right section | "Local Sacramento maker" | |

## Day 1-2: launch sites and directories [CHRIS YES to submit]
Copy for each is in FREE_CHANNELS.md. Order: Product Hunt (schedule for 12:01 AM PT on a Tue-Thu), AlternativeTo (as an alternative to SuperCook, DishGen, ChefGPT), then the AI directories.

### Product Hunt (prepared)
- Name: SnapCravings
- Tagline (60 max): "Snap your fridge, get recipes that fit your diet" (48)
- Topics: Android, Food & Drink, Artificial Intelligence, Health & Fitness
- Description (260 max): "Snap your fridge and get recipes for what you're craving, fitted to your diet and allergies (allergies are hard rules). Plan a week of meal prep with macros, see if cooking beats delivery, save family recipes. 10 languages. 3 free scans a week."
- First comment: "Maker here 👋 I built SnapCravings to stop the 'nothing to eat, order $30 delivery' loop. Allergies are enforced as hard rules (it checks recipes, steps and tips, in all 10 languages). Pro is $3.99/mo for the first 100 founders. I'm here all day: tell me where ingredient detection gets it wrong."
- Gallery: the 4 Play screenshots + 1 short video (VIDEO_PLAN #1).
- Links: Play link + https://snapcravings.pages.dev

### AlternativeTo (prepared)
- Alternative to: SuperCook, DishGen, ChefGPT, RecipeGenie (Chris: only claim what is true for each)
- Platforms: Android, Web (Online), iPhone via web app
- License: Freemium
- Description: "SnapCravings turns photos of your fridge, pantry and spices into recipes for what you're craving, filtered for your diet with allergies as hard rules. It compares cooking a dish with ordering it (fees and tip included), plans a week of meal prep with a fitness/macros mode, keeps a rated recipe library with seasonal collections, adapts your family recipes, and adds Holiday foods around your country's holidays. In 10 languages. Free: 3 scans a week. Pro: $3.99/mo founders, then $4.99, or $39.99/yr."
- Tags: recipes, meal-planning, ai, cooking, food-waste, allergies

## End of day 1: watch and respond (bot)
- [ ] Console > Ratings and reviews: draft replies for every review (Chris posts within 24 h).
- [ ] Android vitals: crash < 1.09%, ANR < 0.47%.
- [ ] /stats.html (owner key) for scans, favorites, review_card, review_go, share_recipe, play_banner, play_go events.
- [ ] Submit the featuring nomination (FEATURING_GOOGLE.md) within 2 days [CHRIS YES].
