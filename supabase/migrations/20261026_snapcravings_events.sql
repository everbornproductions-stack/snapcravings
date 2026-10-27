-- SnapCravings usage tracking + stats dashboard. Same Supabase project as snap_subs (everborn-command).
-- Run AFTER 20261026_snapcravings_subs.sql (uses snap_settings, snap_subs, snap_sessions, snap_sub_is_active). Safe to re-run.
--
-- Privacy: no cookies, no IP, no email, no user agent in events. device_hash = first 32 hex chars of SHA-256 of the app's
-- anonymous random device id, salted and computed SERVER-SIDE in the Cloudflare Pages function (/api/ev); the raw id never
-- reaches the database. meta is a small jsonb of counts only (e.g. {"n":3}).
--
-- snap_events        raw events. RLS on, no policies: nothing public can read or write it directly.
-- snap_log_event     anon-callable (publishable key, from the Pages function). Validates names and sizes, rate limits.
-- snap_stats         returns aggregates only when p_key matches the stats key. The key itself is NOT stored here:
--                    snap_settings.stats_key holds its SHA-256 hex, so this (committed) file and the table never contain it.
--                    The key lives in /workspace/craving-app/STATS_KEY.txt (gitignored). Rotate: update snap_settings set
--                    value = encode(sha256(convert_to('NEW KEY','UTF8')),'hex') where key='stats_key';

create table if not exists public.snap_events (
  id           bigint generated always as identity primary key,
  ts           timestamptz not null default now(),
  event        text not null,
  screen       text,
  plan         text not null,
  device_hash  text not null,
  meta         jsonb not null default '{}'::jsonb
);
create index if not exists snap_events_ts_idx on public.snap_events (ts);
create index if not exists snap_events_device_ts_idx on public.snap_events (device_hash, ts);
create index if not exists snap_events_event_ts_idx on public.snap_events (event, ts);
alter table public.snap_events enable row level security;
revoke all on public.snap_events from public, anon, authenticated;
grant select, insert, delete on public.snap_events to service_role;

insert into public.snap_settings (key, value) values ('stats_key', 'cae791b0abbb3050c968555f833b5c052a2f128294c18590a3e6bfb1742eec40') on conflict (key) do nothing;

-- ---------- log an event ----------
create or replace function public.snap_log_event(p_event text, p_screen text, p_plan text, p_device text, p_meta jsonb default '{}'::jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_meta jsonb := coalesce(p_meta, '{}'::jsonb);
begin
  if p_event is null or p_event not in ('page_view','scan','recipes_shown','more_ideas','favorite','upgrade_click','checkout_return','diet_saved','install') then return false; end if;
  if p_plan is null or p_plan not in ('free','paid','owner') then return false; end if;
  if p_screen is not null and p_screen !~ '^[a-z_]{1,24}$' then return false; end if;
  if p_device is null or p_device !~ '^[0-9a-f]{16,64}$' then return false; end if;
  if jsonb_typeof(v_meta) <> 'object' or length(v_meta::text) > 300 then return false; end if;
  -- light rate limits: 120 events per device per hour, 600 events per minute overall
  if (select count(*) from public.snap_events where device_hash = p_device and ts > now() - interval '1 hour') >= 120 then return false; end if;
  if (select count(*) from public.snap_events where ts > now() - interval '1 minute') >= 600 then return false; end if;
  insert into public.snap_events (event, screen, plan, device_hash, meta) values (p_event, p_screen, p_plan, p_device, v_meta);
  return true;
end $$;
revoke all on function public.snap_log_event(text, text, text, text, jsonb) from public;
grant execute on function public.snap_log_event(text, text, text, text, jsonb) to anon, authenticated, service_role;

-- ---------- aggregates for the dashboard ----------
create or replace function public.snap_stats(p_key text, p_days int default 7)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  tz constant text := 'America/Los_Angeles';
  v_hash text; v_days int := least(greatest(coalesce(p_days, 7), 1), 90); v_from timestamptz;
  v_totals jsonb; v_daily jsonb; v_plans jsonb; v_screens jsonb; v_subs jsonb;
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
  into v_totals from public.snap_events where ts >= v_from;

  select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'visits', x.visits, 'unique_devices', x.uniq, 'scans', x.scans,
           'upgrade_clicks', x.upgrades, 'checkout_returns', x.returns) order by d.day), '[]'::jsonb)
  into v_daily
  from (select ((v_from at time zone tz)::date + g) as day from generate_series(0, v_days - 1) g) d
  left join lateral (
    select count(*) filter (where e.event = 'page_view') visits, count(distinct e.device_hash) uniq,
           count(*) filter (where e.event = 'scan') scans, count(*) filter (where e.event = 'upgrade_click') upgrades,
           count(*) filter (where e.event = 'checkout_return') returns
    from public.snap_events e where e.ts >= v_from and (e.ts at time zone tz)::date = d.day) x on true;

  select coalesce(jsonb_object_agg(plan, jsonb_build_object('devices', devs, 'events', evs, 'scans', scans)), '{}'::jsonb)
  into v_plans from (select plan, count(distinct device_hash) devs, count(*) evs, count(*) filter (where event = 'scan') scans
                     from public.snap_events where ts >= v_from group by plan) p;

  select coalesce(jsonb_agg(jsonb_build_object('screen', screen, 'views', n) order by n desc), '[]'::jsonb)
  into v_screens from (select screen, count(*) n from public.snap_events where ts >= v_from and event = 'page_view' and screen is not null group by screen order by n desc limit 12) s;

  select jsonb_build_object(
    'active', (select count(*) from public.snap_subs b where public.snap_sub_is_active(b)),
    'total_ever', (select count(*) from public.snap_subs),
    'new_in_range', (select count(distinct ss.email) from public.snap_sessions ss where ss.created_at >= v_from),
    'canceling', (select count(*) from public.snap_subs b where public.snap_sub_is_active(b) and b.cancel_at_period_end))
  into v_subs;

  return jsonb_build_object('days', v_days, 'from', v_from, 'generated_at', now(), 'totals', v_totals, 'daily', v_daily,
                            'plans', v_plans, 'screens', v_screens, 'subscribers', v_subs);
end $$;
revoke all on function public.snap_stats(text, int) from public;
grant execute on function public.snap_stats(text, int) to anon, authenticated, service_role;
