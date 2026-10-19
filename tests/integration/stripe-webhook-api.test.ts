import Stripe from "stripe";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createPrismaClient } from "@/lib/db-client";

// Real signature verification from the Stripe SDK (pure crypto, no network); only API calls are mocked.
const WEBHOOK_SECRET = "whsec_test_secret";
const realWebhooks = new Stripe("sk_test_not_a_real_key").webhooks;

const stripeMock = vi.hoisted(() => ({
  configured: true,
  retrieve: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getBillingConfig: () => (stripeMock.configured ? { secretKey: "sk_test_x", webhookSecret: "whsec_test_secret", pricePro: "price_pro" } : null),
  isBillingConfigured: () => stripeMock.configured,
  getStripe: () => ({ webhooks: realWebhooks, subscriptions: { retrieve: stripeMock.retrieve } }),
}));

const { POST } = await import("@/app/api/stripe/webhook/route");

const prisma = createPrismaClient();

const PERIOD_END = 1_795_000_000; // 2026-11-17
let eventSeq = 0;

function subscription(id: string, customer: string, status: Stripe.Subscription.Status, periodEnd = PERIOD_END, metadata: Record<string, string> = {}) {
  return { id, object: "subscription", customer, status, metadata, items: { object: "list", data: [{ id: `si_${id}`, current_period_end: periodEnd }] } };
}

function event(type: string, object: unknown, id = `evt_${++eventSeq}`) {
  return { id, object: "event", type, created: 1_790_000_000 + eventSeq, data: { object } };
}

function signedRequest(payload: unknown, { secret = WEBHOOK_SECRET, signature }: { secret?: string; signature?: string | null } = {}) {
  const body = JSON.stringify(payload);
  const headers = new Headers({ "content-type": "application/json" });
  const header = signature === undefined ? realWebhooks.generateTestHeaderString({ payload: body, secret }) : signature;
  if (header !== null) headers.set("stripe-signature", header);
  return new Request("http://localhost/api/stripe/webhook", { method: "POST", headers, body });
}

const post = (payload: unknown, options?: Parameters<typeof signedRequest>[1]) => POST(signedRequest(payload, options));

async function createDj(data: { stripeCustomerId?: string; stripeSubscriptionId?: string; plan?: "FREE" | "PRO" } = {}) {
  return prisma.user.create({ data: { email: `dj-${Math.random()}@example.com`, passwordHash: "x", displayName: "DJ", ...data } });
}

const billingOf = (id: string) =>
  prisma.user.findUniqueOrThrow({ where: { id }, select: { plan: true, stripeCustomerId: true, stripeSubscriptionId: true, planRenewsAt: true } });

beforeEach(async () => {
  stripeMock.configured = true;
  stripeMock.retrieve.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/stripe/webhook: signature", () => {
  it("400 without the Stripe-Signature header", async () => {
    const res = await post(event("customer.subscription.updated", subscription("sub_1", "cus_1", "active")), { signature: null });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "MISSING_SIGNATURE" });
  });

  it("400 for a signature made with another secret or a garbage header; nothing is applied", async () => {
    const dj = await createDj({ stripeCustomerId: "cus_1" });
    const payload = event("customer.subscription.updated", subscription("sub_1", "cus_1", "active"));
    for (const res of [await post(payload, { secret: "whsec_wrong" }), await post(payload, { signature: "t=1,v1=deadbeef" })]) {
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "INVALID_SIGNATURE" });
    }
    expect(stripeMock.retrieve).not.toHaveBeenCalled();
    expect((await billingOf(dj.id)).plan).toBe("FREE");
  });

  it("400 when the body was changed after signing", async () => {
    const body = JSON.stringify(event("customer.subscription.updated", subscription("sub_1", "cus_1", "active")));
    const signature = realWebhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET });
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": signature }, body: body.replace("active", "trialing") }),
    );
    expect(res.status).toBe(400);
  });

  it("503 while billing is not configured", async () => {
    stripeMock.configured = false;
    const res = await post(event("customer.subscription.updated", subscription("sub_1", "cus_1", "active")));
    expect(res.status).toBe(503);
  });
});

describe("POST /api/stripe/webhook: events", () => {
  it("checkout.session.completed links the customer and subscription to the DJ from client_reference_id and switches to Pro", async () => {
    const dj = await createDj();
    stripeMock.retrieve.mockResolvedValue(subscription("sub_new", "cus_new", "active"));
    const session = { id: "cs_1", object: "checkout.session", mode: "subscription", client_reference_id: dj.id, customer: "cus_new", subscription: "sub_new", metadata: {} };

    const res = await post(event("checkout.session.completed", session));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(stripeMock.retrieve).toHaveBeenCalledWith("sub_new");
    expect(await billingOf(dj.id)).toEqual({
      plan: "PRO",
      stripeCustomerId: "cus_new",
      stripeSubscriptionId: "sub_new",
      planRenewsAt: new Date(PERIOD_END * 1000),
    });
  });

  it("checkout.session.completed falls back to metadata.userId; a payment-mode session is ignored", async () => {
    const dj = await createDj();
    stripeMock.retrieve.mockResolvedValue(subscription("sub_m", "cus_m", "trialing"));
    await post(event("checkout.session.completed", { id: "cs_2", object: "checkout.session", mode: "subscription", client_reference_id: null, customer: "cus_m", subscription: "sub_m", metadata: { userId: dj.id } }));
    expect((await billingOf(dj.id)).plan).toBe("PRO");

    stripeMock.retrieve.mockClear();
    const res = await post(event("checkout.session.completed", { id: "cs_3", object: "checkout.session", mode: "payment", client_reference_id: dj.id, customer: "cus_m", subscription: null, metadata: {} }));
    expect(res.status).toBe(200);
    expect(stripeMock.retrieve).not.toHaveBeenCalled();
  });

  it("is idempotent: the same checkout event delivered twice ends in the same state", async () => {
    const dj = await createDj();
    stripeMock.retrieve.mockResolvedValue(subscription("sub_i", "cus_i", "active"));
    const payload = event("checkout.session.completed", { id: "cs_i", object: "checkout.session", mode: "subscription", client_reference_id: dj.id, customer: "cus_i", subscription: "sub_i", metadata: {} });

    expect((await post(payload)).status).toBe(200);
    const first = await billingOf(dj.id);
    expect((await post(payload)).status).toBe(200);
    expect(await billingOf(dj.id)).toEqual(first);
    expect(await prisma.user.count()).toBe(1);
  });

  it("customer.subscription.updated: active/trialing → Pro with the new renewal date (found by stripeCustomerId)", async () => {
    const dj = await createDj({ stripeCustomerId: "cus_u" });
    const renewed = PERIOD_END + 30 * 86_400;
    stripeMock.retrieve.mockResolvedValue(subscription("sub_u", "cus_u", "active", renewed));
    const res = await post(event("customer.subscription.updated", subscription("sub_u", "cus_u", "active", renewed)));
    expect(res.status).toBe(200);
    expect(stripeMock.retrieve).toHaveBeenCalledWith("sub_u");
    expect(await billingOf(dj.id)).toMatchObject({ plan: "PRO", stripeSubscriptionId: "sub_u", planRenewsAt: new Date(renewed * 1000) });
  });

  it("customer.subscription.updated: past_due keeps Pro (Stripe is still retrying the payment)", async () => {
    const dj = await createDj({ stripeCustomerId: "cus_p", stripeSubscriptionId: "sub_p", plan: "PRO" });
    stripeMock.retrieve.mockResolvedValue(subscription("sub_p", "cus_p", "past_due"));
    await post(event("customer.subscription.updated", subscription("sub_p", "cus_p", "past_due")));
    expect((await billingOf(dj.id)).plan).toBe("PRO");
  });

  it.each(["canceled", "unpaid", "incomplete_expired"] as const)("customer.subscription.updated: %s → Free, subscription cleared", async (status) => {
    const dj = await createDj({ stripeCustomerId: "cus_c", stripeSubscriptionId: "sub_c", plan: "PRO" });
    stripeMock.retrieve.mockResolvedValue(subscription("sub_c", "cus_c", status));
    await post(event("customer.subscription.updated", subscription("sub_c", "cus_c", status)));
    expect(await billingOf(dj.id)).toEqual({ plan: "FREE", stripeCustomerId: "cus_c", stripeSubscriptionId: null, planRenewsAt: null });
  });

  it("out of order: an older 'updated' payload arriving late does not override the current state retrieved from Stripe", async () => {
    const dj = await createDj({ stripeCustomerId: "cus_o", stripeSubscriptionId: "sub_o", plan: "PRO" });
    // The late event still says "incomplete", but Stripe now has the subscription active.
    stripeMock.retrieve.mockResolvedValue(subscription("sub_o", "cus_o", "active"));
    await post(event("customer.subscription.updated", subscription("sub_o", "cus_o", "incomplete")));
    expect(await billingOf(dj.id)).toMatchObject({ plan: "PRO", stripeSubscriptionId: "sub_o" });
  });

  it("customer.subscription.deleted → Free and the subscription id is cleared (applied twice: same result)", async () => {
    const dj = await createDj({ stripeCustomerId: "cus_d", stripeSubscriptionId: "sub_d", plan: "PRO" });
    const payload = event("customer.subscription.deleted", subscription("sub_d", "cus_d", "canceled"));
    for (let i = 0; i < 2; i++) {
      expect((await post(payload)).status).toBe(200);
      expect(await billingOf(dj.id)).toEqual({ plan: "FREE", stripeCustomerId: "cus_d", stripeSubscriptionId: null, planRenewsAt: null });
    }
    expect(stripeMock.retrieve).not.toHaveBeenCalled();
  });

  it("the deletion of an old subscription does not downgrade a DJ who already has a newer active one", async () => {
    const dj = await createDj({ stripeCustomerId: "cus_s", stripeSubscriptionId: "sub_current", plan: "PRO" });
    const res = await post(event("customer.subscription.deleted", subscription("sub_old", "cus_s", "canceled")));
    expect(res.status).toBe(200);
    expect(await billingOf(dj.id)).toMatchObject({ plan: "PRO", stripeSubscriptionId: "sub_current" });
  });

  it("an event for another customer only changes that customer's DJ", async () => {
    const mine = await createDj({ stripeCustomerId: "cus_mine" });
    const other = await createDj({ stripeCustomerId: "cus_other" });
    stripeMock.retrieve.mockResolvedValue(subscription("sub_x", "cus_other", "active"));
    await post(event("customer.subscription.updated", subscription("sub_x", "cus_other", "active")));
    expect((await billingOf(mine.id)).plan).toBe("FREE");
    expect((await billingOf(other.id)).plan).toBe("PRO");
  });

  it("an unknown customer is acknowledged (200) without changes", async () => {
    const dj = await createDj();
    stripeMock.retrieve.mockResolvedValue(subscription("sub_z", "cus_unknown", "active"));
    const res = await post(event("customer.subscription.updated", subscription("sub_z", "cus_unknown", "active")));
    expect(res.status).toBe(200);
    expect((await billingOf(dj.id)).plan).toBe("FREE");
  });

  it("unknown event types are acknowledged with 200 and ignored", async () => {
    const dj = await createDj({ stripeCustomerId: "cus_e" });
    const res = await post(event("invoice.paid", { id: "in_1", object: "invoice", customer: "cus_e" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(stripeMock.retrieve).not.toHaveBeenCalled();
    expect((await billingOf(dj.id)).plan).toBe("FREE");
  });

  it("500 without internal details when processing fails, so Stripe retries", async () => {
    await createDj({ stripeCustomerId: "cus_f" });
    stripeMock.retrieve.mockRejectedValue(new Error("Stripe API down: secret details"));
    const res = await post(event("customer.subscription.updated", subscription("sub_f", "cus_f", "active")));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "WEBHOOK_FAILED" });
    expect(text).not.toContain("secret details");
    expect(console.error).toHaveBeenCalled();
  });
});
