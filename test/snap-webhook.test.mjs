import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyStripeSignature, computeStripeSignature, processEvent, planEvent } from '../supabase/functions/snapcravings-stripe-webhook/logic.js';

function mem() {
  const subs = new Map(), sessions = new Map(), events = new Set();
  return { subs, sessions, events,
    async claimEvent(id) { if (events.has(id)) return false; events.add(id); return true; },
    async releaseEvent(id) { events.delete(id); },
    async getByEmail(e) { return subs.get(e) ?? null; },
    async getByStripe({ subscriptionId, customerId }) { return [...subs.values()].find(r => (subscriptionId && r.subscription_id === subscriptionId)) ?? [...subs.values()].find(r => customerId && r.customer_id === customerId) ?? null; },
    async upsertSub(r) { subs.set(r.email, { ...(subs.get(r.email) || {}), ...r }); },
    async updateSub(e, p) { subs.set(e, { ...subs.get(e), ...p }); },
    async putSession(s, e) { sessions.set(s, e); } };
}
const sess = (o = {}) => ({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { object: 'checkout.session', id: 'cs_live_a1B2c3D4e5F6', mode: 'subscription', payment_status: 'paid', customer: 'cus_1', subscription: 'sub_1', customer_details: { email: 'Bob@Example.com' }, metadata: { app: 'snapcravings' }, ...o } } });
const inv = (type, o = {}, id = 'evt_2') => ({ id, type, data: { object: { object: 'invoice', subscription: 'sub_1', customer: 'cus_1', customer_email: 'bob@example.com', subscription_details: { metadata: { app: 'snapcravings' } }, lines: { data: [{ period: { end: 1900000000 } }] }, ...o } } });
const subEv = (type, o = {}, id = 'evt_3') => ({ id, type, data: { object: { id: 'sub_1', customer: 'cus_1', status: 'active', metadata: { app: 'snapcravings' }, items: { data: [{ current_period_end: 1900000000 }] }, ...o } } });

test('signature', async () => {
  const body = '{"a":1}', t = 1700000000, sig = await computeStripeSignature({ secret: 'whsec_x', timestamp: t, rawBody: body });
  assert.equal((await verifyStripeSignature({ secret: 'whsec_x', rawBody: body, header: `t=${t},v1=${sig}`, now: t + 10 })).ok, true);
  assert.equal((await verifyStripeSignature({ secret: 'whsec_x', rawBody: body + ' ', header: `t=${t},v1=${sig}`, now: t })).ok, false);
  assert.equal((await verifyStripeSignature({ secret: 'whsec_x', rawBody: body, header: `t=${t},v1=${sig}`, now: t + 999 })).reason, 'timestamp_out_of_range');
  assert.equal((await verifyStripeSignature({ secret: '', rawBody: body, header: 'x' })).ok, false);
  assert.equal((await verifyStripeSignature({ secret: 'whsec_x', rawBody: body, header: null })).ok, false);
});
test('full lifecycle', async () => {
  const db = mem();
  assert.equal((await processEvent(sess(), db)).status, 'recorded');
  assert.equal(db.sessions.get('cs_live_a1B2c3D4e5F6'), 'bob@example.com');
  assert.equal(db.subs.get('bob@example.com').status, 'active');
  assert.equal((await processEvent(sess(), db)).status, 'duplicate');
  await processEvent(inv('invoice.paid'), db);
  assert.equal(db.subs.get('bob@example.com').current_period_end, new Date(1900000000e3).toISOString());
  await processEvent(inv('invoice.payment_failed', {}, 'evt_f'), db);
  assert.equal(db.subs.get('bob@example.com').status, 'past_due');
  await processEvent(inv('invoice.paid', {}, 'evt_p2'), db);
  await processEvent(subEv('customer.subscription.updated', { cancel_at_period_end: true }), db);
  assert.equal(db.subs.get('bob@example.com').status, 'active'); assert.equal(db.subs.get('bob@example.com').cancel_at_period_end, true);
  await processEvent(subEv('customer.subscription.deleted', { status: 'canceled' }, 'evt_d'), db);
  assert.equal(db.subs.get('bob@example.com').status, 'canceled');
  await processEvent({ ...sess({ id: 'cs_live_zzzzzzzzzzzz', subscription: 'sub_2' }), id: 'evt_re' }, db); // resubscribe
  assert.equal(db.subs.get('bob@example.com').status, 'active');
});
test('refund ends access, only for known customers', async () => {
  const db = mem(); await processEvent(sess(), db);
  assert.equal((await processEvent({ id: 'e9', type: 'charge.refunded', data: { object: { customer: 'cus_other', refunded: true } } }, db)).reason, 'not_ours');
  assert.equal((await processEvent({ id: 'e10', type: 'charge.refunded', data: { object: { customer: 'cus_1', refunded: true } } }, db)).status, 'ended');
  assert.equal(db.subs.get('bob@example.com').status, 'refunded');
  assert.equal((await processEvent({ id: 'e11', type: 'charge.refunded', data: { object: { customer: 'cus_1', amount: 499, amount_refunded: 100 } } }, db)).reason, 'partial_refund');
});
test('other products are ignored; invoice before checkout', async () => {
  const db = mem();
  for (const e of [sess({ metadata: {}, amount_subtotal: 1899 }), inv('invoice.paid', { subscription_details: { metadata: {} } }), subEv('customer.subscription.deleted', { metadata: {} })]) assert.equal((await processEvent(e, db)).status, 'ignored');
  assert.equal(db.subs.size, 0);
  assert.equal((await processEvent(sess({ metadata: {}, amount_subtotal: 499, currency: 'usd' }), mem())).status, 'recorded'); // price fallback
  assert.equal((await processEvent(sess({ metadata: {}, payment_link: 'plink_1' }), mem(), { paymentLinkId: 'plink_1' })).status, 'recorded');
  assert.equal((await processEvent(inv('invoice.paid'), db)).status, 'recorded'); // invoice first
  assert.equal(db.subs.get('bob@example.com').status, 'active');
  assert.equal(planEvent({ type: 'customer.created', data: { object: {} } }).kind, 'ignore');
});
test('old subscription deletion does not end a newer one', async () => {
  const db = mem(); await processEvent(sess({ subscription: 'sub_new' }), db);
  const r = await processEvent(subEv('customer.subscription.deleted', { id: 'sub_old' }, 'e5'), db);
  assert.equal(r.reason, 'older_subscription');
  assert.equal(db.subs.get('bob@example.com').status, 'active');
});

const PRICE = 'price_1UV1Nv6wphxe2c5DdlBKSCId', PROD = 'prod_VW3Um2yJoNikOC', PLINK = 'plink_1UV1Pz6wphxe2c5DKeNKdWOL';
test('matches by hardcoded price / product / payment link id when metadata is missing', async () => {
  const noMeta = { metadata: {}, subscription_details: { metadata: {} } };
  assert.equal((await processEvent(sess({ metadata: {}, payment_link: PLINK, amount_subtotal: 1 }), mem())).status, 'recorded');
  assert.equal((await processEvent(sess({ metadata: {}, payment_link: { id: PLINK }, amount_subtotal: 1 }), mem())).status, 'recorded');
  for (const lines of [
    { data: [{ price: { id: PRICE }, period: { end: 1900000000 } }] },
    { data: [{ price: { id: 'price_x', product: PROD }, period: { end: 1900000000 } }] },
    { data: [{ pricing: { price_details: { price: PRICE, product: 'prod_zzz' } }, period: { end: 1900000000 } }] },
    { data: [{ pricing: { price_details: { price: 'price_y', product: PROD } }, period: { end: 1900000000 } }] }]) {
    const db = mem(); await processEvent(sess(), db);
    db.subs.get('bob@example.com').current_period_end = null;
    assert.equal((await processEvent(inv('invoice.paid', { ...noMeta, lines }), db)).status, 'updated');
    assert.equal(db.subs.get('bob@example.com').current_period_end, new Date(1900000000e3).toISOString());
  }
  for (const items of [{ data: [{ price: { id: PRICE, product: PROD }, current_period_end: 1900000000 }] }, { data: [{ price: { id: 'p', product: { id: PROD } } }] }]) {
    const db = mem(); await processEvent(sess(), db);
    assert.equal((await processEvent(subEv('customer.subscription.deleted', { metadata: {}, items }, 'e_del'), db)).status, 'updated');
    assert.equal(db.subs.get('bob@example.com').status, 'canceled');
  }
  // a different price / product (e.g. Meldmind) is still ignored
  assert.equal((await processEvent(inv('invoice.paid', { ...noMeta, lines: { data: [{ price: { id: 'price_meld', product: 'prod_meld', unit_amount: 1899, recurring: { interval: 'month' } } }] } }), mem())).status, 'ignored');
  assert.equal((await processEvent(subEv('customer.subscription.updated', { metadata: {}, items: { data: [{ price: { id: 'price_meld', product: 'prod_meld' } }] } }), mem())).status, 'ignored');
});
