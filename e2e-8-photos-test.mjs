import p from 'puppeteer-core';
const base = 'https://snapcravings.pages.dev';
const b = await p.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await pg.emulateNetworkConditions({ download: 1.5e6, upload: 1e6, latency: 80 }); // ~ mobile 4G-ish
const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('requestfailed', r => errs.push('failed ' + r.url() + ' ' + r.failure()?.errorText));
const calls = []; pg.on('request', r => { if (r.url().endsWith('/api/scan')) calls.push(Math.round(r.postData().length / 1024)); });
pg.on('response', r => r.url().includes('/api/') && console.log('api', r.url().split('/api/')[1], r.status()));
const wait = ms => new Promise(r => setTimeout(r, ms)); const t0 = Date.now();
await pg.goto(base + '/#home');
for (let s = 0; s < 4; s++) {
  const sel = s === 0 ? 'a.big-choice.snap' : '[data-addlib]';
  const [fc] = await Promise.all([pg.waitForFileChooser(), pg.click(sel)]); await fc.accept([`/tmp/big${s * 2}.jpg`, `/tmp/big${s * 2 + 1}.jpg`]);
  await pg.waitForFunction(n => document.querySelectorAll('#scanPhotos img').length >= n, { timeout: 60000 }, (s + 1) * 2);
  await wait(300); if (s < 3) { await pg.click('[data-next]'); await wait(200); }
}
await pg.click('[data-next]'); await wait(300);
console.log('photos:', await pg.$$eval('#scanPhotos img', a => a.length), 'compress ms', Date.now() - t0);
await pg.click('#scanGo'); const t1 = Date.now();
await pg.waitForFunction(() => document.querySelector('#goRecipes') || /Retry/.test(document.querySelector('#scanBody').innerText), { timeout: 300000 });
console.log('scan secs', (Date.now() - t1) / 1000, 'batch KB', calls.join(','));
console.log('result:', await pg.$eval('#scanBody', e => e.innerText.replace(/\n+/g, ' | ').slice(0, 900)));
await pg.screenshot({ path: '/workspace/craving-app/qa/scan-8-photos.png' });
if (await pg.$('#goRecipes')) { await pg.click('#goRecipes'); await pg.waitForFunction(() => document.querySelector('#recipesBody h3') || /went sideways|Retry|long/.test(document.querySelector('#recipesBody').innerText), { timeout: 120000 }); console.log('recipes:', await pg.$$eval('#recipesBody b', a => a.map(x => x.textContent).join(' | '))); }
console.log('errors:', errs.join(' ; ') || 'none'); await b.close();
