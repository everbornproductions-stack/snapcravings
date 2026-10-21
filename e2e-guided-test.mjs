import p from 'puppeteer-core';
const base = process.argv[2] || 'http://localhost:8788';
const b = await p.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const pg = await b.newPage(); await pg.setViewport({ width: 430, height: 900 });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
let sent = null; pg.on('request', r => { if (r.url().endsWith('/api/scan')) sent = JSON.parse(r.postData()); });
const wait = ms => new Promise(r => setTimeout(r, ms));
const snap = async (sel, file) => { const [fc] = await Promise.all([pg.waitForFileChooser(), pg.click(sel)]); await fc.accept([file]); await pg.waitForFunction(n => document.querySelectorAll('#scanPhotos img').length >= n, {}, 1); await wait(400); };
await pg.goto(base + '/#home');
await snap('a.big-choice.snap', '/tmp/fridge.jpg');            // step 1 fridge
console.log('step1:', await pg.$eval('#scanBody h2', e => e.textContent));
await snap('[data-addphoto]', '/tmp/fridge.jpg');               // add another fridge
await pg.click('[data-rmp="1"]'); await wait(200);              // remove it
console.log('after remove:', await pg.$$eval('#scanPhotos img', a => a.length));
await pg.click('[data-next]'); await wait(200); console.log('step2:', await pg.$eval('#scanBody h2', e => e.textContent));
await pg.click('[data-next]'); await wait(200); console.log('step3:', await pg.$eval('#scanBody h2', e => e.textContent));
await pg.click('[data-next]'); await wait(200); console.log('step4:', await pg.$eval('#scanBody h2', e => e.textContent));
await pg.screenshot({ path: '/tmp/g-step4.png' });
await snap('[data-addphoto]', '/tmp/spices.jpg');
await pg.click('[data-next]'); await wait(200); console.log('final:', await pg.$eval('#scanBody h2', e => e.textContent));
await pg.screenshot({ path: '/tmp/g-go.png' });
await pg.click('#scanGo'); await pg.waitForSelector('#goRecipes', { timeout: 120000 });
console.log('sent:', sent.images.map(i => i.area + ':' + Math.round(i.data.length * 0.75 / 1024) + 'KB').join(', '));
console.log('groups:', await pg.$$eval('#scanBody h3', a => a.map(x => x.textContent).join(' | ')));
await pg.screenshot({ path: '/tmp/g-inv.png', fullPage: true });
await pg.click('#goRecipes'); await pg.waitForFunction(() => document.querySelector('#recipesBody h3'), { timeout: 120000 });
console.log('recipes:', await pg.$$eval('#recipesBody b', a => a.map(x => x.textContent).join(' | ')));
console.log('errors:', errs.join(' ; ') || 'none'); await b.close();
