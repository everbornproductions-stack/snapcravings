-- SnapCravings shared AI recipe library (every validated AI recipe is kept; /api/recipes serves matches before calling the AI).
-- Run once in the Supabase SQL editor (project everborn-command) AFTER 20261026_snapcravings_subs.sql and 20261102_snapcravings_library.sql. Safe to re-run.
-- Until it runs, the Pages function uses a small KV fallback (same behavior, approximate metrics).
-- Writes need p_key: the server derives it from the gitignored stats key; only its SHA-256 is stored here (snap_settings.lib_key).
-- No personal data: recipe JSON, the recipe's own normalized ingredient names, diet tags, hashed free-text prefs, craving key.
create table if not exists public.snap_ai_recipes (
  id        text primary key,                 -- same hash as snap_recipes.hash (ratings join)
  lang      text not null,
  section   text not null check (section in ('ready', 'more')),
  craving   text not null,                    -- chip value or 'h:<hash>' for typed cravings
  diet_tags text[] not null default '{}',
  pref_key  text not null default '',         -- hash of free-text diet prefs ('' = none)
  level     text not null,
  recipe    jsonb not null,
  ings      text[] not null,                  -- required (on-hand, non-staple) normalized ingredients
  extras    text[] not null default '{}',     -- "more" recipes: items to buy
  kcal int, protein_g int, carbs_g int, fat_g int,
  uses      int not null default 0,
  hidden    boolean not null default false,
  created   timestamptz not null default now(),
  last_used timestamptz
);
create index if not exists snap_ai_recipes_bucket_idx on public.snap_ai_recipes (lang, section, craving, created desc) where not hidden;
create index if not exists snap_ai_recipes_ings_idx on public.snap_ai_recipes using gin (ings);
create table if not exists public.snap_lib_metrics (day date primary key, lib int not null default 0, ai int not null default 0, req int not null default 0, full_lib int not null default 0);
alter table public.snap_ai_recipes enable row level security;
alter table public.snap_lib_metrics enable row level security;
revoke all on public.snap_ai_recipes, public.snap_lib_metrics from public, anon, authenticated;
grant all on public.snap_ai_recipes, public.snap_lib_metrics to service_role;
-- lib_key value = SHA-256 hex of the server key (the key itself is never in this file).
insert into public.snap_settings (key, value) values ('lib_key', '91b7039cc2638011e8d7ca7fc48fb2a0999e1f54bd2574f2c6876f4a4f352d32') on conflict (key) do update set value = excluded.value;

create or replace function public.snap_lib_ok(p_key text) returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.snap_settings where key = 'lib_key' and value = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex'));
$$;

-- Candidates: same language, section and craving, sharing at least one required ingredient. Ratings come from snap_recipes.
create or replace function public.snap_lib_find(p_lang text, p_section text, p_craving text, p_ings text[], p_limit int default 300)
returns jsonb language sql security definer set search_path = public stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'recipe', a.recipe, 'ings', a.ings, 'diet_tags', a.diet_tags, 'pref_key', a.pref_key, 'created', a.created,
         'uses', a.uses, 'up', coalesce(r.up, 0), 'down', coalesce(r.down, 0))), '[]'::jsonb)
  from (select * from public.snap_ai_recipes where not hidden and lang = left(p_lang, 8) and section = p_section and craving = left(p_craving, 40)
        and ings && coalesce(p_ings[1:80], '{}') order by created desc limit least(greatest(coalesce(p_limit, 300), 1), 500)) a
  left join public.snap_recipes r on r.hash = a.id;
$$;

-- Save validated recipes (server key required). Returns how many were new.
create or replace function public.snap_lib_save(p_key text, p_rows jsonb) returns int language plpgsql security definer set search_path = public as $$
declare v jsonb; n int := 0; c int;
begin
  if not public.snap_lib_ok(p_key) or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 10 then return 0; end if;
  if (select count(*) from public.snap_ai_recipes where created > now() - interval '1 hour') > 3000 then return 0; end if;
  for v in select * from jsonb_array_elements(p_rows) loop
    if coalesce(v->>'id', '') !~ '^[0-9a-f]{16,64}$' or length((v->'recipe')::text) > 20000 or coalesce(v->'recipe'->>'name', '') = '' or jsonb_typeof(v->'ings') <> 'array' then continue; end if;
    insert into public.snap_ai_recipes (id, lang, section, craving, diet_tags, pref_key, level, recipe, ings, extras, kcal, protein_g, carbs_g, fat_g)
    values (v->>'id', left(v->>'lang', 8), v->>'section', left(v->>'craving', 40),
            array(select left(x, 40) from jsonb_array_elements_text(coalesce(v->'diet_tags', '[]')) x limit 20), left(coalesce(v->>'pref_key', ''), 40), left(v->>'level', 20), v->'recipe',
            array(select left(x, 60) from jsonb_array_elements_text(v->'ings') x limit 30), array(select left(x, 60) from jsonb_array_elements_text(coalesce(v->'extras', '[]')) x limit 15),
            (v->'recipe'->>'kcal')::numeric::int, (v->'recipe'->>'protein_g')::numeric::int, (v->'recipe'->>'carbs_g')::numeric::int, (v->'recipe'->>'fat_g')::numeric::int)
    on conflict (id) do nothing;
    get diagnostics c = row_count; n := n + c;
  end loop;
  return n;
end $$;

-- One /api/recipes answer: p_lib recipes from the library, p_ai from the AI; bumps uses on the served ids.
create or replace function public.snap_lib_served(p_key text, p_ids text[], p_lib int, p_ai int) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.snap_lib_ok(p_key) then return false; end if;
  if coalesce(array_length(p_ids, 1), 0) > 0 then update public.snap_ai_recipes set uses = uses + 1, last_used = now() where id = any(p_ids[1:10]); end if;
  insert into public.snap_lib_metrics (day, lib, ai, req, full_lib) values (current_date, greatest(0, least(p_lib, 20)), greatest(0, least(p_ai, 20)), 1, case when p_ai = 0 then 1 else 0 end)
  on conflict (day) do update set lib = snap_lib_metrics.lib + excluded.lib, ai = snap_lib_metrics.ai + excluded.ai, req = snap_lib_metrics.req + 1, full_lib = snap_lib_metrics.full_lib + excluded.full_lib;
  return true;
end $$;

-- Aggregates only (no recipe text): library size and library-vs-AI share.
create or replace function public.snap_lib_stats() returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'recipes', (select count(*) from public.snap_ai_recipes where not hidden),
    'by_lang', (select coalesce(jsonb_object_agg(lang, n), '{}') from (select lang, count(*) n from public.snap_ai_recipes where not hidden group by lang) t),
    'today', (select coalesce(to_jsonb(m) - 'day', '{"lib":0,"ai":0,"req":0,"full_lib":0}') from public.snap_lib_metrics m where day = current_date),
    'last7', (select jsonb_build_object('lib', coalesce(sum(lib), 0), 'ai', coalesce(sum(ai), 0), 'req', coalesce(sum(req), 0), 'full', coalesce(sum(full_lib), 0),
              'share_library', case when coalesce(sum(lib + ai), 0) = 0 then 0 else round(sum(lib)::numeric / sum(lib + ai), 3) end) from public.snap_lib_metrics where day > current_date - 7));
$$;
revoke all on function public.snap_lib_ok(text), public.snap_lib_find(text, text, text, text[], int), public.snap_lib_save(text, jsonb), public.snap_lib_served(text, text[], int, int), public.snap_lib_stats() from public;
grant execute on function public.snap_lib_find(text, text, text, text[], int), public.snap_lib_save(text, jsonb), public.snap_lib_served(text, text[], int, int), public.snap_lib_stats() to anon, authenticated, service_role;
