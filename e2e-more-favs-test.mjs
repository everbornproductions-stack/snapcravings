import p from 'puppeteer-core';
const base = 'https://snapcravings.pages.dev';
const ING = "eggs (12),milk,butter,cheddar,yogurt,chicken thighs (2 lb),ground beef,bacon,tofu,spinach,carrots,onions,garlic,bell peppers,tomatoes,potatoes,lemons,cilantro,broccoli,mushrooms,rice,pasta,flour tortillas,canned black beans,canned tomatoes,peanut butter,honey,soy sauce,olive oil,sesame oil,sriracha,ketchup,mustard,mayonnaise,frozen peas,frozen shrimp".split(',').map(n => ({ name: n, qty: '', cat: 'Pantry' })).concat('cumin,smoked paprika,chili flakes,oregano,garlic powder,cinnamon'.split(',').map(n => ({ name: n, qty: '', cat: 'Spices & Seasonings' })));
const b = await p.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto(base + '/#home'); await pg.evaluate(i => { localStorage.setItem('sc.ingredients', JSON.stringify(i)); localStorage.removeItem('sc.recipes'); }, ING);
await pg.reload(); await pg.goto(base + '/#scan'); await pg.waitForSelector('#goRecipes');
const count = () => pg.evaluate(() => [state.recipes?.ready?.length || 0, state.recipes?.more?.length || 0, [...state.recipes.ready, ...state.recipes.more].map(r => r.name)]);
let t = Date.now(); await pg.click('#goRecipes'); await pg.waitForSelector('#moreIdeas', { timeout: 90000 });
let c = await count(); console.log('initial', (Date.now() - t) / 1000 + 's', c[0], '+', c[1], c[2].join(' | '));
for (let k = 1; k <= 2; k++) {
  t = Date.now(); await pg.click('#moreIdeas'); await pg.waitForFunction(() => !state.moreBusy, { timeout: 90000 });
  c = await count(); console.log('more#' + k, (Date.now() - t) / 1000 + 's', c[0], '+', c[1], 'dupes:', c[2].length - new Set(c[2].map(n => n.toLowerCase())).size, '| new:', c[2].slice(-6).join(' | '));
}
await pg.click('[data-fav="ready:0"]'); await pg.click('[data-fav="more:1"]'); await new Promise(r => setTimeout(r, 300));
console.log('hash after heart:', await pg.evaluate(() => location.hash), 'favs:', await pg.evaluate(() => favs.map(f => f.name).join(' | ')));
await pg.screenshot({ path: '/workspace/craving-app/qa/fav-hearts.png' });
await pg.goto(base + '/#home'); await new Promise(r => setTimeout(r, 400)); console.log('home card:', await pg.$eval('#favCount', e => e.textContent));
await pg.evaluate(() => document.querySelector('a[href="#favs"]').scrollIntoView({ block: 'center' })); await new Promise(r => setTimeout(r, 300)); await pg.click('a[href="#favs"]'); await new Promise(r => setTimeout(r, 500)); console.log('favs view:', await pg.$$eval('#favsBody b', a => a.map(x => x.textContent).join(' | ')));
await pg.screenshot({ path: '/workspace/craving-app/qa/favorites.png' });
await pg.click('[data-rec="fav:0"]'); await pg.waitForSelector('#recipeBody .steps'); console.log('fav detail:', await pg.$eval('#recipeBody h2', e => e.textContent), 'steps', await pg.$$eval('#recipeBody .steps li', a => a.length), 'ingr', await pg.$$eval('#recipeBody .chips .chip', a => a.length), 'heart', await pg.$eval('#recipeFav', e => e.textContent), 'back', await pg.$eval('#recipeBack', e => e.getAttribute('href')));
await pg.click('#recipeFav'); console.log('after detail unsave:', await pg.evaluate(() => favs.length));
await pg.goto(base + '/#favs'); await new Promise(r => setTimeout(r, 300)); await pg.click('[data-fav="fav:0"]'); await new Promise(r => setTimeout(r, 300)); console.log('after list unsave:', await pg.evaluate(() => favs.length), await pg.$eval('#favsBody', e => e.innerText.slice(0, 40)));
await pg.reload(); console.log('persist:', await pg.evaluate(() => localStorage.getItem('sc.favs')));
await pg.goto(base + '/#recipes'); await pg.evaluate(() => el('moreIdeas').scrollIntoView({ block: 'end' })); await new Promise(r => setTimeout(r, 500));
await pg.screenshot({ path: '/workspace/craving-app/qa/more-ideas.png' });
console.log('errors:', errs.join(';') || 'none'); await b.close();
