import { expect, type Browser, type Page } from "@playwright/test";

// The guest page talks to /api/search; every test mocks it in the browser, so Deezer is never called.
export const TRACKS = [
  { id: "9001", title: "Szampan", artist: "sanah", coverUrl: null, durationSec: 200 },
  { id: "9002", title: "Dancing Queen", artist: "ABBA", coverUrl: null, durationSec: 231 },
  { id: "9003", title: "Ona tańczy dla mnie", artist: "Weekend", coverUrl: null, durationSec: 215 },
];

export const PHONE = { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, locale: "pl-PL" };

/** Registers a fresh (Free) DJ and returns the e-mail, e.g. for `setDjPlan`. */
export async function registerDj(page: Page): Promise<string> {
  const email = `dj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/rejestracja");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Nazwa wyświetlana").fill("DJ Gość");
  await page.getByLabel("Hasło").fill("tajnehaslo123");
  await page.getByRole("button", { name: "Załóż konto" }).click();
  await expect(page).toHaveURL(/\/panel$/);
  return email;
}

/** Creates an event as the logged-in DJ and applies status actions; returns its id and code. */
export async function createEventRecord(page: Page, name: string, maxRequestsPerGuest: number, actions: ("start" | "close")[]) {
  const res = await page.request.post("/api/events", { data: { name, maxRequestsPerGuest } });
  expect(res.status()).toBe(201);
  const { event } = (await res.json()) as { event: { id: string; code: string } };
  for (const action of actions) await setEventStatus(page, event.id, action);
  return event;
}

export async function setEventStatus(page: Page, eventId: string, action: "start" | "close") {
  expect((await page.request.post(`/api/events/${eventId}/status`, { data: { action } })).status()).toBe(200);
}

/** Creates an event as the logged-in DJ and applies status actions; returns its code. */
export async function createEvent(page: Page, name: string, maxRequestsPerGuest: number, actions: ("start" | "close")[]) {
  return (await createEventRecord(page, name, maxRequestsPerGuest, actions)).code;
}

export async function guestPage(browser: Browser, searches: string[] = []) {
  const context = await browser.newContext(PHONE);
  const page = await context.newPage();
  await page.route("**/api/search*", async (route) => {
    const q = new URL(route.request().url()).searchParams.get("q") ?? "";
    searches.push(q);
    await route.fulfill({ json: { tracks: q.includes("brak") ? [] : TRACKS } });
  });
  return { context, page };
}

/**
 * Clicks something whose effect the page shows optimistically, then waits until the server has stored it
 * (the matching POST/DELETE answered 2xx). Use it whenever later steps rely on server state (reload, API, export).
 */
export async function clickAndWaitForSave(
  page: Page,
  target: { click: () => Promise<void> },
  path: RegExp,
  method: "POST" | "DELETE" = "POST",
) {
  const saved = page.waitForResponse((response) => response.request().method() === method && path.test(new URL(response.url()).pathname));
  await target.click();
  const response = await saved;
  expect(response.ok(), `${method} ${response.url()} → ${response.status()}`).toBe(true);
}
