import { PGlite } from '@electric-sql/pglite'; import fs from 'fs';
const db = new PGlite(); await db.exec("create role anon; create role authenticated; create role service_role;");
const sql = fs.readFileSync('/workspace/craving-app/supabase/migrations/20261102_snapcravings_library.sql', 'utf8'); await db.exec(sql); await db.exec(sql);
await db.exec('set role anon');
const rate = async (h, d, v, name = 'Tacos') => (await db.query('select snap_rate($1,$2,$3,$4,$5) r', [h, d, v, JSON.stringify({ name, steps: ['x'] }), 'en'])).rows[0].r;
const H = 'a'.repeat(32), H2 = 'b'.repeat(32), D = 'c'.repeat(32), D2 = 'd'.repeat(32);
console.log(JSON.stringify(await rate(H, D, 1)), JSON.stringify(await rate(H, D, 1)), JSON.stringify(await rate(H, D2, 1)), JSON.stringify(await rate(H2, D, -1, 'Soup')), JSON.stringify(await rate(H, D2, 0)));
console.log('bad', JSON.stringify(await rate('zz', D, 1)));
const lib = (await db.query("select snap_library('en','',10) r")).rows[0].r; console.log('library', lib.length, lib[0]?.recipe?.name, lib[0]?.up);
console.log('search', (await db.query("select snap_library('en','soup',10) r")).rows[0].r.length);
try { await db.query('select * from snap_votes'); console.log('ANON READ (bad)'); } catch { console.log('anon read blocked'); }
