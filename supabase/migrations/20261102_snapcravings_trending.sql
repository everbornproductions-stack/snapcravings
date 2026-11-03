-- SnapCravings trending "Popular cravings" (2026-11-02). Run once in the Supabase SQL editor AFTER 20261102_snapcravings_recipe_library.sql. Safe to re-run.
-- Until it runs, /api/trending answers source:'static' and the app keeps its built-in list.
-- One row per (day, country, kind, dish, device hash): a device counts once per dish per day. No personal data: country code,
-- AI-written dish name (never the raw typed text), salted device hash. Rows older than 15 days are pruned on write.
create table if not exists public.snap_trend_hits (
  day     date not null default current_date,
  country text not null,                         -- ISO-2 or 'XX'
  kind    text not null check (kind in ('crave', 'made')),
  name    text not null,                         -- normalized dish name (lower-case)
  label   text not null,                         -- display name as the AI wrote it
  lang    text not null default 'en',
  device  text not null,
  primary key (day, country, kind, name, device)
);
create index if not exists snap_trend_hits_country_idx on public.snap_trend_hits (country, day);
alter table public.snap_trend_hits enable row level security;
revoke all on public.snap_trend_hits from public, anon, authenticated;
grant all on public.snap_trend_hits to service_role;

-- Write (server only: needs the same lib key as snap_lib_save).
create or replace function public.snap_trend_hit(p_key text, p_country text, p_kind text, p_name text, p_label text, p_lang text, p_device text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.snap_lib_ok(p_key) then return false; end if;
  if p_kind not in ('crave', 'made') or length(coalesce(p_name, '')) not between 2 and 48 or length(coalesce(p_label, '')) not between 2 and 48
     or p_country !~ '^[A-Z]{2}$' or length(coalesce(p_device, '')) not between 16 and 64 then return false; end if;
  insert into public.snap_trend_hits (country, kind, name, label, lang, device) values (p_country, p_kind, p_name, p_label, coalesce(nullif(p_lang, ''), 'en'), p_device)
    on conflict do nothing;
  if random() < 0.02 then delete from public.snap_trend_hits where day < current_date - 15; end if;
  return true;
end $$;

-- Read (public, aggregates only): top dishes for a country (or 'ALL') in the last p_days, with at least p_min distinct devices.
create or replace function public.snap_trend_top(p_country text, p_lang text default 'en', p_days int default 7, p_min int default 3, p_limit int default 8)
returns jsonb language sql security definer set search_path = public stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'label', t.label, 'n', t.n) order by t.n desc), '[]'::jsonb) from (
    select name, (array_agg(label order by day desc))[1] as label, count(distinct device)::int as n
    from public.snap_trend_hits
    where day >= current_date - least(greatest(p_days, 1), 14) and (p_country = 'ALL' or country = p_country) and lang = coalesce(nullif(p_lang, ''), 'en')
    group by name having count(distinct device) >= greatest(p_min, 2)
    order by n desc limit least(greatest(p_limit, 1), 20)) t;
$$;
revoke all on function public.snap_trend_hit(text, text, text, text, text, text, text) from public;
grant execute on function public.snap_trend_hit(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.snap_trend_top(text, text, int, int, int) to anon, authenticated;
