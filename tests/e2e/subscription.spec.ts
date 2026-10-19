import { expect, test } from "@playwright/test";

import { setDjPlan } from "./db-helpers";
import { PHONE, registerDj } from "./guest-helpers";

// The Playwright dev server runs without STRIPE_* variables: the page must explain that payments are not configured.

test("Free DJ without Stripe keys: plan Free, Pro offer, 'Płatności nie są skonfigurowane' and no working upgrade", async ({ page }) => {
  await registerDj(page);
  await page.getByTestId("plan-badge").click();
  await expect(page).toHaveURL(/\/panel\/subskrypcja$/);
  await expect(page.getByRole("heading", { name: "Subskrypcja" })).toBeVisible();
  await expect(page.getByTestId("current-plan")).toHaveText("Free");
  await expect(page.getByText("25 zł/mies.")).toBeVisible();
  await expect(page.getByTestId("billing-not-configured")).toContainText("Płatności nie są skonfigurowane");
  await expect(page.getByRole("button", { name: "Przejdź na Pro" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Zarządzaj subskrypcją" })).toHaveCount(0);
});

test("Pro DJ sees the renewal date in Polish and no upgrade button", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  const page = await context.newPage();
  setDjPlan(await registerDj(page), "PRO", new Date("2026-11-19T10:00:00Z"));
  await page.goto("/panel/subskrypcja");
  await expect(page.getByTestId("current-plan")).toHaveText("Pro");
  await expect(page.getByTestId("plan-renews-at")).toHaveText("Odnowienie: 19 listopada 2026");
  await expect(page.getByRole("button", { name: "Przejdź na Pro" })).toHaveCount(0);
  await expect(page.getByTestId("billing-not-configured")).toBeVisible();
  await context.close();
});

test("return from Checkout shows the success or cancel banner", async ({ page }) => {
  await registerDj(page);
  await page.goto("/panel/subskrypcja?status=success");
  await expect(page.getByTestId("billing-banner-success")).toContainText("Aktywacja planu może potrwać chwilę");
  await page.goto("/panel/subskrypcja?status=cancel");
  await expect(page.getByTestId("billing-banner-cancel")).toContainText("Nic nie zostało pobrane");
});

test("the subscription page requires login", async ({ page }) => {
  await page.goto("/panel/subskrypcja");
  await expect(page).toHaveURL(/\/logowanie$/);
});

test("the webhook rejects a request without a Stripe signature", async ({ request }) => {
  // Without keys the endpoint answers 503 before looking at the body; with keys a missing signature is 400.
  const res = await request.post("/api/stripe/webhook", { data: { type: "customer.subscription.updated" } });
  expect([400, 503]).toContain(res.status());
});
