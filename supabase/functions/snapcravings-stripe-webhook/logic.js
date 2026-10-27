// Pure logic for the SnapCravings Stripe webhook (shared by the Deno edge function and Node tests).
// Web-standard APIs only. Secrets are passed in by the caller; nothing here logs an email or stores card data.
export const TOLERANCE_SECONDS = 300;
export const APP = "snapcravings";
export const PRICE_CENTS = 499;

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
export async function computeStripeSignature({ secret, timestamp, rawBody }) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${rawBody}`))));
}
export function timingSafeEqual(a, b) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
export function parseSignatureHeader(header) {
  const out = { t: NaN, v1: [] };
  for (const part of String(header ?? "").split(",")) {
    const i = part.indexOf("="); if (i < 1) continue;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === "t") out.t = Number(v); else if (k === "v1" && v) out.v1.push(v);
  }
  return Number.isInteger(out.t) && out.t > 0 && out.v1.length ? out : null;
}
export async function verifyStripeSignature({ secret, rawBody, header, now = Math.floor(Date.now() / 1000), toleranceSeconds = TOLERANCE_SECONDS }) {
  if (!secret) return { ok: false, reason: "not_configured" };
  if (!header) return { ok: false, reason: "missing_signature" };
  const p = parseSignatureHeader(header);
  if (!p) return { ok: false, reason: "bad_header" };
  if (Math.abs(now - p.t) > toleranceSeconds) return { ok: false, reason: "timestamp_out_of_range" };
  const expected = await computeStripeSignature({ secret, timestamp: p.t, rawBody: rawBody ?? "" });
  return p.v1.some((s) => timingSafeEqual(expected, s)) ? { ok: true, timestamp: p.t } : { ok: false, reason: "bad_signature" };
}

const iso = (sec) => (Number.isFinite(Number(sec)) && Number(sec) > 0 ? new Date(Number(sec) * 1000).toISOString() : null);
const email = (v) => { const s = String(v ?? "").trim().toLowerCase(); return s && s.includes("@") && s.length <= 254 ? s : null; };
const idOf = (v) => (typeof v === "string" ? v : v?.id ?? null);

export function mapSubscriptionStatus(status) {
  switch (String(status ?? "").toLowerCase()) {
    case "active": case "trialing": return "active";
    case "past_due": case "unpaid": case "paused": return "past_due";
    case "incomplete": return "pending";
    default: return "canceled";
  }
}

// Is this object ours? metadata app=snapcravings, or the configured Payment Link id, or a $4.99 monthly price.
export function isSnap(obj, { paymentLinkId = "" } = {}) {
  const metas = [obj?.metadata, obj?.subscription_details?.metadata, obj?.parent?.subscription_details?.metadata,
    obj?.lines?.data?.[0]?.metadata, obj?.items?.data?.[0]?.metadata, obj?.items?.data?.[0]?.price?.metadata];
  if (metas.some((m) => String(m?.app ?? "").toLowerCase() === APP)) return true;
  if (paymentLinkId && idOf(obj?.payment_link) === paymentLinkId) return true;
  const price = obj?.items?.data?.[0]?.price ?? obj?.lines?.data?.[0]?.price ?? obj?.lines?.data?.[0]?.pricing?.price_details;
  const plan = obj?.plan ?? obj?.items?.data?.[0]?.plan ?? obj?.lines?.data?.[0]?.plan;
  const amt = price?.unit_amount ?? plan?.amount ?? (obj?.object === "invoice" && Number(obj?.lines?.data?.[0]?.pricing?.unit_amount_decimal) === PRICE_CENTS ? PRICE_CENTS : undefined), iv = price?.recurring?.interval ?? plan?.interval ?? (obj?.object === "invoice" ? "month" : undefined);
  if (Number.isInteger(amt) && amt === PRICE_CENTS && iv === "month") return true;
  // Checkout session: a $4.99 subscription session (list price, before any promo code).
  if (obj?.object === "checkout.session" && obj.mode === "subscription" && obj.amount_subtotal === PRICE_CENTS && String(obj.currency).toLowerCase() === "usd") return true;
  return false;
}

// event -> { kind: "ignore", reason } | { kind: "session", ... } | { kind: "sub", ... } | { kind: "end", ... }
export function planEvent(event, opts = {}) {
  const type = event?.type, obj = event?.data?.object;
  if (!type || !obj) return { kind: "ignore", reason: "no_object" };

  if (type === "checkout.session.completed") {
    if (!isSnap(obj, opts)) return { kind: "ignore", reason: "not_snapcravings" };
    if (obj.mode !== "subscription") return { kind: "ignore", reason: "mode" };
    const paid = obj.payment_status === "paid" || obj.payment_status === "no_payment_required";
    if (!paid) return { kind: "ignore", reason: "not_paid" };
    const e = email(obj.customer_details?.email ?? obj.customer_email);
    if (!e || !/^cs_(live|test)_[A-Za-z0-9]+$/.test(String(obj.id))) return { kind: "ignore", reason: "no_email_or_session" };
    // Period end is provisional (invoice.paid sets the real one right after).
    return { kind: "session", sessionId: obj.id, email: e, customerId: idOf(obj.customer), subscriptionId: idOf(obj.subscription), status: "active", periodEnd: new Date((opts.nowMs ?? Date.now()) + 33 * 864e5).toISOString() };
  }

  if (type === "invoice.paid" || type === "invoice.payment_failed") {
    const subscriptionId = idOf(obj.subscription) ?? idOf(obj.parent?.subscription_details?.subscription) ?? idOf(obj.lines?.data?.[0]?.subscription);
    if (!subscriptionId) return { kind: "ignore", reason: "not_a_subscription" };
    if (!isSnap(obj, opts)) return { kind: "ignore", reason: "not_snapcravings" };
    const line = obj.lines?.data?.[0];
    const paid = type === "invoice.paid";
    return { kind: "sub", email: email(obj.customer_email), customerId: idOf(obj.customer), subscriptionId,
      status: paid ? "active" : "past_due", periodEnd: paid ? iso(line?.period?.end ?? obj.period_end) : undefined };
  }

  if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
    if (!isSnap(obj, opts)) return { kind: "ignore", reason: "not_snapcravings" };
    const item = obj.items?.data?.[0];
    const deleted = type === "customer.subscription.deleted";
    return { kind: "sub", email: null, customerId: idOf(obj.customer), subscriptionId: idOf(obj.id),
      status: deleted ? "canceled" : mapSubscriptionStatus(obj.status), periodEnd: iso(item?.current_period_end ?? obj.current_period_end),
      cancelAtPeriodEnd: !deleted && (obj.cancel_at_period_end === true || !!obj.cancel_at) };
  }

  if (type === "charge.refunded") {
    const full = obj.refunded === true || (Number.isInteger(obj.amount) && Number.isInteger(obj.amount_refunded) && obj.amount > 0 && obj.amount_refunded >= obj.amount);
    if (!full) return { kind: "ignore", reason: "partial_refund" };
    // A charge carries no app metadata: only act when the customer is one of ours (checked in apply).
    return { kind: "end", customerId: idOf(obj.customer), email: email(obj.billing_details?.email ?? obj.receipt_email) };
  }
  return { kind: "ignore", reason: "event_type" };
}

// db: claimEvent(id,type)->bool, releaseEvent(id), getByEmail(e), getByStripe({subscriptionId,customerId}),
//     upsertSub(row), updateSub(email, patch), putSession(sessionId,email)
export async function processEvent(event, db, opts = {}) {
  const act = planEvent(event, opts);
  if (act.kind === "ignore") return { status: "ignored", reason: act.reason };
  if (!event.id) return { status: "ignored", reason: "no_event_id" };
  if (!(await db.claimEvent(event.id, event.type))) return { status: "duplicate" };
  try { return await apply(act, db); } catch (e) { await db.releaseEvent(event.id).catch(() => {}); throw e; }
}

async function apply(act, db) {
  const now = new Date().toISOString();
  if (act.kind === "session") {
    await db.putSession(act.sessionId, act.email);
    const ex = await db.getByEmail(act.email);
    // Do not shorten a real period end already recorded by an earlier invoice.paid.
    const keepEnd = ex && ex.subscription_id === act.subscriptionId && ex.current_period_end && new Date(ex.current_period_end) > new Date(act.periodEnd) ? ex.current_period_end : act.periodEnd;
    await db.upsertSub({ email: act.email, status: "active", customer_id: act.customerId, subscription_id: act.subscriptionId, current_period_end: keepEnd, cancel_at_period_end: false, updated_at: now });
    return { status: "recorded" };
  }
  if (act.kind === "sub") {
    let row = await db.getByStripe({ subscriptionId: act.subscriptionId, customerId: act.customerId });
    if (!row && act.email) row = await db.getByEmail(act.email);
    if (!row) {
      if (act.email && act.status === "active") { // invoice.paid arrived before checkout.session.completed
        await db.upsertSub({ email: act.email, status: "active", customer_id: act.customerId, subscription_id: act.subscriptionId, current_period_end: act.periodEnd ?? null, cancel_at_period_end: false, updated_at: now });
        return { status: "recorded" };
      }
      return { status: "no_row", reason: "wait_for_checkout" };
    }
    // An old subscription's deletion must not end a newer one on the same email.
    if (act.subscriptionId && row.subscription_id && row.subscription_id !== act.subscriptionId) {
      if (act.status === "canceled" || act.status === "past_due") return { status: "skipped", reason: "older_subscription" };
    }
    const patch = { status: act.status, updated_at: now, subscription_id: act.subscriptionId ?? row.subscription_id };
    if (act.customerId) patch.customer_id = act.customerId;
    if (act.periodEnd) patch.current_period_end = act.periodEnd;
    if (typeof act.cancelAtPeriodEnd === "boolean") patch.cancel_at_period_end = act.cancelAtPeriodEnd;
    // A deleted subscription ends access now; a cancel set for period end stays active (status active) until deleted fires.
    if (act.status === "canceled") patch.current_period_end = now;
    await db.updateSub(row.email, patch);
    return { status: "updated", subStatus: act.status };
  }
  if (act.kind === "end") {
    const row = await db.getByStripe({ customerId: act.customerId });
    if (!row) return { status: "no_row", reason: "not_ours" };
    await db.updateSub(row.email, { status: "refunded", current_period_end: now, updated_at: now });
    return { status: "ended" };
  }
  return { status: "ignored", reason: "kind" };
}
