import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { seedRequests } from "./db-helpers";
import { createEventRecord, PHONE, registerDj } from "./guest-helpers";

/**
 * Ticket 014: every key page is in Polish (no leftover English UI words, `<html lang="pl">`) and passes axe-core
 * without serious or critical violations (labels, names of icon-only buttons, contrast…).
 */

// Typical English UI words, matched as whole words (case-insensitive) in visible text, document title and
// aria-label / title / placeholder / alt attributes.
const ENGLISH_UI_WORDS = [
  "Loading",
  "Submit",
  "Error",
  "Cancel",
  "Save",
  "Delete",
  "Remove",
  "Edit",
  "Sign in",
  "Sign up",
  "Sign out",
  "Log in",
  "Log out",
  "Login",
  "Logout",
  "Register",
  "Password",
  "Back",
  "Next",
  "Previous",
  "Search",
  "Close",
  "Settings",
  "Retry",
  "Try again",
  "Copy",
  "Copied",
  "Download",
  "Print",
  "Share",
  "Open",
  "Home",
  "Dashboard",
  "Continue",
  "Confirm",
  "Something went wrong",
  "Not found",
  "Skip to content",
  "Upgrade",
  "Subscription",
  "Pricing",
];
// Brand and product names that are fine in Polish UI. None of them is in the list above; kept explicit so a future
// word added to the list cannot silently flag them.
const ALLOWED = ["Spotify", "rekordbox", "Pro", "Free", "QR", "BLIK", "Stripe", "Deezer", "CSV", "ZagrajTo", "PLN"];

const englishPattern = new RegExp(
  `(?<!\\p{L})(${ENGLISH_UI_WORDS.map((word) => word.replace(/ /g, "\\s+")).join("|")})(?!\\p{L})`,
  "giu",
);

function findEnglish(text: string): string[] {
  let cleaned = text;
  for (const name of ALLOWED) cleaned = cleaned.replace(new RegExp(`(?<!\\p{L})${name}(?!\\p{L})`, "gu"), " ");
  return [...new Set([...cleaned.matchAll(englishPattern)].map((match) => match[0]))];
}

async function pageTexts(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts = [document.title, document.body.innerText];
    for (const el of document.querySelectorAll("[aria-label], [title], [placeholder], [alt]")) {
      for (const attr of ["aria-label", "title", "placeholder", "alt"]) {
        const value = el.getAttribute(attr);
        if (value) parts.push(value);
      }
    }
    return parts.join("\n");
  });
}

async function expectPolish(page: Page, label: string) {
  await expect(page.locator("html"), label).toHaveAttribute("lang", "pl");
  expect(findEnglish(await pageTexts(page)), `English UI words on ${label}`).toEqual([]);
}

async function expectNoSeriousAxeViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
  expect(serious, `axe on ${label}`).toEqual([]);
}

async function check(page: Page, path: string, ready: (page: Page) => Promise<void>, label = path) {
  await page.goto(path);
  await ready(page);
  // Wait for client components (streamed session parts, SWR) to settle before reading the page.
  await page.waitForLoadState("networkidle");
  await expectPolish(page, label);
  await expectNoSeriousAxeViolations(page, label);
}

const heading = (name: string | RegExp) => async (page: Page) => {
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
};

test.describe.configure({ timeout: 120_000 });

test("public pages are Polish and accessible (visitor)", async ({ page }) => {
  await check(page, "/", heading(/Wiesz, czego chce sala/));
  await check(page, "/cennik", async (p) => expect(p.getByTestId("plan-cta-PRO")).toBeVisible());
  await check(page, "/logowanie", heading("Zaloguj się"));
  await check(page, "/rejestracja", heading("Załóż konto DJ-a"));
  await check(page, "/rejestracja?plan=pro", async (p) => expect(p.getByTestId("register-plan-intent")).toBeVisible());
  await check(page, "/nie-ma-takiej-strony", heading("Nie ma takiej strony"), "404");
  await check(page, "/e/ZZZZZZ", heading("Nie ma takiej imprezy"), "guest 404");
});

async function setUpDj(browser: Browser, colorScheme: "light" | "dark") {
  const context = await browser.newContext({ locale: "pl-PL", colorScheme });
  const page = await context.newPage();
  await registerDj(page);
  const event = await createEventRecord(page, "Wesele Ani i Tomka", 5, ["start"]);
  seedRequests(event.code, 3);
  return { context, page, event };
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`DJ pages are Polish and accessible (${colorScheme} system theme)`, async ({ browser }) => {
    const { context, page, event } = await setUpDj(browser, colorScheme);
    await check(page, "/panel", heading(/Cześć/));
    await check(page, "/panel/wydarzenia/nowe", heading("Nowe wydarzenie"));
    await check(page, `/panel/wydarzenia/${event.id}`, async (p) => expect(p.getByTestId("board-card")).toHaveCount(3), "board");
    // The collapsed event management (QR, status, edit, export) is checked too.
    await page.getByRole("button", { name: "Wydarzenie i QR" }).click();
    await expect(page.getByRole("heading", { name: "Kod QR dla gości" })).toBeVisible();
    await expectPolish(page, "board with event management");
    await expectNoSeriousAxeViolations(page, "board with event management");
    await check(page, `/panel/wydarzenia/${event.id}/plakat`, heading("Plakat do druku"), "poster");
    await check(page, "/panel/subskrypcja", heading("Subskrypcja"));
    await check(page, "/panel/wydarzenia/nie-ma", heading("Nie znaleziono wydarzenia"), "panel 404");
    // Logged in: the public pages show the account variant of the header and pricing buttons.
    await check(page, "/cennik", async (p) => expect(p.getByTestId("site-panel-link")).toBeVisible(), "/cennik (logged in)");
    await context.close();
  });
}

test("guest page is Polish, accessible and dark by default (phone)", async ({ browser }) => {
  const { context: djContext, event } = await setUpDj(browser, "light");
  // A guest with a light system theme still gets the dark page.
  const context = await browser.newContext({ ...PHONE, colorScheme: "light" });
  const page = await context.newPage();
  await check(page, `/e/${event.code}`, async (p) => expect(p.getByTestId("guest-request")).toHaveCount(3), "guest page");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#09090b");
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute("content", "dark");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(9, 9, 11)");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("dark");

  // Search results (icon-only clear button, add buttons) too; the catalogue is mocked.
  await page.route("**/api/search*", (route) =>
    route.fulfill({ json: { tracks: [{ id: "9001", title: "Szampan", artist: "sanah", coverUrl: null, durationSec: 200 }] } }),
  );
  await page.getByLabel("Szukaj utworu").fill("sanah");
  await expect(page.getByTestId("search-result")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Wyczyść wyszukiwanie" })).toBeVisible();
  await expectPolish(page, "guest search");
  await expectNoSeriousAxeViolations(page, "guest search");
  await context.close();
  await djContext.close();
});

test("English word detector catches leftovers and ignores brands and Polish words", () => {
  expect(findEnglish("Loading… Zapisz")).toEqual(["Loading"]);
  expect(findEnglish("Kliknij Sign  in")).toEqual(["Sign  in"]);
  expect(findEnglish("Otwórz w Spotify · Plan Pro · eksport do rekordbox · BLIK")).toEqual([]);
  // Whole words only: Polish words containing the letters are fine.
  expect(findEnglish("Zamknij komunikat, kopiuj link, drukuj, wróć, Następne")).toEqual([]);
});

test("keyboard: the registration form can be filled and sent with the keyboard only", async ({ page }) => {
  const email = `dj-kbd-${Date.now()}@example.com`;
  await page.goto("/rejestracja");
  await page.getByLabel("E-mail").focus();
  await page.keyboard.type(email);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Nazwa wyświetlana")).toBeFocused();
  await page.keyboard.type("DJ Klawiatura");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Hasło")).toBeFocused();
  await page.keyboard.type("tajnehaslo123");
  await page.keyboard.press("Tab");
  const submit = page.getByRole("button", { name: "Załóż konto" });
  await expect(submit).toBeFocused();
  // The focused button has a visible focus ring (outline).
  expect(await submit.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/panel$/);
});
