import Stripe from "stripe";

/**
 * Stripe configuration (ticket 012). All three variables are needed for billing to work:
 * the secret key (API calls), the webhook signing secret (verifying `POST /api/stripe/webhook`)
 * and the id of the recurring Pro price (Checkout). Without them the subscription page shows
 * "Płatności nie są skonfigurowane" and the webhook answers 503.
 */
export type BillingConfig = { secretKey: string; webhookSecret: string; pricePro: string };

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/** The billing configuration, or null when any of the three variables is missing or blank. */
export function getBillingConfig(): BillingConfig | null {
  const secretKey = env("STRIPE_SECRET_KEY");
  const webhookSecret = env("STRIPE_WEBHOOK_SECRET");
  const pricePro = env("STRIPE_PRICE_PRO");
  return secretKey && webhookSecret && pricePro ? { secretKey, webhookSecret, pricePro } : null;
}

export function isBillingConfigured(): boolean {
  return getBillingConfig() !== null;
}

const globalForStripe = globalThis as unknown as { stripe?: { key: string; client: Stripe } };

/** The Stripe client, created lazily on first use (never at import time, so the app runs without keys). */
export function getStripe(): Stripe {
  const key = env("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (globalForStripe.stripe?.key !== key) {
    globalForStripe.stripe = { key, client: new Stripe(key, { appInfo: { name: "ZagrajTo" } }) };
  }
  return globalForStripe.stripe.client;
}
