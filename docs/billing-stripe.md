# SnapCravings billing (Stripe, "the Meldmind way")

No Stripe secret key anywhere, no new Cloudflare env vars. Pieces:
1. Stripe Payment Link (SnapCravings Unlimited, $4.99/mo) opened by the app: `?prefilled_email=&client_reference_id=`. After payment Stripe redirects to `/?paid=1&sid={CHECKOUT_SESSION_ID}#pro`.
2. Supabase Edge Function `snapcravings-stripe-webhook` (verify JWT off): verifies `Stripe-Signature` (HMAC-SHA256, 5 min tolerance) with `SNAP_STRIPE_WEBHOOK_SECRET`, dedupes in `snap_stripe_events`, handles `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated|deleted`, `charge.refunded`. Acts only on SnapCravings objects (metadata `app=snapcravings`, or `SNAP_PAYMENT_LINK_ID`, or a $4.99/month price); everything else (e.g. Meldmind) returns 200 and is ignored.
3. Migration `supabase/migrations/20261026_snapcravings_subs.sql`: `snap_subs`, `snap_sessions`, `snap_stripe_events`, `snap_settings` (RLS on, no public access) and RPC `snap_check_sub(p_email, p_session)` (SECURITY DEFINER, anon-callable, returns `{active, period_end, email}`).
4. Cloudflare Pages `/api/sub/status` calls the RPC with the public publishable key (constant in `functions/_lib/sub.js`) and, when active, issues the signed unlock token (SUB_SECRET) valid through the paid period (max 35 days).
5. Cancel = Stripe customer portal login link (`PORTAL_URL`).

## Going live checklist
1. Apply the migration (Supabase SQL editor or `supabase db push`).
2. `supabase functions deploy snapcravings-stripe-webhook --no-verify-jwt --project-ref ezbpstloczzdlcxwliwu`
3. Stripe: create product/link/webhook/portal (see `docs/claude-stripe-brief.md`); set function secret `SNAP_STRIPE_WEBHOOK_SECRET` (and optionally `SNAP_PAYMENT_LINK_ID`).
4. Fill `PAYMENT_LINK_URL` and `PORTAL_URL` in `functions/_lib/sub.js`, bump cache version, deploy: `npx wrangler pages deploy web --project-name snapcravings --branch main`. Until `PAYMENT_LINK_URL` is set the app shows "Unlimited is coming soon" and free scans + owner code keep working.

## Proof tradeoff
With a Checkout Session id (kept from the post-payment redirect) the RPC looks up by session and ignores the typed email. "Restore purchase" on a new device has only an email, so `snap_settings.allow_email_restore='true'` (default) lets an email alone answer active/not-active for that email. Risk: someone who guesses a subscriber's email unlocks scans on their own device for at most the remaining paid period (token is capped to the period). Close it with `update public.snap_settings set value='false' where key='allow_email_restore';`. Misses always return the same `{active:false}`.

## Notes
- The Meldmind `stripe-webhook` endpoint in the same Stripe account also receives these events but ignores them (no matching price/plan). A full refund on a charge for a customer who is also a SnapCravings customer ends Snap access (edge case, accepted).
- Tests: `node --test test/` (webhook logic). The SQL was exercised against a real Postgres (PGlite): idempotent re-run, anon cannot read tables, RPC cases.

## Usage stats (privacy-light)
- Migration `supabase/migrations/20261026_snapcravings_events.sql` (run AFTER `20261026_snapcravings_subs.sql`): `snap_events` (RLS on, no public access), RPC `snap_log_event` (anon, validated + rate limited), RPC `snap_stats(p_key, p_days)` (aggregates only with the stats key). `snap_settings.stats_key` stores the SHA-256 of the key, never the key. The key is in `STATS_KEY.txt` (gitignored).
- App: `track()` in `web/app.js` sends events with `navigator.sendBeacon` to `/api/ev`, which hashes the anonymous device id (salted SHA-256) before calling the RPC. Events: page_view, scan, recipes_shown, more_ideas, favorite, upgrade_click, checkout_return, diet_saved, install, each tagged plan free|paid|owner. Respects Do Not Track. While the RPCs are missing, `/api/ev` is a silent no-op and `/api/stats` answers 503.
- Dashboard: `/stats.html` (noindex, not linked). Asks for the key once (localStorage), calls `/api/stats`.
- Test: `node supabase/tests/snap-events.pglite.mjs` (needs `@electric-sql/pglite`).
