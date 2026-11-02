-- SnapCravings: community Library ratings in the 8 new languages (pt, hi, id, fr, de, ar, ru, tr). Until this runs,
-- functions/api/library.js keeps those languages out of the shared Library (no votes saved as 'en', empty list).
-- Rate (vote 1 / -1, 0 = clear). Stores the recipe the first time. Returns {up, down, vote}.
create or replace function public.snap_rate(p_hash text, p_device text, p_vote int, p_recipe jsonb, p_lang text default 'en')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_up int; v_down int;
begin
  if p_hash !~ '^[0-9a-f]{16,64}$' or p_device !~ '^[0-9a-f]{16,64}$' or p_vote not in (-1, 0, 1) then return jsonb_build_object('error', 'bad-input'); end if;
  if p_recipe is null or jsonb_typeof(p_recipe) <> 'object' or length(p_recipe::text) > 20000 or coalesce(p_recipe->>'name', '') = '' then return jsonb_build_object('error', 'bad-recipe'); end if;
  insert into public.snap_recipes (hash, lang, name, recipe) values (p_hash, case when p_lang in ('es', 'pt', 'hi', 'id', 'fr', 'de', 'ar', 'ru', 'tr') then p_lang else 'en' end, left(p_recipe->>'name', 120), p_recipe) on conflict (hash) do nothing;
  if p_vote = 0 then delete from public.snap_votes where hash = p_hash and device_hash = p_device;
  else insert into public.snap_votes (hash, device_hash, vote) values (p_hash, p_device, p_vote) on conflict (hash, device_hash) do update set vote = excluded.vote, ts = now(); end if;
  select count(*) filter (where vote = 1), count(*) filter (where vote = -1) into v_up, v_down from public.snap_votes where hash = p_hash;
  update public.snap_recipes set up = v_up, down = v_down where hash = p_hash;
  return jsonb_build_object('up', v_up, 'down', v_down, 'vote', p_vote);
end $$;
-- Library: top-rated (net score >= 1) recipes in a language, optional name search. Returns a json array.
create or replace function public.snap_library(p_lang text default 'en', p_q text default '', p_limit int default 120)
returns jsonb language sql security definer set search_path = public stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('hash', hash, 'recipe', recipe, 'up', up, 'down', down) order by (up - down) desc, up desc, created desc), '[]'::jsonb)
  from (select * from public.snap_recipes where not hidden and lang = case when p_lang in ('es', 'pt', 'hi', 'id', 'fr', 'de', 'ar', 'ru', 'tr') then p_lang else 'en' end and up - down >= 1
        and (coalesce(p_q, '') = '' or name ilike '%' || replace(replace(left(p_q, 60), '%', ''), '_', '') || '%')
        order by (up - down) desc, up desc, created desc limit least(greatest(coalesce(p_limit, 120), 1), 300)) t;
$$;
