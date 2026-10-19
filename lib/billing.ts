import type Stripe from "stripe";

import type { Plan } from "@/generated/prisma/enums";
import { SUBSCRIPTION_PATH } from "@/lib/app";
import { prisma } from "@/lib/db";
import { getAppUrl } from "@/lib/guest-url";
import { PLAN_TIME_ZONE } from "@/lib/plans";

/**
 * Billing logic (ticket 012): Stripe Checkout, Customer Portal and the webhook that keeps `User.plan` in sync.
 * The Stripe client is injected (only the few calls used below), so tests pass a fake one: no network, no keys.
 *
 * Webhook strategy (idempotency and ordering): for `checkout.session.completed` and `customer.subscription.updated`
 * the event payload is only a trigger. The handler retrieves the subscription from Stripe and writes its *current*
 * state. So replaying an event, or receiving events out of order (an older `updated` after a newer one), always ends
 * in the same state as Stripe has now. `customer.subscription.deleted` is terminal (a canceled subscription can never
 * become active again), so its payload is applied directly. Writes are plain `UPDATE`s of absolute values, never
 * increments, so applying the same state twice changes nothing.
 */
export type BillingStripe = {
  customers: { create(params: Stripe.CustomerCreateParams): Promise<{ id: string }> };
  checkout: { sessions: { create(params: Stripe.Checkout.SessionCreateParams): Promise<{ url: string | null }> } };
  billingPortal: { sessions: { create(params: Stripe.BillingPortal.SessionCreateParams): Promise<{ url: string }> } };
  subscriptions: { retrieve(id: string): Promise<Stripe.Subscription> };
  webhooks: { constructEvent(payload: string, header: string, secret: string): Stripe.Event };
};

/** Return URLs of Checkout and the Customer Portal (`?status=` drives the banner on the subscription page). */
export function subscriptionUrl(status?: "success" | "cancel", appUrl: string = getAppUrl()): string {
  return `${appUrl}${SUBSCRIPTION_PATH}${status ? `?status=${status}` : ""}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Subscription page
// ---------------------------------------------------------------------------------------------------------------

export type BillingStatus = { plan: Plan; planRenewsAt: Date | null; hasCustomer: boolean; hasSubscription: boolean };

export async function getBillingStatus(userId: string): Promise<BillingStatus | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, planRenewsAt: true, stripeCustomerId: true, stripeSubscriptionId: true },
  });
  if (!user) return null;
  return {
    plan: user.plan,
    planRenewsAt: user.planRenewsAt,
    hasCustomer: user.stripeCustomerId !== null,
    hasSubscription: user.stripeSubscriptionId !== null,
  };
}

const renewalFormatter = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: PLAN_TIME_ZONE });

/** "19 listopada 2026" (Polish time). */
export function formatRenewalDate(date: Date): string {
  return renewalFormatter.format(date);
}

/** The `?status=` query of the subscription page; anything else shows no banner. */
export type ReturnStatus = "success" | "cancel" | "error";

export function parseReturnStatus(raw: string | string[] | undefined): ReturnStatus | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "success" || value === "cancel" || value === "error" ? value : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Checkout and Customer Portal
// ---------------------------------------------------------------------------------------------------------------

export type SessionResult = { ok: true; url: string } | { ok: false; reason: "NOT_FOUND" | "ALREADY_PRO" | "NO_CUSTOMER" | "NO_URL" };

/** The DJ's Stripe customer: the stored one, or a new one (email + `metadata.userId`) saved on the user. */
async function ensureCustomer(stripe: BillingStripe, user: { id: string; email: string; stripeCustomerId: string | null }) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
  // Only set it when still empty: a concurrent click may have stored one already, then that one wins.
  const { count } = await prisma.user.updateMany({ where: { id: user.id, stripeCustomerId: null }, data: { stripeCustomerId: customer.id } });
  if (count === 1) return customer.id;
  const current = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { stripeCustomerId: true } });
  return current.stripeCustomerId ?? customer.id;
}

/** A Stripe Checkout session (subscription, Pro price, Polish UI) for the DJ `userId`. */
export async function createCheckoutSession(
  stripe: BillingStripe,
  userId: string,
  options: { priceId: string; appUrl?: string },
): Promise<SessionResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, plan: true, stripeCustomerId: true } });
  if (!user) return { ok: false, reason: "NOT_FOUND" };
  if (user.plan === "PRO") return { ok: false, reason: "ALREADY_PRO" };

  const customer = await ensureCustomer(stripe, user);
  const appUrl = options.appUrl ?? getAppUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    metadata: { userId: user.id },
    subscription_data: { metadata: { userId: user.id } },
    line_items: [{ price: options.priceId, quantity: 1 }],
    success_url: subscriptionUrl("success", appUrl),
    cancel_url: subscriptionUrl("cancel", appUrl),
    locale: "pl",
  });
  return session.url ? { ok: true, url: session.url } : { ok: false, reason: "NO_URL" };
}

/** A Customer Portal session (manage card, cancel) for the DJ `userId`; needs a Stripe customer. */
export async function createPortalSession(stripe: BillingStripe, userId: string, options: { appUrl?: string } = {}): Promise<SessionResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
  if (!user) return { ok: false, reason: "NOT_FOUND" };
  if (!user.stripeCustomerId) return { ok: false, reason: "NO_CUSTOMER" };
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: subscriptionUrl(undefined, options.appUrl ?? getAppUrl()),
    locale: "pl",
  });
  return { ok: true, url: session.url };
}

// ---------------------------------------------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------------------------------------------

/**
 * Subscription status → plan. `past_due` keeps Pro: Stripe is still retrying the payment (Smart Retries), and when it
 * gives up the subscription becomes `canceled` or `unpaid` (per the dashboard setting), which we receive as an update.
 * `incomplete` (first payment not done yet, e.g. a pending bank transfer) does not grant Pro yet.
 */
export function planForStatus(status: Stripe.Subscription.Status): Plan {
  return status === "active" || status === "trialing" || status === "past_due" ? "PRO" : "FREE";
}

/** End of the paid period. Newer API versions keep it on the subscription items, older ones on the subscription. */
export function subscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const legacy = (subscription as Stripe.Subscription & { current_period_end?: number | null }).current_period_end;
  const ends = subscription.items?.data?.map((item) => item.current_period_end).filter((end): end is number => typeof end === "number") ?? [];
  const seconds = ends.length > 0 ? Math.max(...ends) : legacy;
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export type WebhookOutcome =
  | { handled: true; userId: string; plan: Plan }
  | { handled: false; reason: "IGNORED_EVENT" | "NOT_SUBSCRIPTION" | "UNKNOWN_USER" | "STALE_SUBSCRIPTION" };

type UserRef = { id: string; stripeCustomerId: string | null; stripeSubscriptionId: string | null };
const userRefSelect = { id: true, stripeCustomerId: true, stripeSubscriptionId: true } as const;

/** The user a subscription belongs to: by Stripe customer id, else by our `metadata.userId` (set at Checkout). */
async function findSubscriptionUser(customerId: string | null, userIdHint: string | null): Promise<UserRef | null> {
  if (customerId) {
    const byCustomer = await prisma.user.findUnique({ where: { stripeCustomerId: customerId }, select: userRefSelect });
    if (byCustomer) return byCustomer;
  }
  return userIdHint ? prisma.user.findUnique({ where: { id: userIdHint }, select: userRefSelect }) : null;
}

/** Writes the state of `subscription` (as Stripe has it now) onto its user. */
async function applySubscription(subscription: Stripe.Subscription, userIdHint: string | null = null): Promise<WebhookOutcome> {
  const customerId = idOf(subscription.customer);
  const user = await findSubscriptionUser(customerId, userIdHint ?? subscription.metadata?.userId ?? null);
  if (!user) return { handled: false, reason: "UNKNOWN_USER" };

  const plan = planForStatus(subscription.status);
  if (plan === "PRO") {
    await prisma.user.update({
      where: { id: user.id },
      data: { plan, stripeCustomerId: customerId ?? user.stripeCustomerId, stripeSubscriptionId: subscription.id, planRenewsAt: subscriptionPeriodEnd(subscription) },
    });
    return { handled: true, userId: user.id, plan };
  }

  // An inactive subscription only downgrades the user while it is their current one (or they have none):
  // the end of an old subscription must not cancel a newer, active one.
  if (user.stripeSubscriptionId !== null && user.stripeSubscriptionId !== subscription.id) {
    return { handled: false, reason: "STALE_SUBSCRIPTION" };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { plan, stripeCustomerId: customerId ?? user.stripeCustomerId, stripeSubscriptionId: null, planRenewsAt: null },
  });
  return { handled: true, userId: user.id, plan };
}

async function handleCheckoutCompleted(stripe: BillingStripe, session: Stripe.Checkout.Session): Promise<WebhookOutcome> {
  const subscriptionId = idOf(session.subscription);
  if (session.mode !== "subscription" || !subscriptionId) return { handled: false, reason: "NOT_SUBSCRIPTION" };
  const userId = session.client_reference_id ?? session.metadata?.userId ?? null;
  return applySubscription(await stripe.subscriptions.retrieve(subscriptionId), userId);
}

/** Applies one verified Stripe event. Throws on database or Stripe API errors (the route answers 500, Stripe retries). */
export async function processStripeEvent(stripe: BillingStripe, event: Stripe.Event): Promise<WebhookOutcome> {
  switch (event.type) {
    case "checkout.session.completed":
      return handleCheckoutCompleted(stripe, event.data.object);
    case "customer.subscription.updated":
      return applySubscription(await stripe.subscriptions.retrieve(event.data.object.id));
    case "customer.subscription.deleted":
      // Terminal state: apply the payload as is (status `canceled`), no need to ask Stripe again.
      return applySubscription({ ...event.data.object, status: "canceled" });
    default:
      return { handled: false, reason: "IGNORED_EVENT" };
  }
}

/**
 * The whole webhook request: signature check on the raw body, then `processStripeEvent`.
 * 400 missing or invalid signature · 200 handled or ignored · 500 processing failed (Stripe retries; no details in the body).
 */
export async function handleStripeWebhook(request: Request, deps: { stripe: BillingStripe; webhookSecret: string }): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "MISSING_SIGNATURE" }, { status: 400 });

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = deps.stripe.webhooks.constructEvent(payload, signature, deps.webhookSecret);
  } catch {
    return Response.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  }

  try {
    const outcome = await processStripeEvent(deps.stripe, event);
    if (!outcome.handled && outcome.reason !== "IGNORED_EVENT") {
      console.warn(`Stripe webhook ${event.id} (${event.type}) not applied: ${outcome.reason}`);
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error(`Stripe webhook ${event.id} (${event.type}) failed`, error);
    return Response.json({ error: "WEBHOOK_FAILED" }, { status: 500 });
  }
}
