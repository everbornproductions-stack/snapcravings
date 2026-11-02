// More languages (2026-11-02): every UI dictionary covers every English key with the same {placeholders}; the API speaks
// each language with local names and metric units, and the diet checks still see the English name in `en`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { INTL, LANG_CODES, langCode, intlNote, intlScanNote, colName } from '../functions/_lib/lang.js';
import { dietOf, recipeHits, flagScan } from '../functions/_lib/diet.js';
import { cleanRecipe, collectionsFor } from '../functions/_lib/extras.js';

const web = p => fs.readFileSync(new URL('../web/' + p, import.meta.url), 'utf8');
function dicts() {
  const ctx = { localStorage: { getItem: () => null, setItem() {} }, navigator: { language: 'en' }, document: { documentElement: {}, querySelector: () => null } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(web('i18n.js'), ctx);
  for (const f of ['more.js', 'prep.js', 'grow.js']) { const m = web(f).match(/Object\.assign\(I18N\.ES, (\{[\s\S]*?\n  \})\);/); assert.ok(m, f); Object.assign(ctx.I18N.ES, vm.runInContext('(' + m[1] + ')', ctx)); }
  for (const l of Object.keys(INTL)) vm.runInContext(web(`i18n/${l}.js`), ctx);
  return ctx;
}
const ph = s => (String(s).match(/\{\w+\}/g) || []).sort().join();

test('every new language covers every Spanish key with the same placeholders', () => {
  const ctx = dicts(); const keys = Object.keys(ctx.I18N.ES);
  assert.ok(keys.length > 400);
  for (const l of Object.keys(INTL)) {
    const d = ctx.SC_I18N[l]; assert.ok(d, l);
    const missing = keys.filter(k => typeof d[k] !== 'string' || !d[k].trim());
    assert.deepEqual(missing, [], l + ' missing keys');
    for (const k of Object.keys(d)) assert.equal(ph(d[k]), ph(k), `${l}: ${k}`);
  }
});
test('head script and picker list the same languages as the server', () => {
  const html = web('index.html'); const m = html.match(/window\.SC_LANGS = (\[[^\n]*\]);/); assert.ok(m);
  assert.deepEqual(JSON.parse(m[1].replace(/'/g, '"')).map(x => x[0]), LANG_CODES);
  for (const l of Object.keys(INTL)) assert.ok(fs.existsSync(new URL(`../web/i18n/${l}.js`, import.meta.url)), l);
  assert.match(html, /dir = 'rtl'/);
});
test('langCode maps browser tags', () => {
  assert.equal(langCode('pt-BR'), 'pt'); assert.equal(langCode('in-ID'), 'id'); assert.equal(langCode('hi_IN'), 'hi'); assert.equal(langCode('ja'), 'en'); assert.equal(langCode(''), 'en'); assert.equal(langCode('es-MX'), 'es');
});
test('prompts ask for local names, metric units and an English name', () => {
  for (const l of Object.keys(INTL)) {
    const n = intlNote(l); assert.match(n, /metric units/); assert.match(n, /"en"/); assert.match(n, /°C/); assert.match(intlScanNote(l), /"en"/);
  }
  assert.equal(intlNote('en'), ''); assert.equal(intlNote('es'), '');
});
test('diet checks read the English name of a local ingredient', () => {
  const d = dietOf({ tags: ['Shellfish allergy'] });
  const r = { name: 'झींगा करी', ingredients: [{ item: 'झींगा', en: 'shrimp', qty: '200 ग्राम', have: true }, { item: 'प्याज़', en: 'onion', qty: '1', have: true }], missing: [], steps: ['पकाएँ।'] };
  assert.deepEqual(recipeHits(d, r), ['shrimp']);
  assert.deepEqual(recipeHits(d, { ...r, ingredients: [r.ingredients[1]] }), []);
  const s = flagScan({ ingredients: [{ name: 'udang', en: 'shrimp', qty: '200 g', category: 'Proteins', low: false }] }, d);
  assert.equal(s.ingredients[0].conflict, true);
  assert.equal(cleanRecipe(r).ingredients[0].en, 'shrimp');
});
test('collection names exist in every language', () => {
  const all = [10, 11, 0, 5].flatMap(m => collectionsFor(new Date(2026, m, 15)));
  for (const l of Object.keys(INTL)) for (const c of all) assert.notEqual(colName(c, l), c.name, `${l}: ${c.name}`);
});
