// Run: npm i --no-save @electric-sql/pglite && node supabase/tests/snap-events.pglite.mjs   (reads STATS_KEY.txt; prints no key)
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const KEY = fs.readFileSync(new URL('../../STATS_KEY.txt', import.meta.url), 'utf8').trim();
const db = new PGlite();
await db.exec("create role anon; create role authenticated; create role service_role;");
const M = new URL('../migrations/', import.meta.url).pathname;
await db.exec(fs.readFileSync(M + '20261026_snapcravings_subs.sql', 'utf8'));
const ev = fs.readFileSync(M + '20261026_snapcravings_events.sql', 'utf8');
await db.exec(ev); await db.exec(ev); console.log('migration applied twice OK');
const q = async (s, p) => (await db.query(s, p)).rows;
const log = async (e, s, pl, d, m) => (await q('select snap_log_event($1,$2,$3,$4,$5::jsonb) r', [e, s, pl, d, JSON.stringify(m ?? {})]))[0].r;
const D1 = 'a'.repeat(32), D2 = 'b'.repeat(32), D3 = 'c'.repeat(32);
await db.exec("set role anon");
const res = {
  ok1: await log('page_view', 'home', 'free', D1), ok2: await log('page_view', 'scan', 'free', D1), ok3: await log('scan', 'scan', 'free', D1, { photos: 3 }),
  ok4: await log('page_view', 'home', 'paid', D2), ok5: await log('upgrade_click', 'pro', 'free', D1), ok6: await log('checkout_return', 'pro', 'paid', D2),
  ok7: await log('page_view', 'pro', 'owner', D3), ok8: await log('favorite', 'recipe', 'free', D1, { on: 1 }),
  badEvent: await log('drop_table', 'home', 'free', D1), badPlan: await log('scan', 'home', 'vip', D1), badScreen: await log('scan', 'Home!', 'free', D1),
  badDev: await log('scan', 'home', 'free', 'xyz'), bigMeta: await log('scan', 'home', 'free', D1, { a: 'x'.repeat(400) }), arrMeta: await log('scan', 'home', 'free', D1, [1]),
};
console.log(JSON.stringify(res));
// rate limit: device D1 already has 6 rows; push to 120
let accepted = 0; for (let i = 0; i < 125; i++) if (await log('page_view', 'home', 'free', D1)) accepted++;
console.log('D1 extra accepted before limit (expect 115):', accepted);
try { await q('select * from snap_events'); console.log('ANON READ OK (bad)'); } catch (e) { console.log('anon read blocked:', e.message); }
try { await q("insert into snap_events(event,plan,device_hash) values ('x','free','y')"); console.log('ANON INSERT OK (bad)'); } catch (e) { console.log('anon insert blocked:', e.message); }
console.log('wrong key:', JSON.stringify((await q('select snap_stats($1,7) r', ['wrong-key-wrong-key-wrong-key']))[0].r));
console.log('short key:', JSON.stringify((await q('select snap_stats($1,7) r', ['x']))[0].r));
await db.exec("reset role"); await db.exec("insert into snap_subs(email,status,current_period_end,cancel_at_period_end) values ('a@x.com','active',now()+interval '9 days',true),('b@x.com','canceled',now(),false)");
await db.exec("insert into snap_sessions values ('cs_live_abcdefghij12','a@x.com',now())"); await db.exec("set role anon");
const s = (await q('select snap_stats($1,$2) r', [KEY, 7]))[0].r;
console.log('totals', JSON.stringify(s.totals)); console.log('plans', JSON.stringify(s.plans)); console.log('subs', JSON.stringify(s.subscribers)); console.log('screens', JSON.stringify(s.screens));
console.log('days', s.daily.length, 'last day', JSON.stringify(s.daily.at(-1)), 'first', JSON.stringify(s.daily[0]));
console.log('30d days:', (await q('select snap_stats($1,$2) r', [KEY, 30]))[0].r.daily.length, ' 500d clamp:', (await q('select snap_stats($1,$2) r', [KEY, 500]))[0].r.days);
