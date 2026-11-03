// Shared per-IP hourly limiter for every AI endpoint. Uses the RATE_KV binding when the Pages project has one (shared across
// isolates and colos); without it (true in production on 2026-11-02, the box token cannot create KV) it falls back to the
// per-isolate memory map, so the limit is best effort until a KV namespace is bound as RATE_KV.
const mem = new Map();
export async function hourly(env, route, ip, n) {
  const key = `rl:${route}:${ip}:${Math.floor(Date.now() / 36e5)}`; let c;
  if (env && env.RATE_KV) { try { c = +(await env.RATE_KV.get(key) || 0) + 1; await env.RATE_KV.put(key, String(c), { expirationTtl: 3700 }); return c > n; } catch {} }
  c = (mem.get(key) || 0) + 1; mem.set(key, c); if (mem.size > 5000) mem.clear(); return c > n;
}
