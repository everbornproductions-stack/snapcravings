// Recipes streaming, JSON contract, cache and provider auto-enable (no network: env.__fetch fakes every provider).
import test from 'node:test';
import assert from 'node:assert/strict';
const { onRequest } = await import('../functions/api/[[path]].js');
const R = n => ({ name: 'Dish ' + n, emoji: '🍳', minutes: 10, servings: 2, level: ['Easy', 'Medium', 'Chef mode', 'Easy'][n % 4], ingredients: [{ item: 'Eggs', qty: '2', have: true }], missing: [], steps: ['Cook.'], kcal: 300, protein_g: 20, carbs_g: 10, fat_g: 15 });
const text = JSON.stringify({ recipes: [0, 1, 2, 3].map(R) });
const sse = (chunks, mk) => new Response(new ReadableStream({ start(c) { for (const x of chunks) c.enqueue(new TextEncoder().encode('data: ' + JSON.stringify(mk(x)) + '\n\n')); c.close(); } }), { headers: { 'content-type': 'text/event-stream' } });
const split = s => { const out = []; for (let i = 0; i < s.length; i += 37) out.push(s.slice(i, i + 37)); return out; };
const gem = x => ({ candidates: [{ content: { parts: [{ text: x }] } }] });
const oai = x => ({ choices: [{ delta: { content: x } }] });
function fake(calls, groqOk = true) {
  return async (url, init) => { calls.push(url); const b = JSON.parse(init.body);
    if (url.includes('groq')) { if (!groqOk) return new Response('{"error":{"message":"rate"}}', { status: 429 }); return b.stream ? sse(split(text), oai) : new Response(JSON.stringify({ choices: [{ message: { content: text } }] })); }
    if (url.includes('streamGenerateContent')) return sse(split(text), gem);
    return new Response(JSON.stringify(gem(text))); };
}
const req = (body, ip = '1.2.3.' + Math.floor(Math.random() * 200), hdr = {}) => new Request('http://localhost/api/recipes', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...hdr }, body: JSON.stringify({ ingredients: ['Eggs', 'Rice ' + Math.random()], craving: 'Anything', section: 'ready', ...body }) });
const call = (env, body, hdr) => onRequest({ request: req(body, undefined, hdr), env, params: { path: ['recipes'] }, waitUntil: p => p });
async function lines(res) { const t = await res.text(); return t.trim().split('\n').map(l => JSON.parse(l)); }

test('non-streaming JSON contract is unchanged', async () => {
  const calls = []; const res = await call({ GEMINI_API_KEY: 'x', __fetch: fake(calls) }, {});
  assert.equal(res.status, 200); assert.match(res.headers.get('content-type'), /application\/json/);
  const j = await res.json(); assert.equal(j.recipes.length, 4); assert.equal(j.craving, 'Anything'); assert.ok(j.usage.model);
  assert.ok(calls[0].includes(':generateContent'));
});
test('stream=true sends one line per recipe, then done with the same fields', async () => {
  const calls = []; const res = await call({ GEMINI_API_KEY: 'x', __fetch: fake(calls) }, { stream: true });
  assert.match(res.headers.get('content-type'), /ndjson/);
  const L = await lines(res); const recs = L.filter(l => l.recipe); const done = L.at(-1);
  assert.equal(recs.length, 4); assert.deepEqual(recs[0].recipe, R(0)); assert.equal(done.done, true); assert.equal(done.recipes.length, 4); assert.ok(done.usage);
});
test('GROQ_API_KEY turns Groq on first; a Groq 429 falls through to Gemini', async () => {
  let calls = []; let j = await (await call({ GEMINI_API_KEY: 'x', GROQ_API_KEY: 'g', __fetch: fake(calls) }, {})).json();
  assert.ok(calls[0].includes('groq')); assert.equal(j.usage.provider, 'groq');
  calls = []; j = await (await call({ GEMINI_API_KEY: 'x', GROQ_API_KEY: 'g', __fetch: fake(calls, false) }, {})).json();
  assert.equal(j.recipes.length, 4); assert.ok(calls.some(u => u.includes('generativelanguage')));
});
test('diet filter drops a forbidden recipe from the stream', async () => {
  const bad = JSON.stringify({ recipes: [{ ...R(0), name: 'Shrimp tacos', ingredients: [{ item: 'shrimp', qty: '1 lb', have: true }] }, R(1), R(2), R(3)] });
  const f = async url => url.includes('stream') ? sse(split(bad), gem) : new Response(JSON.stringify(gem(text)));
  const L = await lines(await call({ GEMINI_API_KEY: 'x', __fetch: f }, { stream: true, prefs: { tags: ['Shellfish allergy'] } }));
  assert.ok(!L.some(l => l.recipe && /shrimp/i.test(l.recipe.name))); assert.ok(L.at(-1).recipes.length >= 3);
});
