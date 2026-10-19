import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SubscriptionView, type SubscriptionViewProps } from "@/components/panel/SubscriptionView";
import type { BillingStatus } from "@/lib/billing";
import { isBillingConfigured } from "@/lib/stripe";

const noop = async () => {};
const FREE: BillingStatus = { plan: "FREE", planRenewsAt: null, hasCustomer: false, hasSubscription: false };
const PRO: BillingStatus = { plan: "PRO", planRenewsAt: new Date("2026-11-19T10:00:00Z"), hasCustomer: true, hasSubscription: true };

function render(props: Partial<SubscriptionViewProps>) {
  return renderToStaticMarkup(
    <SubscriptionView status={FREE} returnStatus={null} configured checkoutAction={noop} portalAction={noop} {...props} />,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("SubscriptionView", () => {
  it("without Stripe keys says payments are not configured and disables the upgrade button", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    vi.stubEnv("STRIPE_PRICE_PRO", "");
    const html = render({ configured: isBillingConfigured() });
    expect(html).toContain("Płatności nie są skonfigurowane");
    expect(html).toMatch(/<button type="submit" disabled="" aria-disabled="true"[^>]*>Przejdź na Pro<\/button>/);
  });

  it("Free with keys: current plan Free, Pro offer at 25 zł/mies. and an enabled upgrade button", () => {
    const html = render({});
    expect(html).not.toContain("Płatności nie są skonfigurowane");
    expect(html).toContain('data-testid="current-plan"');
    expect(html).toContain(">Free<");
    expect(html).toContain("25 zł/mies.");
    expect(html).toMatch(/<button type="submit" aria-disabled="false"[^>]*>Przejdź na Pro<\/button>/);
    expect(html).not.toContain("Zarządzaj subskrypcją");
  });

  it("Pro: renewal date in Polish and the Customer Portal button instead of the upgrade", () => {
    const html = render({ status: PRO });
    expect(html).toContain("19 listopada 2026");
    expect(html).toContain("Zarządzaj subskrypcją");
    expect(html).not.toContain("Przejdź na Pro");
  });

  it("Pro without keys: no portal button, the not-configured message instead", () => {
    const html = render({ status: PRO, configured: false });
    expect(html).toContain("Płatności nie są skonfigurowane");
    expect(html).not.toContain("Zarządzaj subskrypcją");
  });

  it("success banner says activation may take a moment until the webhook arrives; cancel banner says nothing was charged", () => {
    expect(render({ returnStatus: "success" })).toContain("Aktywacja planu może potrwać chwilę");
    expect(render({ returnStatus: "success", status: PRO })).toContain("Plan Pro jest już aktywny");
    expect(render({ returnStatus: "cancel" })).toContain("Nic nie zostało pobrane");
    expect(render({})).not.toContain("billing-banner");
  });
});
