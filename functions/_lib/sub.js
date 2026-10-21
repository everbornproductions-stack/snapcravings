// Shared subscription helpers: signed unlock tokens (HMAC-SHA256 with env.SUB_SECRET).
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
export const PAYWALL_ON = env => !!(env.SQUARE_ACCESS_TOKEN && env.SUB_SECRET && env.SQUARE_LOCATION_ID !== undefined);
