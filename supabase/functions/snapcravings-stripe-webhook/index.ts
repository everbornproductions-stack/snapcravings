// Supabase Edge Function: SnapCravings Stripe webhook -> snap_subs.
// Deploy:  supabase functions deploy snapcravings-stripe-webhook --no-verify-jwt --project-ref ezbpstloczzdlcxwliwu
// Secrets (set in Supabase, never in a file/log):
//   SNAP_STRIPE_WEBHOOK_SECRET   signing secret (whsec_...) of THIS endpoint's Stripe webhook
//   SNAP_PAYMENT_LINK_ID         optional: the Payment Link id (plink_...) as an extra "is this ours" match
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   provided by Supabase to the function
// Stripe events: checkout.session.completed, invoice.paid, invoice.payment_failed,
//   customer.subscription.updated, customer.subscription.deleted, charge.refunded
// Events that are not SnapCravings (other products in the same Stripe account, e.g. Meldmind) are ignored with 200.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyStripeSignature, processEvent } from "./logic.js";

const SECRET = Deno.env.get("SNAP_STRIPE_WEBHOOK_SECRET") ?? "";
const LINK_ID = Deno.env.get("SNAP_PAYMENT_LINK_ID") ?? "";
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const fail = (what: string, error: { code?: string } | null) => { if (error) throw new Error(`${what} failed: ${error.code}`); };
const db = {
  async claimEvent(id: string, type: string) {
    const { error } = await supabase.from("snap_stripe_events").insert({ event_id: id, type });
    if (!error) return true;
    if (error.code === "23505") return false;
    throw new Error(`snap_stripe_events insert failed: ${error.code}`);
  },
  async releaseEvent(id: string) { await supabase.from("snap_stripe_events").delete().eq("event_id", id); },
  async getByEmail(email: string) {
    const { data, error } = await supabase.from("snap_subs").select("*").eq("email", email).maybeSingle(); fail("snap_subs lookup", error); return data;
  },
  async getByStripe({ subscriptionId, customerId }: { subscriptionId?: string | null; customerId?: string | null }) {
    if (subscriptionId) { const { data, error } = await supabase.from("snap_subs").select("*").eq("subscription_id", subscriptionId).limit(1); fail("snap_subs lookup", error); if (data?.[0]) return data[0]; }
    if (customerId) { const { data, error } = await supabase.from("snap_subs").select("*").eq("customer_id", customerId).order("updated_at", { ascending: false }).limit(1); fail("snap_subs lookup", error); if (data?.[0]) return data[0]; }
    return null;
  },
  async upsertSub(row: Record<string, unknown>) { const { error } = await supabase.from("snap_subs").upsert(row, { onConflict: "email" }); fail("snap_subs upsert", error); },
  async updateSub(email: string, patch: Record<string, unknown>) { const { error } = await supabase.from("snap_subs").update(patch).eq("email", email); fail("snap_subs update", error); },
  async putSession(sessionId: string, email: string) { const { error } = await supabase.from("snap_sessions").upsert({ session_id: sessionId, email }, { onConflict: "session_id" }); fail("snap_sessions upsert", error); },
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  if (!SECRET) { console.error("snap-webhook: not configured (set SNAP_STRIPE_WEBHOOK_SECRET); rejecting"); return new Response("not configured", { status: 500 }); }
  const raw = await req.text();
  const sig = await verifyStripeSignature({ secret: SECRET, rawBody: raw, header: req.headers.get("stripe-signature") });
  if (!sig.ok) { console.warn(`snap-webhook: rejected (${sig.reason})`); return new Response("bad signature", { status: 400 }); }
  let event; try { event = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
  try {
    const r = await processEvent(event, db, { paymentLinkId: LINK_ID });
    console.log(`snap-webhook: ${event.type} -> ${r.status}${r.reason ? ` (${r.reason})` : ""}`);
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(`snap-webhook: failed (${(e as Error).message})`);
    return new Response("error", { status: 500 });
  }
});
