-- Allow the growth events from web/grow.js (review card, share, Play banner). Same function as 20261026, only the event list changes.
-- Apply in the Supabase SQL editor. Until then /api/ev answers x-ev: rpc-rejected for these 5 events (app is unaffected).
create or replace function public.snap_log_event(p_event text, p_screen text, p_plan text, p_device text, p_meta jsonb default '{}'::jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_meta jsonb := coalesce(p_meta, '{}'::jsonb);
begin
  if p_event is null or p_event not in ('page_view','scan','recipes_shown','more_ideas','favorite','upgrade_click','checkout_return','diet_saved','install','review_card','review_go','share_recipe','play_banner','play_go') then return false; end if;
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

