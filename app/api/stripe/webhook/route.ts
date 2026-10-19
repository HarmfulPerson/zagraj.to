import { handleStripeWebhook } from "@/lib/billing";
import { getBillingConfig, getStripe } from "@/lib/stripe";

/**
 * POST /api/stripe/webhook: Stripe events that keep the DJ's plan in sync (see lib/billing.ts).
 * No session: the request is authenticated by the `Stripe-Signature` header (verified against STRIPE_WEBHOOK_SECRET).
 * Not matched by proxy.ts, never cached (POST route handlers are always dynamic).
 * 200 handled or ignored · 400 missing or invalid signature · 500 processing failed (Stripe retries)
 * · 503 billing not configured (Stripe retries until the keys are set).
 */
export async function POST(request: Request) {
  const config = getBillingConfig();
  if (!config) {
    console.error("Stripe webhook received, but billing is not configured (STRIPE_* variables missing)");
    return Response.json({ error: "BILLING_NOT_CONFIGURED" }, { status: 503 });
  }
  return handleStripeWebhook(request, { stripe: getStripe(), webhookSecret: config.webhookSecret });
}
