// Every browser script must parse (a stray // comment on a one-line function shipped a blank app once, 2026-11-02).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
test('all web/*.js and web/i18n/*.js parse', () => {
  const files = [...readdirSync('web').filter(f => f.endsWith('.js')).map(f => 'web/' + f), ...readdirSync('web/i18n').filter(f => f.endsWith('.js')).map(f => 'web/i18n/' + f)];
  for (const f of files) assert.doesNotThrow(() => new vm.Script(readFileSync(f, 'utf8'), { filename: f }), f);
});
