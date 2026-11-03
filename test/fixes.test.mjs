// 2026-11-02 review + audit fixes: signed scan tickets, no raw provider errors, Play token cap, US$ prices, next holiday,
// copy fixes in all 10 languages, privacy processors, offline cache list.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import vm from 'node:vm';
import { signScan, verifyScan, safeEq, SCAN_TICKET_MS, signToken, verifyToken } from '../functions/_lib/sub.js';
import { publicTries, shortSt } from '../functions/api/[[path]].js';
import '../web/holiday.js';
const rd = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const env = { SUB_SECRET: 'test-secret' };
test('scan tickets are server signed, device bound and expire after 10 minutes', async () => {
  const t = await signScan(env, 'devA');
  assert.ok((await verifyScan(env, t, 'devA'))?.s); assert.equal(await verifyScan(env, t, 'devB'), null, 'other device');
  assert.equal(await verifyScan(env, t, 'devA', Date.now() + SCAN_TICKET_MS + 1000), null, 'expired');
  const [b, s] = t.split('.'); const forged = Buffer.from(JSON.stringify({ s: 'mine', d: 'devA', t: Date.now() })).toString('base64url') + '.' + s;
  assert.equal(await verifyScan(env, forged, 'devA'), null, 'client-made id'); assert.equal(await verifyScan(env, 'abc123', 'devA'), null);
  assert.equal(await verifyScan({ SUB_SECRET: 'other' }, t, 'devA'), null);
  // a scan ticket is not an unlock token
  assert.equal(await verifyToken(env, t), null);
});
test('unlock tokens still verify (constant-time HMAC verify) and safeEq compares in full', async () => {
  const tok = await signToken(env, 'x@y', 1); assert.equal((await verifyToken(env, tok)).e, 'x@y'); assert.equal(await verifyToken(env, tok.slice(0, -2) + 'AA'), null);
  assert.equal(safeEq('abc', 'abc'), true); assert.equal(safeEq('abc', 'abd'), false); assert.equal(safeEq('abc', 'abcd'), false);
});
test('the scan gate uses tickets, never trusts a raw client id, and does not fail open for free users', () => {
  const s = rd('functions/api/[[path]].js');
  assert.ok(!/x-sc-scan'\) \|\| ''\)\.replace/.test(s), 'raw header id is gone'); assert.match(s, /verifyScan\(env/); assert.match(s, /memGate\(devHash/);
  assert.ok(!/catch \{ return \{ allowed: true, why: 'error' \}/.test(s));
  const a = rd('web/app.js'); assert.match(a, /path === .scan. && j\.scanTicket\) state\.scanId = j\.scanTicket/); assert.match(a, /results\.push\(await one\(batches\[0\]\)\)/);
});
test('/api/scan never returns raw provider text (Groq org id, quota messages)', () => {
  const raw = [['groq', '429 Request too large for model `qwen` in organization `org_01abc` service tier', 116], ['gemini-3.5-flash-lite', '429 You exceeded your current quota', 153], ['x', 200, 9], ['y', 'timeout', 5]];
  const p = publicTries(raw); assert.ok(!JSON.stringify(p).includes('org_')); assert.deepEqual(p.map(x => x[1]), ['429', '429', '200', 'timeout']);
  assert.equal(shortSt('err stream bad'), 'err');
});
test('Play unlock tokens are capped at 35 days', () => { assert.match(rd('functions/api/play/verify.js'), /Math\.min\(35, \(s\.until/); });
test('fridge scan: watchdog + empty result error instead of a silent reset to step 1', () => {
  const a = rd('web/app.js');
  assert.match(a, /const dog = setTimeout\(/); assert.match(a, /if \(!found\.length\) throw new Error/); assert.match(a, /if \(state\.busy\) return;/);
  assert.ok(!/function scanFail\(e, n\) \{\n  location\.hash/.test(a), 'no hash change that would re-render step 1 over the error');
});
test('Pro screen: US$ prices, honest yearly saving, no 33%', () => {
  const h = rd('web/index.html'), a = rd('web/app.js');
  assert.ok(!/33%/.test(h) && !/save 33%/.test(a)); assert.match(h, /SAVE 16%/); assert.match(h, /id="proPrice">US\$3\.99/); assert.match(a, /'US\$' \+ Number\(subCfg\.price\)/);
  assert.ok(Math.abs((1 - 39.99 / (3.99 * 12)) * 100 - 16.5) < 0.1);
});
test('new copy exists in all 9 non-English languages with US$ amounts and placeholders kept', () => {
  const ctx = {}; vm.runInNewContext(rd('web/fixes.js'), ctx); const F = ctx.globalThis ? ctx.globalThis.FIX_I18N : ctx.FIX_I18N;
  const keys = Object.keys(F.es).filter(k => !/^(Tap Retry|Retry)$/.test(k));
  for (const l of ['es', 'pt', 'hi', 'id', 'fr', 'de', 'ar', 'ru', 'tr']) for (const k of keys) {
    assert.ok(F[l][k], l + ' ' + k); for (const m of k.match(/US\$\d+\.\d+|US\$\{price\}|\{\w+\}/g) || []) assert.ok(F[l][k].includes(m), `${l} ${k} keeps ${m}`);
  }
  assert.ok(!Object.values(F.hi).some(v => /Unlimited/.test(v))); assert.equal(F.pt['Tap Retry'], 'Tentar de novo');
});
test('holiday planner off-season names the next holiday for the country', () => {
  const H = globalThis.SC_HOLIDAY; const n = H.next(new Date(2026, 0, 20), 'US'); assert.equal(n.id, 'valentines'); assert.equal(n.day.getDate(), 14);
  assert.equal(H.next(new Date(2026, 0, 20), 'IN').id, 'holi');
  const s = rd('web/hplan.js'); assert.match(s, /\.upcoming\(/); /* planner works any time now (feat.test.mjs) */
});
test('privacy policy lists every AI processor, hashed IP, country and free-tier retention; Play data safety doc exists', () => {
  const p = rd('web/privacy.html');
  for (const w of ['Gemini', 'Cerebras', 'Groq', 'Mistral', 'OpenRouter', 'Workers AI', 'hash of your IP', 'Approximate country', 'Free AI tiers may keep']) assert.ok(p.includes(w), w);
  assert.match(rd('docs/PLAY_DATA_SAFETY.md'), /Device or other IDs/);
});
test('offline cache has prep.js, more.js, fixes.js and every language file; grocery total hides $0', () => {
  const s = rd('web/sw.js'); for (const f of ['prep.js', 'more.js', 'fixes.js', ...['pt', 'hi', 'id', 'fr', 'de', 'ar', 'ru', 'tr'].map(l => `i18n/${l}.js`)]) assert.ok(s.includes('./' + f), f);
  assert.match(rd('web/app.js'), /tot > 0 \? '~' \+ \$\(tot\) : ''/);
});
