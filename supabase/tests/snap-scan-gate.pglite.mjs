import { PGlite } from '@electric-sql/pglite'; import fs from 'fs';
const db = new PGlite(); await db.exec("create role anon; create role authenticated; create role service_role;");
const sql = fs.readFileSync('/workspace/craving-app/supabase/migrations/20261101_snapcravings_scan_gate.sql', 'utf8'); await db.exec(sql); await db.exec(sql);
await db.exec('set role anon');
const g = async (d, ip, s) => (await db.query('select snap_scan_gate($1,$2,$3) r', [d, ip, s])).rows[0].r;
const D = 'a'.repeat(32), D2 = 'b'.repeat(32), IP = 'c'.repeat(32);
const out = []; for (const s of ['s1', 's1x', 's1x', 's2xx', 's3xx', 's4xx']) out.push(JSON.stringify(await g(D, IP, s.padEnd(4, 'x'))));
console.log(out.join('\n')); console.log('other device', JSON.stringify(await g(D2, IP, 'zzzz')));
try { await db.query('select * from snap_scan_log'); console.log('ANON READ (bad)'); } catch (e) { console.log('anon read blocked'); }
