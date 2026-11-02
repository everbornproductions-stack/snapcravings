// Google Play subscription check (Play Developer API purchases.subscriptionsv2.get + acknowledge) with a service-account JWT.
// Key: env.PLAY_SA_JSON (Pages secret) or the gitignored functions/_lib/play_key.js (export default {service account JSON}).
import PLAY_KEY from './play_key.js';
export const PACKAGE = 'app.snapcravings.twa';
export const PLAY_PRODUCTS = ['snapcravings_pro_monthly', 'snapcravings_pro_yearly'];
const enc = new TextEncoder();
const b64u = b => btoa(typeof b === 'string' ? b : String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function saKey(env) { try { return env.PLAY_SA_JSON ? JSON.parse(env.PLAY_SA_JSON) : PLAY_KEY; } catch { return PLAY_KEY; } }
let cached = null;
export async function accessToken(sa, f = fetch) {
  if (cached && cached.exp > Date.now() + 6e4 && cached.who === sa.client_email) return cached.tok;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const k = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64u(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const jwt = unsigned + '.' + b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', k, enc.encode(unsigned)));
  const r = await f('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt });
  const j = await r.json(); if (!r.ok || !j.access_token) throw new Error('google token ' + r.status);
  cached = { tok: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000, who: sa.client_email };
  return cached.tok;
}
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' + PACKAGE + '/purchases/subscriptions';
// Returns { active, until, productId, orderId }; acknowledges an unacknowledged active purchase.
export async function checkPlaySub(sa, token, f = fetch) {
  const at = await accessToken(sa, f);
  const r = await f(API + 'v2/tokens/' + encodeURIComponent(token), { headers: { authorization: 'Bearer ' + at } });
  if (r.status === 404 || r.status === 410 || r.status === 400) return { active: false };
  if (!r.ok) throw new Error('play get ' + r.status);
  const s = await r.json();
  const item = (s.lineItems || []).find(li => PLAY_PRODUCTS.includes(li.productId));
  if (!item) return { active: false };
  const until = Date.parse(item.expiryTime || 0) || 0;
  const active = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED'].includes(s.subscriptionState) && until > Date.now();
  if (active && s.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') {
    const a = await f(API + '/' + item.productId + '/tokens/' + encodeURIComponent(token) + ':acknowledge', { method: 'POST', headers: { authorization: 'Bearer ' + at, 'content-type': 'application/json' }, body: '{}' });
    if (!a.ok) console.log('play ack', a.status);
  }
  return { active, until, productId: item.productId, orderId: s.latestOrderId || '' };
}
