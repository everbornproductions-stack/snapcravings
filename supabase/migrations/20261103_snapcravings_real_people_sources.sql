-- SnapCravings stats: real people only + traffic sources. Apply in the Supabase SQL editor (project everborn-command). Safe to re-run.
-- /api/ev now flags bot / automation / owner / test traffic with meta.kind ('bot','test','owner') and the first page_view of a device with
-- meta.first=1 plus meta.src (instagram, tiktok, facebook, youtube, google, email, direct, other), ref, utm, med, cmp.
-- snap_stats gains p_real (default true = hide anything with meta.kind) and returns 'sources' and 'campaigns'. Until this runs,
-- /api/stats falls back to the old 2-argument function (all traffic, no sources) and the dashboard says so.
-- snap_log_event is unchanged: it already accepts the new meta keys (short strings, under 300 chars).

-- ---------- aggregates for the dashboard ----------
drop function if exists public.snap_stats(text, int);
create or replace function public.snap_stats(p_key text, p_days int default 7, p_real boolean default true)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  tz constant text := 'America/Los_Angeles';
  v_hash text; v_days int := least(greatest(coalesce(p_days, 7), 1), 90); v_from timestamptz;
  v_totals jsonb; v_sources jsonb; v_campaigns jsonb; v_daily jsonb; v_plans jsonb; v_screens jsonb; v_subs jsonb;
begin
  select value into v_hash from public.snap_settings where key = 'stats_key';
  if v_hash is null or p_key is null or length(p_key) < 20 or length(p_key) > 200
     or encode(sha256(convert_to(p_key, 'UTF8')), 'hex') <> v_hash then
    perform pg_sleep(0.4);   -- slows guessing
    return null;
  end if;
  v_from := (date_trunc('day', now() at time zone tz) - (v_days - 1) * interval '1 day') at time zone tz;

  select jsonb_build_object(
    'visits',           count(*) filter (where event = 'page_view'),
    'unique_devices',   count(distinct device_hash),
    'scans',            count(*) filter (where event = 'scan'),
    'recipes_shown',    count(*) filter (where event = 'recipes_shown'),
    'more_ideas',       count(*) filter (where event = 'more_ideas'),
    'favorites',        count(*) filter (where event = 'favorite'),
    'diet_saved',       count(*) filter (where event = 'diet_saved'),
    'installs',         count(*) filter (where event = 'install'),
    'upgrade_clicks',   count(*) filter (where event = 'upgrade_click'),
    'upgrade_devices',  count(distinct device_hash) filter (where event = 'upgrade_click'),
    'checkout_returns', count(*) filter (where event = 'checkout_return'),
    'checkout_return_devices', count(distinct device_hash) filter (where event = 'checkout_return'))
  into v_totals from public.snap_events where ts >= v_from and (not p_real or not (meta ? 'kind'));

  select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'visits', x.visits, 'unique_devices', x.uniq, 'scans', x.scans,
           'upgrade_clicks', x.upgrades, 'checkout_returns', x.returns) order by d.day), '[]'::jsonb)
  into v_daily
  from (select ((v_from at time zone tz)::date + g) as day from generate_series(0, v_days - 1) g) d
  left join lateral (
    select count(*) filter (where e.event = 'page_view') visits, count(distinct e.device_hash) uniq,
           count(*) filter (where e.event = 'scan') scans, count(*) filter (where e.event = 'upgrade_click') upgrades,
           count(*) filter (where e.event = 'checkout_return') returns
    from public.snap_events e where e.ts >= v_from and (not p_real or not (e.meta ? 'kind')) and (e.ts at time zone tz)::date = d.day) x on true;

  select coalesce(jsonb_object_agg(plan, jsonb_build_object('devices', devs, 'events', evs, 'scans', scans)), '{}'::jsonb)
  into v_plans from (select plan, count(distinct device_hash) devs, count(*) evs, count(*) filter (where event = 'scan') scans
                     from public.snap_events where ts >= v_from and (not p_real or not (meta ? 'kind')) group by plan) p;

  select coalesce(jsonb_agg(jsonb_build_object('screen', screen, 'views', n) order by n desc), '[]'::jsonb)
  into v_screens from (select screen, count(*) n from public.snap_events where ts >= v_from and (not p_real or not (meta ? 'kind')) and event = 'page_view' and screen is not null group by screen order by n desc limit 12) s;

  -- where first visits came from (one row per device: its first_visit page_view carries meta.first = 1)
  select coalesce(jsonb_agg(jsonb_build_object('src', src, 'visitors', n) order by n desc), '[]'::jsonb)
  into v_sources from (select coalesce(meta->>'src', 'direct') src, count(distinct device_hash) n from public.snap_events
                       where ts >= v_from and event = 'page_view' and meta->>'first' = '1' and (not p_real or not (meta ? 'kind')) group by 1) q;
  select coalesce(jsonb_agg(jsonb_build_object('label', label, 'visitors', n) order by n desc), '[]'::jsonb)
  into v_campaigns from (select concat_ws(' / ', meta->>'utm', meta->>'med', meta->>'cmp') label, count(distinct device_hash) n from public.snap_events
                         where ts >= v_from and event = 'page_view' and meta->>'first' = '1' and meta ? 'utm' and (not p_real or not (meta ? 'kind'))
                         group by 1 order by n desc limit 8) c;

  select jsonb_build_object(
    'active', (select count(*) from public.snap_subs b where public.snap_sub_is_active(b)),
    'total_ever', (select count(*) from public.snap_subs),
    'new_in_range', (select count(distinct ss.email) from public.snap_sessions ss where ss.created_at >= v_from),
    'canceling', (select count(*) from public.snap_subs b where public.snap_sub_is_active(b) and b.cancel_at_period_end))
  into v_subs;

  return jsonb_build_object('days', v_days, 'from', v_from, 'generated_at', now(), 'totals', v_totals, 'daily', v_daily,
                            'plans', v_plans, 'screens', v_screens, 'subscribers', v_subs, 'sources', v_sources, 'campaigns', v_campaigns, 'real_only', p_real);
end $$;
revoke all on function public.snap_stats(text, int, boolean) from public;
grant execute on function public.snap_stats(text, int, boolean) to anon, authenticated, service_role;
