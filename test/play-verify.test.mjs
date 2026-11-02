import { generateKeyPairSync } from 'node:crypto';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/play/verify.js';
import { verifyToken } from '../functions/_lib/sub.js';
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const sa = { client_email: 'x@p.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
const TOK = 'abcdefghijklmnopqrstuvwxyz.AO-J1Oz';
function mk(state, ack, exp = Date.now() + 20 * 864e5) {
  const calls = [];
  const f = async (url, o = {}) => { calls.push([url, o.method || 'GET']);
    if (url.includes('oauth2')) { assert.match(o.body, /assertion=[\w-]+\.[\w-]+\.[\w-]+/); return new Response(JSON.stringify({ access_token: 'AT', expires_in: 3600 })); }
    if (url.includes(':acknowledge')) return new Response('{}');
    if (url.includes('subscriptionsv2/tokens/')) return state === 404 ? new Response('{}', { status: 404 }) : new Response(JSON.stringify({ subscriptionState: state, acknowledgementState: ack, latestOrderId: 'GPA.1', lineItems: [{ productId: 'snapcravings_pro_monthly', expiryTime: new Date(exp).toISOString() }] }));
    throw new Error('unexpected ' + url); };
  return { f, calls };
}
const env = (f) => ({ SUB_SECRET: 's3cret', PLAY_SA_JSON: JSON.stringify(sa), __fetch: f });
const call = (e, body) => onRequest({ request: new Request('https://x/api/play/verify', { method: 'POST', body: JSON.stringify(body) }), env: e });
let m = mk('SUBSCRIPTION_STATE_ACTIVE', 'ACKNOWLEDGEMENT_STATE_PENDING');
let r = await call(env(m.f), { purchaseToken: TOK }); let j = await r.json();
assert.equal(r.status, 200); assert.equal(j.active, true); assert.ok(await verifyToken({ SUB_SECRET: 's3cret' }, j.token));
assert.ok(m.calls.some(c => c[0].includes('/subscriptions/snapcravings_pro_monthly/tokens/') && c[0].endsWith(':acknowledge') && c[1] === 'POST'), 'acked');
m = mk('SUBSCRIPTION_STATE_ACTIVE', 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED');
j = await (await call(env(m.f), { purchaseToken: TOK })).json(); assert.equal(j.active, true); assert.ok(!m.calls.some(c => c[0].includes('acknowledge')));
m = mk('SUBSCRIPTION_STATE_EXPIRED', 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED', Date.now() - 1000);
j = await (await call(env(m.f), { purchaseToken: TOK })).json(); assert.equal(j.active, false); assert.equal(j.token, undefined);
m = mk(404); j = await (await call(env(m.f), { purchaseToken: TOK })).json(); assert.equal(j.active, false);
r = await call(env(m.f), { purchaseToken: 'bad token!' }); assert.equal(r.status, 400);
r = await call({ SUB_SECRET: 's' }, { purchaseToken: TOK }); assert.equal(r.status, 503);
r = await onRequest({ request: new Request('https://x/api/play/verify'), env: {} }); assert.equal(r.status, 404);
console.log('play verify: 7 checks ok');
