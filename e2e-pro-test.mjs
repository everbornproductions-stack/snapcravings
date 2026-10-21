import p from 'puppeteer-core';
const base = process.argv[2];
const b = await p.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto(base + '/#pro', { waitUntil: 'networkidle0' }); await new Promise(r => setTimeout(r, 800));
await pg.evaluate(() => el('proGo').scrollIntoView({ block: 'center' }));
await pg.screenshot({ path: '/workspace/craving-app/qa/pro-' + process.argv[3] + '.png' });
console.log('fine:', await pg.$eval('#proFine', e => e.textContent));
if (process.argv[4]) { await pg.type('#proEmail', process.argv[4]); await pg.click('#proRestore'); await new Promise(r => setTimeout(r, 3000));
  console.log('after restore:', await pg.$eval('#proBody', e => e.innerText.replace(/\n+/g, ' | ')));
  await pg.goto(base + '/#home'); await new Promise(r => setTimeout(r, 500)); console.log('home bar:', await pg.$eval('#scanLeft', e => e.textContent));
  await pg.goto(base + '/#pro'); await new Promise(r => setTimeout(r, 500)); await pg.screenshot({ path: '/workspace/craving-app/qa/pro-unlimited.png' });
  // checkout click
  await pg.evaluate(() => { localStorage.removeItem('sc.sub'); }); await pg.reload({ waitUntil: 'networkidle0' }); await new Promise(r => setTimeout(r, 800));
  await pg.type('#proEmail', 'buyer+test@everbornproductions.com'); await Promise.all([pg.waitForNavigation({ timeout: 30000 }).catch(() => {}), pg.click('#proGo')]);
  console.log('checkout page:', pg.url().slice(0, 60), '|', (await pg.title()).slice(0, 60));
}
console.log('errors:', errs.join(';') || 'none'); await b.close();
