-- SnapCravings Unlimited ($4.99/mo) on Stripe. Same Supabase project as Meldmind (everborn-command).
-- Safe to re-run. Independent of the Meldmind tables (own snap_* tables, nothing shared).
--
-- snap_subs            one row per buyer email: status, Stripe ids, period end. Written only by the
--                      snapcravings-stripe-webhook Edge Function (service role).
-- snap_sessions        Checkout Session id -> email, recorded from checkout.session.completed. This is the
--                      "proof" the app presents (it gets the id in the success redirect).
-- snap_stripe_events   event-id dedupe, so a replayed webhook is ignored. No payload stored.
-- snap_settings        tiny key/value switchboard (allow_email_restore).
-- snap_check_sub(p_email, p_session)   the ONLY thing anon/publishable can call. Returns {active, period_end, email}.
--
-- Proof tradeoff (documented on purpose):
--  * With a Checkout Session id (the app keeps it from the post-payment redirect) the lookup is by that session; the
--    email argument is ignored, so knowing someone's email gives nothing. Session ids are long random strings.
--  * "Restore purchase" on a brand-new device has no session id, only the email the buyer typed. While
--    snap_settings.allow_email_restore = 'true' (default) an email alone can answer "active or not" for that email.
--    Worst case: someone who guesses a subscriber's email unlocks $4.99 scans on their own device for up to the paid
--    period. To close it fully later:  update public.snap_settings set value='false' where key='allow_email_restore';
--    (then new-device restore needs the Stripe receipt/session id or the owner code).
--  * Every miss returns the same {active:false}, so it cannot be used to learn whether an address is a customer
--    (only a hit reveals "active", which the email-restore tradeoff above already accepts).

create table if not exists public.snap_subs (
  email               text primary key,
  status              text not null default 'active',   -- active | past_due | canceled | refunded | pending
  customer_id         text,
  subscription_id     text,
  current_period_end  timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at          timestamptz not null default now()
);
create index if not exists snap_subs_customer_idx on public.snap_subs (customer_id);
create index if not exists snap_subs_subscription_idx on public.snap_subs (subscription_id);

create table if not exists public.snap_sessions (
  session_id  text primary key,
  email       text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.snap_stripe_events (
  event_id    text primary key,
  type        text,
  received_at timestamptz not null default now()
);

create table if not exists public.snap_settings (
  key   text primary key,
  value text not null
);
insert into public.snap_settings (key, value) values ('allow_email_restore', 'true') on conflict (key) do nothing;

-- RLS on, no policies = no public read/write at all. Only service_role (the webhook) can touch the tables.
alter table public.snap_subs          enable row level security;
alter table public.snap_sessions      enable row level security;
alter table public.snap_stripe_events enable row level security;
alter table public.snap_settings      enable row level security;
revoke all on public.snap_subs, public.snap_sessions, public.snap_stripe_events, public.snap_settings from public, anon, authenticated;
grant select, insert, update, delete on public.snap_subs, public.snap_sessions, public.snap_stripe_events, public.snap_settings to service_role;

-- Active = status active/past_due (the month is already paid) and not past the period end (+1 day grace for renewal lag).
create or replace function public.snap_sub_is_active(s public.snap_subs)
returns boolean language sql immutable as $$
  select s.status in ('active', 'past_due')
     and (s.current_period_end is null or s.current_period_end + interval '1 day' > now())
$$;
revoke all on function public.snap_sub_is_active(public.snap_subs) from public, anon, authenticated;

create or replace function public.snap_check_sub(p_email text, p_session text default null)
returns table (active boolean, period_end timestamptz, email text)
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_sess  text := btrim(coalesce(p_session, ''));
  s public.snap_subs;
begin
  if length(v_sess) > 0 then
    -- Proof path: the session id decides; the typed email is ignored.
    if v_sess !~ '^cs_(live|test)_[A-Za-z0-9]{10,200}$' then
      return query select false, null::timestamptz, null::text; return;
    end if;
    select ss.email into v_email from public.snap_sessions ss where ss.session_id = v_sess;
    if v_email is null then
      return query select false, null::timestamptz, null::text; return;
    end if;
  else
    if not exists (select 1 from public.snap_settings st where st.key = 'allow_email_restore' and st.value = 'true')
       or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email) > 254 then
      return query select false, null::timestamptz, null::text; return;
    end if;
  end if;
  select * into s from public.snap_subs b where b.email = v_email;
  if s.email is null or not public.snap_sub_is_active(s) then
    return query select false, null::timestamptz, null::text; return;
  end if;
  return query select true, s.current_period_end, s.email;
end $$;
revoke all on function public.snap_check_sub(text, text) from public;
grant execute on function public.snap_check_sub(text, text) to anon, authenticated, service_role;
