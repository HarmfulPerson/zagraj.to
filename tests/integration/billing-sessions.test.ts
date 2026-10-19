import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentDj } from "@/lib/auth";
import { createPrismaClient } from "@/lib/db-client";

// The session cookie and next/navigation only exist inside a Next.js request: requireDj and redirect are mocked.
const mocks = vi.hoisted(() => ({
  currentDj: null as CurrentDj | null,
  configured: true,
  customersCreate: vi.fn(),
  checkoutCreate: vi.fn(),
  portalCreate: vi.fn(),
}));

class RedirectError extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));
vi.mock("@/lib/auth", () => ({
  requireDj: async () => {
    if (!mocks.currentDj) throw new RedirectError("/logowanie");
    return mocks.currentDj;
  },
}));
vi.mock("@/lib/stripe", () => ({
  getBillingConfig: () => (mocks.configured ? { secretKey: "sk_test_x", webhookSecret: "whsec_x", pricePro: "price_pro_25" } : null),
  isBillingConfigured: () => mocks.configured,
  getStripe: () => ({
    customers: { create: mocks.customersCreate },
    checkout: { sessions: { create: mocks.checkoutCreate } },
    billingPortal: { sessions: { create: mocks.portalCreate } },
  }),
}));

const { startCheckoutAction, openPortalAction } = await import("@/app/panel/billing-actions");

const prisma = createPrismaClient();

async function createDj(data: { stripeCustomerId?: string; plan?: "FREE" | "PRO" } = {}): Promise<CurrentDj> {
  const user = await prisma.user.create({ data: { email: `dj-${Math.random()}@example.com`, passwordHash: "x", displayName: "DJ", ...data } });
  return { id: user.id, email: user.email, displayName: user.displayName, plan: user.plan };
}

async function redirectOf(action: () => Promise<void>): Promise<string> {
  const error = await action().then(
    () => null,
    (e: unknown) => e,
  );
  if (!(error instanceof RedirectError)) throw new Error(`expected a redirect, got ${String(error)}`);
  return error.url;
}

beforeEach(async () => {
  mocks.currentDj = null;
  mocks.configured = true;
  mocks.customersCreate.mockReset().mockResolvedValue({ id: "cus_created" });
  mocks.checkoutCreate.mockReset().mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_test_1" });
  mocks.portalCreate.mockReset().mockResolvedValue({ url: "https://billing.stripe.com/p/session/test_1" });
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://zagrajto.example");
  vi.spyOn(console, "error").mockImplementation(() => {});
  await prisma.user.deleteMany();
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.$disconnect();
});

describe("startCheckoutAction (Przejdź na Pro)", () => {
  it("requires a logged-in DJ: redirects to /logowanie and never calls Stripe", async () => {
    expect(await redirectOf(startCheckoutAction)).toBe("/logowanie");
    expect(mocks.checkoutCreate).not.toHaveBeenCalled();
  });

  it("creates a Stripe customer (email + metadata.userId), saves it and redirects to a subscription Checkout in Polish", async () => {
    const dj = await createDj();
    mocks.currentDj = dj;

    expect(await redirectOf(startCheckoutAction)).toBe("https://checkout.stripe.com/c/pay/cs_test_1");
    expect(mocks.customersCreate).toHaveBeenCalledWith({ email: dj.email, metadata: { userId: dj.id } });
    expect(mocks.checkoutCreate).toHaveBeenCalledWith({
      mode: "subscription",
      customer: "cus_created",
      client_reference_id: dj.id,
      metadata: { userId: dj.id },
      subscription_data: { metadata: { userId: dj.id } },
      line_items: [{ price: "price_pro_25", quantity: 1 }],
      success_url: "https://zagrajto.example/panel/subskrypcja?status=success",
      cancel_url: "https://zagrajto.example/panel/subskrypcja?status=cancel",
      locale: "pl",
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: dj.id } })).stripeCustomerId).toBe("cus_created");
  });

  it("reuses the stored Stripe customer", async () => {
    mocks.currentDj = await createDj({ stripeCustomerId: "cus_existing" });
    await redirectOf(startCheckoutAction);
    expect(mocks.customersCreate).not.toHaveBeenCalled();
    expect(mocks.checkoutCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_existing" }));
  });

  it("acts only on the logged-in DJ's own account", async () => {
    const other = await createDj({ stripeCustomerId: "cus_other" });
    const me = await createDj();
    mocks.currentDj = me;
    await redirectOf(startCheckoutAction);
    expect(mocks.checkoutCreate).toHaveBeenCalledWith(expect.objectContaining({ client_reference_id: me.id, customer: "cus_created" }));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).stripeCustomerId).toBe("cus_other");
  });

  it("a Pro DJ is sent back to the page instead of a second Checkout", async () => {
    mocks.currentDj = await createDj({ plan: "PRO" });
    expect(await redirectOf(startCheckoutAction)).toBe("/panel/subskrypcja");
    expect(mocks.checkoutCreate).not.toHaveBeenCalled();
  });

  it("without Stripe keys goes back to the page (which shows the message) and never calls Stripe", async () => {
    mocks.currentDj = await createDj();
    mocks.configured = false;
    expect(await redirectOf(startCheckoutAction)).toBe("/panel/subskrypcja");
    expect(mocks.customersCreate).not.toHaveBeenCalled();
    expect(mocks.checkoutCreate).not.toHaveBeenCalled();
  });

  it("a Stripe error ends on the page with ?status=error", async () => {
    mocks.currentDj = await createDj();
    mocks.checkoutCreate.mockRejectedValue(new Error("Stripe down"));
    expect(await redirectOf(startCheckoutAction)).toBe("/panel/subskrypcja?status=error");
  });
});

describe("openPortalAction (Zarządzaj subskrypcją)", () => {
  it("requires a logged-in DJ", async () => {
    expect(await redirectOf(openPortalAction)).toBe("/logowanie");
    expect(mocks.portalCreate).not.toHaveBeenCalled();
  });

  it("opens the Customer Portal for the DJ's own customer, returning to the subscription page", async () => {
    await createDj({ stripeCustomerId: "cus_someone_else", plan: "PRO" });
    mocks.currentDj = await createDj({ stripeCustomerId: "cus_mine", plan: "PRO" });
    expect(await redirectOf(openPortalAction)).toBe("https://billing.stripe.com/p/session/test_1");
    expect(mocks.portalCreate).toHaveBeenCalledWith({
      customer: "cus_mine",
      return_url: "https://zagrajto.example/panel/subskrypcja",
      locale: "pl",
    });
  });

  it("without a Stripe customer (or without keys) goes back to the page", async () => {
    mocks.currentDj = await createDj({ plan: "PRO" });
    expect(await redirectOf(openPortalAction)).toBe("/panel/subskrypcja");
    mocks.configured = false;
    expect(await redirectOf(openPortalAction)).toBe("/panel/subskrypcja");
    expect(mocks.portalCreate).not.toHaveBeenCalled();
  });
});
