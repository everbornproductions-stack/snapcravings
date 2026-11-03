# SnapCravings — one-page plan (DRAFT)

*Name: SnapCravings (chosen by Chris 2026-10-20; trademark check pending) · Catchphrase: "Make it or take it?" · an Everborn product · Everborn Productions, Sacramento CA · Draft 2026-10-20, internal, not market-tested*

## Problem
When a craving hits, people don't know whether to cook with what they have or order in, and they can't see what ordering really costs. The menu price hides markups, delivery, service and small-order fees, tax and tip, and those differ across DoorDash, Uber Eats, Grubhub and ordering from the restaurant directly.

## Solution
One app with two doors:
1. **Snap it.** Photograph the fridge or pantry. AI identifies the ingredients and suggests craving-matched recipes with full steps, plus a list of what's missing.
2. **Crave it.** Name a craving. The app shows whether making it (grocery cost of the missing items, e.g. via Instacart) or buying it is cheaper. It compares all-in totals: DoorDash, Uber Eats, Grubhub, restaurant direct, pickup vs. delivery, menu markups, delivery/service/small-order fees, tax, tip, and memberships (DashPass, Uber One). Then it builds the cart.

## Target user
Budget-aware people who order delivery often and want to cook more or spend less without giving up the thing they're craving. Launch market: Sacramento.

## Differentiation
- Photo-to-recipe is crowded: SuperCook, Samsung Food (Vision AI in paid Food+), ChefGPT, Pantry Pic. Savorly, Ingreedi, Custrd, ScanMyPantry and EatIn already send missing items to Instacart.
- Price comparison is thin: FoodBoss looks stagnant (last app update Sep 2023). MealMe pivoted to a B2B ordering API with a "cheapest quote" setting.
- **No app combines make-vs-buy.** That comparison is the wedge; photo recipes are table stakes.
- The cost gap is real: a 2024 FinanceBuzz analysis found menu markups of 69% (Uber Eats) to 83% (DoorDash).

## MVP features
- **Phase 1 (legal-safe):** photo recipes; missing items sent to an Instacart cart; cook-vs-order using the Instacart grocery cost and the restaurant's pickup price; a **screenshot price check** (the user uploads their own checkout screen and the app reads the totals; no scraping).
- **Recipe results order (Chris's rule):** first, cards for recipes you can make right now with what you have ("Ready now: let's get cooking!"); below, "Make it with a few more things" cards that show the missing items and a button into the Grocery List.
- **Grocery List ("Restock time!"):** one list built from what a recipe is missing and what the fridge photos show running low, plus manual add, quantities and check-off; one tap sends it to Instacart with the estimated cost.
- **Phase 2:** license the MealMe API for live multi-app quotes and ordering.

## Brand Voice
Fun, upbeat, quick. Short exclamations and catchphrases on every key screen; keep the money claims honest (savings are shown, never promised).
Catchphrases: "Let's get cooking!" · "Fridge to fabulous!" · "Craving unlocked!" · "Make it or take it?" · "Your fridge has ideas!" · "Pantry power!" · "Crave smarter, not harder." · "Dinner, decided!" · "Fees? We see 'em." · "Snap. Cook. Yum!"

## Monetization (PROPOSAL, not market-tested)
- **Free:** limited photo scans and recipes.
- **Pro: $4.99/mo or $39.99/yr.** Unlimited photo scans, make-vs-buy comparison, saved favorites.
- **Later:** affiliate/partner revenue from grocery orders (e.g. the Instacart partner program).
- Caution: competitors in photo-to-recipe are mostly free, so Pro has to be sold on make-vs-buy, not on scanning.

## Risks
- DoorDash, Uber Eats and Grubhub have no public pricing APIs.
- Platforms push back on outside access: Uber revoked Urbanhail's API access (2016), and Instacart sued Cornershop over scraping (settled 2022). So: no scraping, ever.
- Willingness to pay is unproven in a mostly free category.
- AI ingredient recognition can be wrong, so users must be able to edit the ingredient list.

## Next steps
1. Chris picks a name (top 3 in names.md) and approves the scope.
2. Run 5–10 user interviews in Sacramento using the clickable prototype (prototype/index.html).
3. Check the Instacart partner program terms and MealMe API licensing and pricing.
4. Get a legal review of the screenshot price-check flow and the app-store wording.
5. Build Phase 1, then test Pro pricing with a small beta.

## Live: Holiday planner (2026-11-02)
- **Holiday planner** (next to the holiday banner, only during a holiday window, per country): a full holiday menu (mains, sides, desserts, drinks) for 2-30 guests with diet/allergy rules and the optional fridge scan, a shopping list scaled to the guest count (can be added to the grocery list) and a cooking timeline counted back from the meal time. Free: menu + the first 3 timeline steps; Pro: full timeline and shopping list. 10 languages.

## Live: Dish scan for macros (2026-11-02)
- **Scan my plate** (Snap screen card, #dish): one photo of a plated meal gives the dish name plus estimated kcal, protein, carbs, fat, fiber, sugar and sodium per serving; portion (small/regular/large) and servings rescale live; the user can fix the dish or ingredients and recalculate (no scan used); optional daily log compared with Meal prep's calorie/protein targets. Labeled 'AI estimate, not medical advice.' Free: 1 dish scan per 7 days; Pro: unlimited. 10 languages. AI: Gemini 3.5/3.1 flash-lite, then Workers AI Llama 4 Scout, strict JSON with range + energy validation.

## Roadmap (NOT live; never list these as current features in store, site or launch copy)
- (nothing listed right now)
