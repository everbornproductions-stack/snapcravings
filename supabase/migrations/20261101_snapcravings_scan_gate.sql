-- SnapCravings free-scan limit (3 scans per device per rolling 7 days, plus a 30-per-IP cap against storage-clearing abuse).
-- Run once in the Supabase SQL editor (project everborn-command). Safe to re-run.
-- Privacy: only salted SHA-256 hashes of the anonymous device id and of the IP are stored (computed in the Pages function),
-- rows older than 8 days are deleted by the gate itself. One "scan" = one Go in the app (many photo batches share one scan id).
create table if not exists public.snap_scan_log (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  device_hash text not null,
  ip_hash     text not null,
  scan_id     text not null
);
create index if not exists snap_scan_log_dev_idx on public.snap_scan_log (device_hash, ts);
create index if not exists snap_scan_log_ip_idx on public.snap_scan_log (ip_hash, ts);
alter table public.snap_scan_log enable row level security;
revoke all on public.snap_scan_log from public, anon, authenticated;
grant select, insert, delete on public.snap_scan_log to service_role;

-- Returns {allowed, used, limit}. Same scan id again = allowed without counting (batches of one scan).
create or replace function public.snap_scan_gate(p_device text, p_ip text, p_scan text, p_limit int default 3, p_ip_limit int default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_dev int; v_ip int; v_lim int := least(greatest(coalesce(p_limit, 3), 1), 50); v_iplim int := least(greatest(coalesce(p_ip_limit, 30), 1), 500);
begin
  if p_device !~ '^[0-9a-f]{16,64}$' or p_ip !~ '^[0-9a-f]{16,64}$' or p_scan is null or length(p_scan) not between 4 and 64 then
    return jsonb_build_object('allowed', true, 'used', 0, 'limit', v_lim, 'note', 'bad-input');
  end if;
  delete from public.snap_scan_log where ts < now() - interval '8 days' and id in (select id from public.snap_scan_log where ts < now() - interval '8 days' limit 200);
  if exists (select 1 from public.snap_scan_log where device_hash = p_device and scan_id = p_scan and ts > now() - interval '7 days') then
    select count(distinct scan_id) into v_dev from public.snap_scan_log where device_hash = p_device and ts > now() - interval '7 days';
    return jsonb_build_object('allowed', true, 'used', v_dev, 'limit', v_lim);
  end if;
  select count(distinct scan_id) into v_dev from public.snap_scan_log where device_hash = p_device and ts > now() - interval '7 days';
  select count(distinct scan_id) into v_ip from public.snap_scan_log where ip_hash = p_ip and ts > now() - interval '7 days';
  if v_dev >= v_lim or v_ip >= v_iplim then
    return jsonb_build_object('allowed', false, 'used', v_dev, 'limit', v_lim);
  end if;
  insert into public.snap_scan_log (device_hash, ip_hash, scan_id) values (p_device, p_ip, p_scan);
  return jsonb_build_object('allowed', true, 'used', v_dev + 1, 'limit', v_lim);
end $$;
revoke all on function public.snap_scan_gate(text, text, text, int, int) from public;
grant execute on function public.snap_scan_gate(text, text, text, int, int) to anon, authenticated, service_role;
