import { expect, test } from "@playwright/test";

import { PLAN_LIMITS } from "../../lib/plans";

import { PHONE, registerDj } from "./guest-helpers";

test("home page renders in Polish", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ZagrajTo/);
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(page.getByRole("heading", { level: 1, name: "Wiesz, czego chce sala, zanim ktoś podejdzie do konsoli." })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: /ZagrajTo/ })).toBeVisible();
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /ZagrajTo/);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "pl_PL");
});

test("landing explains the 3 steps and the CTA leads to registration (phone)", async ({ browser }) => {
  const context = await browser.newContext(PHONE);
  const page = await context.newPage();
  await page.goto("/");
  const steps = page.getByRole("region", { name: "Trzy kroki od plakatu do pełnego parkietu" }).getByRole("listitem");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText("Wystaw kod QR");
  await expect(steps.nth(1)).toContainText("Goście dodają i lajkują");
  await expect(steps.nth(2)).toContainText("Grasz to, co sala chce");
  // The header fits a 360 px phone: no horizontal scrolling.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  await page.getByRole("main").getByRole("link", { name: "Załóż darmowe konto" }).first().click();
  await expect(page).toHaveURL(/\/rejestracja$/);
  await expect(page.getByRole("heading", { name: "Załóż konto DJ-a" })).toBeVisible();
  await context.close();
});

test("header for visitors links to Cennik, Zaloguj and Załóż konto", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Główne menu" });
  await nav.getByRole("link", { name: "Cennik" }).click();
  await expect(page).toHaveURL(/\/cennik$/);
  await expect(nav.getByRole("link", { name: "Zaloguj" })).toHaveAttribute("href", "/logowanie");
  await expect(nav.getByRole("link", { name: "Załóż konto" })).toHaveAttribute("href", "/rejestracja");
  await expect(nav.getByRole("link", { name: "Panel" })).toHaveCount(0);
});

test("pricing shows Free and Pro from lib/plans.ts, Pro recommended, CTAs lead to registration", async ({ page }) => {
  await page.goto("/cennik");
  await expect(page).toHaveTitle("Cennik | ZagrajTo");
  for (const plan of ["FREE", "PRO"] as const) {
    const limits = PLAN_LIMITS[plan];
    const card = page.getByTestId(`plan-card-${plan}`);
    await expect(card.getByRole("heading", { name: limits.name })).toBeVisible();
    await expect(page.getByTestId(`plan-price-${plan}`)).toHaveText(limits.priceLabel);
    for (const feature of limits.features) await expect(card.getByText(feature, { exact: true })).toBeVisible();
    const cta = page.getByTestId(`plan-cta-${plan}`);
    await expect(cta).toHaveAttribute("data-variant", "account");
    await expect(cta).toHaveAttribute("href", plan === "FREE" ? "/rejestracja" : "/rejestracja?plan=pro");
  }
  await expect(page.getByTestId("plan-price-PRO")).toContainText("25 zł");
  await expect(page.getByTestId("plan-card-PRO")).toContainText("Polecany");
  await expect(page.getByTestId("plan-card-FREE")).not.toContainText("Polecany");
});

test("logged-in DJ sees Panel in the header and the Pro CTA leads to the subscription page", async ({ page }) => {
  await registerDj(page);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Główne menu" });
  await expect(nav.getByRole("link", { name: "Panel" })).toHaveAttribute("href", "/panel");
  await expect(nav.getByRole("link", { name: "Zaloguj" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Załóż konto" })).toHaveCount(0);

  await page.goto("/cennik");
  const freeCta = page.getByTestId("plan-cta-FREE");
  const proCta = page.getByTestId("plan-cta-PRO");
  await expect(freeCta).toHaveAttribute("data-variant", "account");
  await expect(freeCta).toHaveAttribute("href", "/panel");
  await expect(freeCta).toHaveText("Przejdź do panelu");
  await expect(proCta).toHaveAttribute("href", "/panel/subskrypcja");
  await expect(proCta).toHaveText("Przejdź na Pro");
  await proCta.click();
  await expect(page).toHaveURL(/\/panel\/subskrypcja$/);
});

test("visitor picking Pro registers and lands on the subscription page", async ({ page }) => {
  await page.goto("/cennik");
  const proCta = page.getByTestId("plan-cta-PRO");
  await expect(proCta).toHaveAttribute("href", "/rejestracja?plan=pro");
  await proCta.click();
  await expect(page).toHaveURL(/\/rejestracja\?plan=pro$/);
  await expect(page.getByTestId("register-plan-intent")).toContainText("Pro");
  await page.getByLabel("E-mail").fill(`pro-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel("Nazwa wyświetlana").fill("DJ Pro");
  await page.getByLabel("Hasło").fill("tajnehaslo123");
  await page.getByRole("button", { name: "Załóż konto" }).click();
  await expect(page).toHaveURL(/\/panel\/subskrypcja$/);
  await expect(page.getByRole("heading", { name: "Subskrypcja" })).toBeVisible();
});

test("registration ignores plan values outside the allowlist", async ({ page }) => {
  await page.goto("/rejestracja?plan=https%3A%2F%2Fevil.example");
  await expect(page.getByRole("heading", { name: "Załóż konto DJ-a" })).toBeVisible();
  await expect(page.getByTestId("register-plan-intent")).toHaveCount(0);
  await page.getByLabel("E-mail").fill(`evil-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel("Nazwa wyświetlana").fill("DJ Zwykły");
  await page.getByLabel("Hasło").fill("tajnehaslo123");
  await page.getByRole("button", { name: "Załóż konto" }).click();
  await expect(page).toHaveURL(/\/panel$/);
});
