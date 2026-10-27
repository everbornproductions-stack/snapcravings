// Shared subscription helpers: signed unlock tokens (HMAC-SHA256 with env.SUB_SECRET) + Stripe/Supabase constants.
// Payments run on Stripe (Payment Link + Supabase Edge Function webhook). No Stripe secret key lives here.
// Fill these two once the Stripe objects exist; while PAYMENT_LINK_URL is empty the app shows "Unlimited is coming soon".
export const PAYMENT_LINK_URL = '';   // e.g. https://buy.stripe.com/xxxx  (SnapCravings Unlimited, $4.99/mo)
export const PORTAL_URL = '';         // Stripe customer portal login link, e.g. https://billing.stripe.com/p/login/xxxx
export const PRICE_CENTS = 499;       // display only; the real price lives on the Stripe Payment Link
// Public Supabase project (everborn-command). The publishable key is designed to be public: it can only call
// the snap_check_sub RPC (RLS blocks every table). Not a secret.
export const SUPABASE_URL = 'https://ezbpstloczzdlcxwliwu.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_-vQhqr9u5dSSLCkrnkNT5g_JmReU16a';
const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function key(env) { return crypto.subtle.importKey('raw', enc.encode(env.SUB_SECRET || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }
export async function signToken(env, email, days = 35) {
  const body = b64u(enc.encode(JSON.stringify({ e: email, x: Date.now() + days * 864e5 })));
  return body + '.' + b64u(await crypto.subtle.sign('HMAC', await key(env), enc.encode(body)));
}
export async function verifyToken(env, tok) {
  if (!env.SUB_SECRET || !tok || !tok.includes('.')) return null;
  const [body, sig] = tok.split('.');
  const good = b64u(await crypto.subtle.sign('HMAC', await key(env), enc.encode(body)));
  if (good !== sig) return null;
  try { const p = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))); return p.x > Date.now() ? p : null; } catch { return null; }
}
export const PAYWALL_ON = env => !!(PAYMENT_LINK_URL && env.SUB_SECRET && env.PAYWALL !== 'off');
