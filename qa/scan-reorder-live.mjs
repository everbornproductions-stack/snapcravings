import p from 'puppeteer-core';
const base = 'https://snapcravings.pages.dev';
const b = await p.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
const wait = ms => new Promise(r => setTimeout(r, ms));
const ES = process.env.ES === '1'; const out = ES ? '-es' : '';
await pg.evaluateOnNewDocument(es => { localStorage.setItem('sc.dietSeen', 'true'); if (es) Object.defineProperty(navigator, 'language', { get: () => 'es-MX' }); }, ES);
await pg.goto(base + '/#home', { waitUntil: 'networkidle2' });
console.log('scripts:', await pg.$$eval('script[src]', a => a.map(s => s.getAttribute('src')).join(',')));
const [fc] = await Promise.all([pg.waitForFileChooser(), pg.click('a.big-choice.snap')]); await fc.accept(['/workspace/craving-app/test-photos/fridge.jpg']);
await pg.waitForSelector('#scanPhotos img'); await wait(400);
for (let i = 0; i < 4; i++) { const n = await pg.$('[data-next]'); if (!n) break; await n.click(); await wait(200); }
for (let a = 0; a < 3 && !(await pg.$('#goRecipes')); a++) { console.log('scan attempt', a + 1); await pg.click('#scanGo');
  await pg.waitForFunction(() => document.querySelector('#goRecipes') || /Free scans used up|Agotaste|hiccup|hipo/.test(document.body.innerText), { timeout: 200000 }).catch(() => {});
  if (/Free scans used up/.test(await pg.$eval('#scanBody', x => x.innerText))) break; }
if (!(await pg.$('#goRecipes'))) { console.log('NOGO', await pg.$eval('#scanBody', x => x.innerText.slice(0,300))); await pg.screenshot({ path: `/workspace/craving-app/qa/scan-reorder-live${out}.png` }); await b.close(); process.exit(2); }
console.log('restartText:', await pg.$eval('#scanRestart', e => e.innerText)); console.log('order:', await pg.evaluate(() => { const r = document.querySelector('#scanRestart').getBoundingClientRect(); const y = s => Math.round(document.querySelector(s).getBoundingClientRect().top);
  return JSON.stringify({ restart: [Math.round(r.left), Math.round(r.top)], photos: y('#scanPhotos'), craving: y('#scanBody h3'), go: y('#goRecipes'), found: y('#scanBody h2'), restock: y('#scanBody a[href="#list"]') }); }));
await pg.screenshot({ path: `/workspace/craving-app/qa/scan-reorder-live${out}.png` });
await pg.evaluate(() => document.querySelector('#scanBody a[href="#list"]').scrollIntoView({ block: 'end' })); await wait(400);
await pg.screenshot({ path: `/workspace/craving-app/qa/scan-reorder-live${out}-scrolled.png` });
// behavior: remove an ingredient keeps order + restart button
await pg.click('[data-rmi="0"]'); await wait(200); console.log('after edit h2:', await pg.$eval('#scanBody h2', e => e.textContent), 'restart:', !!(await pg.$('#scanRestart [data-rescan]')));
await pg.click('#goRecipes'); await pg.waitForFunction(() => document.querySelector('#recipesBody h3'), { timeout: 300000 });
console.log('recipes:', await pg.$$eval('#recipesBody b', a => a.slice(0,4).map(x => x.textContent).join(' | ')));
await pg.goto(base + '/#scan'); await wait(500);
await pg.click('#scanRestart [data-rescan]'); await wait(300); console.log('after restart:', await pg.$eval('#scanBody', e => e.innerText.slice(0,60).replace(/\n/g,' ')), 'restartEmpty:', await pg.$eval('#scanRestart', e => e.innerHTML === ''));
console.log('errors:', errs.join(' ; ') || 'none'); await b.close();
