import { expect, test, type Browser, type Page } from "@playwright/test";

// The guest page talks to /api/search; every test mocks it in the browser, so Deezer is never called.
const TRACKS = [
  { id: "9001", title: "Szampan", artist: "sanah", coverUrl: null, durationSec: 200 },
  { id: "9002", title: "Dancing Queen", artist: "ABBA", coverUrl: null, durationSec: 231 },
  { id: "9003", title: "Ona tańczy dla mnie", artist: "Weekend", coverUrl: null, durationSec: 215 },
];

const PHONE = { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, locale: "pl-PL" };

async function registerDj(page: Page) {
  await page.goto("/rejestracja");
  await page.getByLabel("E-mail").fill(`dj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel("Nazwa wyświetlana").fill("DJ Gość");
  await page.getByLabel("Hasło").fill("tajnehaslo123");
  await page.getByRole("button", { name: "Załóż konto" }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

/** Creates an event as the logged-in DJ and applies status actions; returns its code. */
async function createEvent(page: Page, name: string, maxRequestsPerGuest: number, actions: ("start" | "close")[]) {
  const res = await page.request.post("/api/events", { data: { name, maxRequestsPerGuest } });
  expect(res.status()).toBe(201);
  const { event } = (await res.json()) as { event: { id: string; code: string } };
  for (const action of actions) {
    expect((await page.request.post(`/api/events/${event.id}/status`, { data: { action } })).status()).toBe(200);
  }
  return event.code;
}

async function guestPage(browser: Browser, searches: string[] = []) {
  const context = await browser.newContext(PHONE);
  const page = await context.newPage();
  await page.route("**/api/search*", async (route) => {
    const q = new URL(route.request().url()).searchParams.get("q") ?? "";
    searches.push(q);
    await route.fulfill({ json: { tracks: q.includes("brak") ? [] : TRACKS } });
  });
  return { context, page };
}

test("guest searches, adds a track, hits the limit; another guest's add becomes a vote", async ({ page, browser }) => {
  await registerDj(page);
  const code = await createEvent(page, "Wesele Ani i Tomka", 1, ["start"]);

  const searches: string[] = [];
  const guestA = await guestPage(browser, searches);
  const a = guestA.page;
  await a.goto(`/e/${code.toLowerCase()}`);
  await expect(a).toHaveURL(new RegExp(`/e/${code}$`));
  await expect(a.getByRole("heading", { level: 1, name: "Wesele Ani i Tomka" })).toBeVisible();
  await expect(a.getByTestId("guest-usage")).toContainText("0 z 1");

  // Server-issued guestId: UUID, httpOnly, 30 days.
  const cookie = (await guestA.context.cookies()).find((c) => c.name === "guestId");
  expect(cookie?.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  const days = ((cookie?.expires ?? 0) * 1000 - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(29);
  expect(days).toBeLessThanOrEqual(30);

  // Debounce: fast typing sends a single search for the final query.
  await a.getByLabel("Szukaj utworu").pressSequentially("sanah", { delay: 40 });
  await expect(a.getByTestId("search-result")).toHaveCount(3);
  expect(searches).toEqual(["sanah"]);

  await a.getByRole("button", { name: "Dodaj: Szampan – sanah" }).click();
  await expect(a.getByTestId("guest-notice")).toContainText("Dodano „Szampan”");
  await expect(a.getByTestId("guest-usage")).toContainText("1 z 1");
  await expect(a.getByTestId("search-result").filter({ hasText: "Szampan" })).toContainText("Dodano");

  await a.getByRole("button", { name: "Dodaj: Dancing Queen – ABBA" }).click();
  await expect(a.getByTestId("guest-notice")).toContainText("Wykorzystano limit życzeń (1)");
  await expect(a.getByTestId("search-result").filter({ hasText: "Dancing Queen" }).getByRole("button", { name: /Dodaj/ })).toBeVisible();

  // The added track is listed after clearing the search, also after a reload.
  await a.getByLabel("Wyczyść wyszukiwanie").click();
  await expect(a.getByTestId("guest-mine")).toContainText("Szampan");
  await a.reload();
  await expect(a.getByTestId("guest-mine")).toContainText("Szampan");
  await expect(a.getByTestId("guest-usage")).toContainText("1 z 1");

  // Guest B adds the same track: no duplicate, just a vote (and B's own limit is untouched).
  const guestB = await guestPage(browser);
  const b = guestB.page;
  await b.goto(`/e/${code}`);
  await b.getByLabel("Szukaj utworu").fill("szampan");
  await b.getByRole("button", { name: "Dodaj: Szampan – sanah" }).click();
  await expect(b.getByTestId("guest-notice")).toContainText("już jest na liście. Dodaliśmy Twój głos.");
  await expect(b.getByTestId("guest-usage")).toContainText("0 z 1");
  await expect(b.getByTestId("guest-mine")).toHaveCount(0);

  // Empty results.
  await b.getByLabel("Szukaj utworu").fill("brak wyników");
  await expect(b.getByText("Nic nie znaleźliśmy")).toBeVisible();

  // No horizontal overflow at 360 px.
  expect(await b.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  await guestA.context.close();
  await guestB.context.close();
});

test("search errors are shown in Polish with a retry", async ({ page, browser }) => {
  await registerDj(page);
  const code = await createEvent(page, "Osiemnastka", 5, ["start"]);
  const context = await browser.newContext(PHONE);
  const guest = await context.newPage();
  let fail = true;
  await guest.route("**/api/search*", (route) =>
    fail
      ? route.fulfill({ status: 429, json: { error: "RATE_LIMITED", message: "Za dużo wyszukiwań. Odczekaj chwilę i spróbuj ponownie." } })
      : route.fulfill({ json: { tracks: TRACKS } }),
  );
  await guest.goto(`/e/${code}`);
  await guest.getByLabel("Szukaj utworu").fill("abba");
  await expect(guest.getByTestId("search-error")).toContainText("Za dużo wyszukiwań.");
  fail = false;
  await guest.getByRole("button", { name: "Spróbuj ponownie" }).click();
  await expect(guest.getByTestId("search-result")).toHaveCount(3);
  await context.close();
});

test("draft, closed and unknown events show Polish messages", async ({ page, browser }) => {
  await registerDj(page);
  const draft = await createEvent(page, "Impreza w szkicu", 5, []);
  const closed = await createEvent(page, "Impreza po wszystkim", 5, ["start", "close"]);

  const context = await browser.newContext(PHONE);
  const guest = await context.newPage();

  await guest.goto(`/e/${draft}`);
  await expect(guest.getByRole("heading", { name: "Impreza jeszcze się nie zaczęła" })).toBeVisible();
  await expect(guest.getByText("Impreza w szkicu")).toBeVisible();
  await expect(guest.getByLabel("Szukaj utworu")).toHaveCount(0);

  await guest.goto(`/e/${closed}`);
  await expect(guest.getByRole("heading", { name: "Impreza zakończona" })).toBeVisible();
  await expect(guest.getByLabel("Szukaj utworu")).toHaveCount(0);

  for (const code of ["ZZZZZZ", "nie-ma"]) {
    const res = await guest.goto(`/e/${code}`);
    expect(res?.status()).toBe(404);
    await expect(guest.getByRole("heading", { name: "Nie ma takiej imprezy" })).toBeVisible();
  }

  // The API refuses requests for events that are not LIVE.
  const track = TRACKS[0];
  expect((await guest.request.post(`/api/events/${draft}/requests`, { data: { track } })).status()).toBe(403);
  expect((await guest.request.post(`/api/events/${closed}/requests`, { data: { track } })).status()).toBe(403);
  await context.close();
});
