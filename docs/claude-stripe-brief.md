# Brief for PC Claude: SnapCravings Unlimited on Stripe (live "Everborn marketing")

Chris approved this. You are signed in to Stripe (live, account "Everborn marketing") in Chrome. Never paste a secret, key, or signing secret into chat. Do not touch any existing Meldmind product, link, or webhook.

## A. Stripe
1. Products > Add product: name **SnapCravings Unlimited**, recurring **$4.99 USD / month**. Add product metadata `app` = `snapcravings` (and the same metadata on the price if the form offers it).
2. Payment Links > New, with that price (quantity 1, no quantity adjusting, card payments, collect email only; no shipping/phone needed).
   - After payment > "Don't show confirmation page" > redirect to: `https://snapcravings.pages.dev/?paid=1&sid={CHECKOUT_SESSION_ID}#pro`  (keep the braces exactly; Stripe fills the id in)
   - Subscription metadata (under "Subscriptions" / advanced options): `app` = `snapcravings`. Also add Payment Link metadata `app` = `snapcravings`.
   - Create it. Copy the link URL (`https://buy.stripe.com/...`) and the link id (`plink_...`, in the link's details/URL in the dashboard).
3. Developers > Webhooks > Add destination/endpoint (Your account, API version default):
   - Endpoint URL: `https://ezbpstloczzdlcxwliwu.supabase.co/functions/v1/snapcravings-stripe-webhook`
   - Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`.
   - Reveal the signing secret (`whsec_...`) ONLY to paste it into Supabase (step B). Never print it in chat.
4. Settings > Billing > Customer portal: activate. Allow "Cancel subscriptions" with **cancel at end of billing period**; leave plan switching off; allow updating payment method and viewing invoices. Save. Copy the portal **login link** (`https://billing.stripe.com/p/login/...`) shown on that page.

## B. Supabase (project everborn-command, ref ezbpstloczzdlcxwliwu), only if you are signed in to the Supabase dashboard
5. Edge Functions > Secrets (Project Settings > Edge Functions): add `SNAP_STRIPE_WEBHOOK_SECRET` = the whsec from step 3, and (optional) `SNAP_PAYMENT_LINK_ID` = the `plink_...` id. Do not echo values.
   The function itself and the SQL migration are prepared in `/workspace/craving-app/supabase/` on the box (migration `20261026_snapcravings_subs.sql`, function `functions/snapcravings-stripe-webhook/{index.ts,logic.js}`). If the parent gives you that SQL, run it once in SQL editor; if the parent gives you the function files, deploy via Edge Functions > Deploy a new function (name `snapcravings-stripe-webhook`, **turn OFF "Verify JWT"**). If you were not given them, skip and say so.

## C. Report back (no secrets)
- Payment Link URL (`https://buy.stripe.com/...`) and its `plink_` id
- Customer portal login URL (`https://billing.stripe.com/p/login/...`)
- Webhook endpoint created (yes/no), the 6 events selected, and whether `SNAP_STRIPE_WEBHOOK_SECRET` was set in Supabase (yes/no, never the value)
- In Stripe's webhook page, "Send test webhook" `invoice.paid` is optional; a real $4.99 test is NOT needed. Do not make any purchases.
