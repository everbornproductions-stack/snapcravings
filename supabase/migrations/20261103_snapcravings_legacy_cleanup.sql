-- SnapCravings stats: flag PAST test / bot traffic so the "Real people" view leaves it out. Nothing is deleted.
-- Apply AFTER 20261103_snapcravings_real_people_sources.sql, in the Supabase SQL editor (project everborn-command). Safe to re-run.
-- Old rows hold no user agent or IP (by design), so headless / bot user agents CANNOT be found in history; /api/ev catches those live only.
-- What history does hold: plan, device_hash, ts, event counts. Rules (rows with no meta.kind yet, before the cutoff):
--   owner : plan = 'owner'                                   -> meta.kind = 'owner'
--   probe : our own probe device (sc-probe-moreideas-1103)    -> meta.kind = 'test'
--   burst : device first seen inside a crowd of >= p_burst_min new devices within +/- 5 minutes, with <= 4 events in total
--           (several brand-new devices minutes apart with almost no activity = scripted / test runs). Source is not stored, so time is the only signal.
-- Flagged rows get meta.legacy = 1 so this is reversible:  update snap_events set meta = meta - 'kind' - 'legacy' where meta ? 'legacy';
-- Old totals stay available: the dashboard's "All traffic" view (p_real = false) still counts every row.
-- Usage:  select snap_flag_legacy(false);   -- dry run: counts + real totals for 7 and 30 days as they would be
--         select snap_flag_legacy(true);    -- apply

create or replace function public.snap_flag_legacy(p_apply boolean default false, p_burst_min int default 6, p_cutoff timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_probe text := substr(encode(sha256(convert_to('snapcravings-ev:sc-probe-moreideas-1103', 'UTF8')), 'hex'), 1, 32);
  v_out jsonb; v_rows int := 0;
begin
  create temp table if not exists _snap_legacy_flags (device_hash text primary key, kind text not null) on commit drop;
  truncate _snap_legacy_flags;
  insert into _snap_legacy_flags select distinct device_hash, 'owner' from public.snap_events
    where plan = 'owner' and ts < p_cutoff and not (meta ? 'kind') on conflict do nothing;
  insert into _snap_legacy_flags select v_probe, 'test' where exists (select 1 from public.snap_events where device_hash = v_probe) on conflict do nothing;
  insert into _snap_legacy_flags
    with f as (select device_hash, min(ts) first_ts, count(*) n from public.snap_events group by device_hash)
    select a.device_hash, 'test' from f a
    where a.n <= 4 and a.first_ts < p_cutoff
      and (select count(*) from f b where b.first_ts between a.first_ts - interval '5 minutes' and a.first_ts + interval '5 minutes') >= p_burst_min
    on conflict do nothing;

  -- rows this run touches (computed before applying)
  create temp table if not exists _snap_legacy_rows (id bigint primary key) on commit drop;
  truncate _snap_legacy_rows;
  insert into _snap_legacy_rows select e.id from public.snap_events e join _snap_legacy_flags x using (device_hash)
    where e.ts < p_cutoff and not (e.meta ? 'kind');

  select jsonb_build_object(
    'applied', p_apply,
    'devices_flagged', (select count(distinct e.device_hash) from public.snap_events e join _snap_legacy_rows r on r.id = e.id),
    'by_kind', (select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb) from (select x.kind, count(distinct e.device_hash) n from public.snap_events e
                 join _snap_legacy_rows r on r.id = e.id join _snap_legacy_flags x using (device_hash) group by x.kind) k),
    'rows_flagged', (select count(*) from _snap_legacy_rows),
    'visits_flagged', (select count(*) from public.snap_events e join _snap_legacy_rows r on r.id = e.id where e.event = 'page_view'),
    'all_traffic_7d',  (select jsonb_build_object('visits', count(*) filter (where event = 'page_view'), 'devices', count(distinct device_hash)) from public.snap_events where ts >= now() - interval '7 days'),
    'all_traffic_30d', (select jsonb_build_object('visits', count(*) filter (where event = 'page_view'), 'devices', count(distinct device_hash)) from public.snap_events where ts >= now() - interval '30 days'),
    'real_7d',  (select jsonb_build_object('visits', count(*) filter (where event = 'page_view'), 'devices', count(distinct device_hash)) from public.snap_events e
                 where ts >= now() - interval '7 days' and not (meta ? 'kind') and e.id not in (select id from _snap_legacy_rows)),
    'real_30d', (select jsonb_build_object('visits', count(*) filter (where event = 'page_view'), 'devices', count(distinct device_hash)) from public.snap_events e
                 where ts >= now() - interval '30 days' and not (meta ? 'kind') and e.id not in (select id from _snap_legacy_rows)))
  into v_out;

  if p_apply then
    update public.snap_events e set meta = e.meta || jsonb_build_object('kind', x.kind, 'legacy', 1)
    from _snap_legacy_flags x where e.device_hash = x.device_hash and e.id in (select id from _snap_legacy_rows);
  end if;
  return v_out;
end $$;
-- SQL editor / service role only: never callable from the public API
revoke all on function public.snap_flag_legacy(boolean, int, timestamptz) from public, anon, authenticated;
grant execute on function public.snap_flag_legacy(boolean, int, timestamptz) to service_role;
