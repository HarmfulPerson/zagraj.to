import type Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatRenewalDate,
  parseReturnStatus,
  planForStatus,
  subscriptionPeriodEnd,
  subscriptionUrl,
} from "@/lib/billing";
import { getBillingConfig, isBillingConfigured } from "@/lib/stripe";

const sub = (fields: Record<string, unknown>) => fields as unknown as Stripe.Subscription;

describe("planForStatus", () => {
  it.each([
    ["active", "PRO"],
    ["trialing", "PRO"],
    ["past_due", "PRO"],
    ["canceled", "FREE"],
    ["unpaid", "FREE"],
    ["incomplete", "FREE"],
    ["incomplete_expired", "FREE"],
    ["paused", "FREE"],
  ] as const)("%s → %s", (status, plan) => {
    expect(planForStatus(status)).toBe(plan);
  });
});

describe("subscriptionPeriodEnd", () => {
  it("reads current_period_end from the subscription items (new API versions)", () => {
    expect(subscriptionPeriodEnd(sub({ items: { data: [{ current_period_end: 1_790_000_000 }] } }))).toEqual(new Date(1_790_000_000_000));
  });

  it("falls back to the subscription's current_period_end (older API versions)", () => {
    expect(subscriptionPeriodEnd(sub({ items: { data: [{}] }, current_period_end: 1_780_000_000 }))).toEqual(new Date(1_780_000_000_000));
    expect(subscriptionPeriodEnd(sub({ current_period_end: 1_780_000_000 }))).toEqual(new Date(1_780_000_000_000));
  });

  it("is null when there is no period end at all", () => {
    expect(subscriptionPeriodEnd(sub({ items: { data: [] } }))).toBeNull();
  });
});

describe("page helpers", () => {
  it("formats the renewal date in Polish, in Polish time", () => {
    expect(formatRenewalDate(new Date("2026-11-19T10:00:00Z"))).toBe("19 listopada 2026");
    // 23:30 UTC on 30 November is already 1 December in Warsaw.
    expect(formatRenewalDate(new Date("2026-11-30T23:30:00Z"))).toBe("1 grudnia 2026");
  });

  it("parses only the known return statuses", () => {
    expect(parseReturnStatus("success")).toBe("success");
    expect(parseReturnStatus(["cancel", "success"])).toBe("cancel");
    expect(parseReturnStatus("error")).toBe("error");
    expect(parseReturnStatus("<script>")).toBeNull();
    expect(parseReturnStatus(undefined)).toBeNull();
  });

  it("builds the return URLs from the app URL", () => {
    expect(subscriptionUrl("success", "https://zagrajto.pl")).toBe("https://zagrajto.pl/panel/subskrypcja?status=success");
    expect(subscriptionUrl(undefined, "https://zagrajto.pl")).toBe("https://zagrajto.pl/panel/subskrypcja");
  });
});

describe("billing configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("needs all three STRIPE_* variables", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
    vi.stubEnv("STRIPE_PRICE_PRO", "price_x");
    expect(getBillingConfig()).toEqual({ secretKey: "sk_test_x", webhookSecret: "whsec_x", pricePro: "price_x" });

    vi.stubEnv("STRIPE_PRICE_PRO", " ");
    expect(isBillingConfigured()).toBe(false);
    vi.stubEnv("STRIPE_PRICE_PRO", "price_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(isBillingConfigured()).toBe(false);
  });
});
