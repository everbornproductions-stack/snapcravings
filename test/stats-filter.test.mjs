import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { kindOf, sourceGroup } from '../functions/api/ev.js';

const CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
test('real browsers are not flagged', () => { assert.equal(kindOf(CHROME, { plan: 'free' }), ''); assert.equal(kindOf(CHROME, { plan: 'paid' }), ''); });
test('automation, bots and crawlers are flagged', () => {
  for (const ua of ['Mozilla/5.0 HeadlessChrome/120.0', 'Mozilla/5.0 Playwright', 'Puppeteer/21', 'Chrome-Lighthouse', 'Googlebot/2.1', 'Bingbot', 'facebookexternalhit/1.1', 'curl/8.0', ''])
    assert.equal(kindOf(ua, { plan: 'free' }), 'bot', ua);
});
test('test flag and owner devices are flagged', () => { assert.equal(kindOf(CHROME, { plan: 'free', test: 1 }), 'test'); assert.equal(kindOf(CHROME, { plan: 'owner' }), 'owner'); });
test('source grouping: utm_source wins, then referrer', () => {
  assert.equal(sourceGroup('', ''), 'direct');
  assert.equal(sourceGroup('', 'l.instagram.com'), 'instagram');
  assert.equal(sourceGroup('', 'm.facebook.com'), 'facebook');
  assert.equal(sourceGroup('', 'vm.tiktok.com'), 'tiktok');
  assert.equal(sourceGroup('', 'youtube.com'), 'youtube');
  assert.equal(sourceGroup('', 'google.com'), 'google');
  assert.equal(sourceGroup('newsletter', ''), 'email');
  assert.equal(sourceGroup('tiktok', 'google.com'), 'tiktok');
  assert.equal(sourceGroup('', 'reddit.com'), 'other');
  assert.equal(sourceGroup('flyer', ''), 'other');
});
test('client sends the test flag and the first-visit source; more_ideas tracks before the re-render', () => {
  const app = fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
  assert.match(app, /sc_test/); assert.match(app, /utm_campaign/);
  assert.ok(app.indexOf("track('more_ideas', 'recipes')") < app.indexOf("track('more_ideas', 'recipes'); renderRecipes()") + 5 && /track\('more_ideas', 'recipes'\); renderRecipes\(\);/.test(app));
});
test('dashboard has the real-people toggle and the sources card', () => {
  const h = fs.readFileSync(new URL('../web/stats.html', import.meta.url), 'utf8');
  assert.match(h, /Real people/); assert.match(h, /All traffic/); assert.match(h, /Where visitors come from/); assert.match(h, /id="sources"/);
});
