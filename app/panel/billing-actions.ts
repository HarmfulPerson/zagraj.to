"use server";

import { redirect } from "next/navigation";

import { SUBSCRIPTION_PATH } from "@/lib/app";
import { requireDj } from "@/lib/auth";
import { createCheckoutSession, createPortalSession, type SessionResult } from "@/lib/billing";
import { getBillingConfig, getStripe } from "@/lib/stripe";

// Without Stripe keys both go back to the page, which explains that payments are not configured.
// Both actions take no input: they always act on the logged-in DJ's own account (requireDj redirects to /logowanie).

async function openSession(create: () => Promise<SessionResult>, context: string): Promise<never> {
  let result: SessionResult;
  try {
    result = await create();
  } catch (error) {
    console.error(`Stripe ${context} session failed`, error);
    redirect(`${SUBSCRIPTION_PATH}?status=error`);
  }
  // redirect() throws, so it must stay outside the try block.
  redirect(result.ok ? result.url : SUBSCRIPTION_PATH);
}

/** "Przejdź na Pro": redirects to Stripe Checkout. */
export async function startCheckoutAction(): Promise<void> {
  const dj = await requireDj();
  const config = getBillingConfig();
  if (!config) redirect(SUBSCRIPTION_PATH);
  await openSession(() => createCheckoutSession(getStripe(), dj.id, { priceId: config.pricePro }), "checkout");
}

/** "Zarządzaj subskrypcją": redirects to the Stripe Customer Portal. */
export async function openPortalAction(): Promise<void> {
  const dj = await requireDj();
  if (!getBillingConfig()) redirect(SUBSCRIPTION_PATH);
  await openSession(() => createPortalSession(getStripe(), dj.id), "portal");
}
