// Accessibility. Static checks always run. The axe-core run on the main screens needs puppeteer-core + axe-core
// (A11Y_NODE_MODULES, default /tmp/pp/node_modules) and Chrome (CHROME, default /usr/bin/google-chrome); it skips if they are missing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';

const html = readFileSync('web/index.html', 'utf8');
const name = tag => /aria-label="[^"]+"/.test(tag);
const text = inner => inner.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').replace(/[\s‹›×+−←→✕♡♥⚙️]/gu, '').length > 0;

test('every static button and link has a screen-reader name', () => {
  const bad = [];
  for (const m of html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)) if (!name(m[2]) && !text(m[3])) bad.push(m[0].slice(0, 90));
  assert.deepEqual(bad, []);
});
test('every static image has alt text and every input has a label', () => {
  assert.deepEqual([...html.matchAll(/<img\b(?![^>]*\balt=)[^>]*>/g)].map(m => m[0]), []);
  const bad = [...html.matchAll(/<input\b([^>]*)>/g)].filter(m => !/type="(hidden|file)"/.test(m[1]) && !/aria-label=|id="[^"]+"/.test(m[1])).map(m => m[0]);
  assert.deepEqual(bad, []);
});
test('page basics: lang, viewport allows zoom, landmarks, live region', () => {
  assert.match(html, /<html[^>]+lang=/);
  const vp = html.match(/<meta name="viewport" content="([^"]+)"/)[1];
  assert.doesNotMatch(vp, /user-scalable=no|maximum-scale=1(\.0)?\b/);
  assert.match(html, /<nav class="tabbar" aria-label=/);
  assert.match(html, /role="main"/);
  assert.match(html, /id="toast" role="status" aria-live="polite"/);
  assert.match(html, /prefers-reduced-motion:reduce/);
});

const NM = process.env.A11Y_NODE_MODULES || '/tmp/pp/node_modules', CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const ready = existsSync(join(NM, 'puppeteer-core')) && existsSync(join(NM, 'axe-core/axe.min.js')) && existsSync(CHROME);
test('axe-core: no WCAG 2.1 AA violations on the main screens', { skip: !ready && 'puppeteer-core/axe-core/Chrome not installed', timeout: 120000 }, async () => {
  const req = createRequire(join(NM, 'x.js')), puppeteer = req('puppeteer-core');
  const T = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
  const srv = createServer((q, r) => { const f = join('web', decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!f.startsWith('web') || !existsSync(f)) { r.writeHead(404); return r.end('{}'); } r.writeHead(200, { 'content-type': T[extname(f)] || 'text/plain' }); r.end(readFileSync(f)); });
  await new Promise(r => srv.listen(0, r));
  const b = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  try {
    const p = await b.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await p.goto(`http://localhost:${srv.address().port}/?country=US#home`, { waitUntil: 'networkidle2' }).catch(() => {});
    const axe = readFileSync(join(NM, 'axe-core/axe.min.js'), 'utf8'), fails = [];
    for (const s of ['home', 'scan', 'crave', 'settings', 'pro', 'prep', 'favs', 'list', 'lib', 'hplan', 'dish']) {
      await p.evaluate(h => { location.hash = h; }, '#' + s); await new Promise(r => setTimeout(r, 500)); await p.evaluate(axe);
      const v = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'], exclude: [['.screen:not(.active)']] })).violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(', ')}`));
      for (const x of v) fails.push(`#${s} ${x}`);
    }
    assert.deepEqual(fails, []);
  } finally { await b.close(); srv.close(); }
});
