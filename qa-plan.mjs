import p from '/tmp/pp/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const [base, lang, tag, tok = ''] = process.argv.slice(2); const O = '/workspace/craving-app/qa/';
const b = await p.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--lang=' + (lang === 'es' ? 'es-MX' : 'en-US')] });
const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await pg.evaluateOnNewDocument((lang, tok) => { Object.defineProperty(navigator, 'language', { get: () => lang === 'es' ? 'es-MX' : 'en-US' }); Object.defineProperty(navigator, 'languages', { get: () => [lang === 'es' ? 'es-MX' : 'en-US'] });
  if (!localStorage.getItem('sc.dev')) { localStorage.setItem('sc.diet', JSON.stringify({ tags: ['Shellfish allergy', 'Nut allergy'], other: '', mood: '' })); localStorage.setItem('sc.dietSeen', 'true');
    localStorage.setItem('sc.ingredients', JSON.stringify([{ name: lang === 'es' ? 'arroz' : 'rice', qty: '', cat: 'Pantry' }, { name: lang === 'es' ? 'espinaca' : 'spinach', qty: '', cat: 'Produce' }, { name: lang === 'es' ? 'camarón' : 'shrimp', qty: '', cat: 'Proteins' }]));
    if (tok) localStorage.setItem('sc.sub', tok); } }, lang, tok);
const wait = ms => new Promise(r => setTimeout(r, ms));
pg.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
await pg.goto(base + '/#home'); await wait(1500); await pg.screenshot({ path: O + `plan-${tag}-home.png` });
await pg.goto(base + '/#prep'); await wait(1200); await pg.screenshot({ path: O + `plan-${tag}-form.png` });
await pg.evaluate(() => { document.querySelector('[data-po="days"][data-v="7"]').click(); });
const t0 = Date.now(); await pg.click('#prepGo');
await pg.waitForFunction(() => document.querySelector('#prepCopy') || /Retry|Reintentar/.test(document.querySelector('#prepBody').innerText), { timeout: 200000 });
console.log('built in', Date.now() - t0, 'ms'); await wait(500);
const info = await pg.evaluate(() => { const pl = JSON.parse(localStorage.getItem('sc.plan') || 'null'); return { err: document.querySelector('#prepCopy') ? null : document.querySelector('#prepBody').innerText.slice(0, 300), meals: pl?.meals?.length, genDays: pl?.genDays, preview: pl?.preview, names: pl?.meals?.map(m => m.name), text: JSON.stringify(pl || {}).toLowerCase() }; });
console.log(JSON.stringify({ ...info, text: undefined }));
console.log('allergen words in plan:', (info.text.match(/shrimp|camar[oó]n|prawn|almond|almendra|peanut|cacahuate|walnut|nuez|cashew/g) || []).join(',') || 'none');
await pg.screenshot({ path: O + `plan-${tag}-week.png` });
await pg.evaluate(() => document.querySelector('#prepBody details').open = true); await pg.evaluate(() => document.querySelector('#prepBody details').scrollIntoView()); await wait(300); await pg.screenshot({ path: O + `plan-${tag}-meal.png` });
await pg.evaluate(() => document.querySelector('#prepCopy').scrollIntoView({ block: 'end' })); await wait(300); await pg.screenshot({ path: O + `plan-${tag}-grocery.png` });
await pg.evaluate(() => document.querySelector('#prepNew').scrollIntoView({ block: 'end' })); await wait(300); await pg.screenshot({ path: O + `plan-${tag}-prepguide.png` });
if (process.env.SWAP) { const before = info.names[0]; await pg.evaluate(() => document.querySelector('[data-pswap="0"]').click()); await pg.waitForFunction(() => !document.querySelector('#prepBody .spin'), { timeout: 90000 }).catch(() => {}); await wait(800);
  const after = await pg.evaluate(() => JSON.parse(localStorage.getItem('sc.plan')).meals[0].name); console.log('swap', before, '->', after); await pg.screenshot({ path: O + `plan-${tag}-swap.png` }); }
if (!tok) { await pg.goto(base + "/#pro"); await wait(1500); await pg.evaluate(() => document.querySelector('.plan[data-plan="yr"]').click()); await wait(500); await pg.screenshot({ path: O + `paywall-${tag}.png` });
console.log('paywall:', await pg.evaluate(() => document.querySelector('#proYrSub').innerText + ' | ' + document.querySelector('#proFine').innerText + ' | yr on=' + !!document.querySelector('.plan.on[data-plan="yr"]')));
}
await b.close();
