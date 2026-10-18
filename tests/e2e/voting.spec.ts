import { expect, test, type Page } from "@playwright/test";

import { createEventRecord, guestPage, registerDj, setEventStatus, TRACKS } from "./guest-helpers";

/** Adds a track from the (mocked) search results as this guest. */
async function addTrack(page: Page, query: string, title: string, artist: string) {
  await page.getByLabel("Szukaj utworu").fill(query);
  await page.getByRole("button", { name: `Dodaj: ${title} – ${artist}` }).click();
  await expect(page.getByTestId("guest-notice")).toContainText(`Dodano „${title}”`);
  await page.getByLabel("Wyczyść wyszukiwanie").click();
}

const row = (page: Page, title: string) => page.getByTestId("guest-request").filter({ hasText: title });
const heart = (page: Page, title: string) => row(page, title).getByTestId("vote-button");
const titles = (page: Page) => page.getByTestId("guest-request").locator("p[title]").allTextContents();

test("guests like tracks; another guest sees the votes after polling; the list re-sorts", async ({ page, browser }) => {
  await registerDj(page);
  const event = await createEventRecord(page, "Wesele Kasi i Marka", 5, ["start"]);

  const guestA = await guestPage(browser);
  const a = guestA.page;
  await a.goto(`/e/${event.code}`);
  await expect(a.getByTestId("guest-list-empty")).toContainText("Lista jest jeszcze pusta");
  await addTrack(a, "szampan", "Szampan", "sanah");
  await addTrack(a, "abba", "Dancing Queen", "ABBA");

  // A's own tracks carry "Twoje" and A's own vote; equal votes → the older one first.
  await expect(row(a, "Szampan")).toContainText("Twoje");
  await expect(heart(a, "Szampan")).toHaveAttribute("aria-pressed", "true");
  await expect(heart(a, "Dancing Queen").getByTestId("vote-count")).toHaveText("1");
  expect(await titles(a)).toEqual(["Szampan", "Dancing Queen"]);

  // Guest B: nothing is theirs; liking is optimistic and survives a reload.
  const guestB = await guestPage(browser);
  const b = guestB.page;
  await b.goto(`/e/${event.code}`);
  await expect(row(b, "Dancing Queen")).not.toContainText("Twoje");
  await expect(heart(b, "Dancing Queen")).toHaveAttribute("aria-pressed", "false");
  await heart(b, "Dancing Queen").click();
  await expect(heart(b, "Dancing Queen")).toHaveAttribute("aria-pressed", "true");
  await expect(heart(b, "Dancing Queen").getByTestId("vote-count")).toHaveText("2");

  // A sees B's like after polling (every 3 s), and the list re-sorts by votes.
  await expect(heart(a, "Dancing Queen").getByTestId("vote-count")).toHaveText("2", { timeout: 10_000 });
  await expect.poll(() => titles(a), { timeout: 10_000 }).toEqual(["Dancing Queen", "Szampan"]);
  // A's own heart stays A's (A added the track, so A voted for it).
  await expect(heart(a, "Dancing Queen")).toHaveAttribute("aria-pressed", "true");

  await b.reload();
  await expect(heart(b, "Dancing Queen")).toHaveAttribute("aria-pressed", "true");

  // Unlike: back to 1 for both guests.
  await heart(b, "Dancing Queen").click();
  await expect(heart(b, "Dancing Queen").getByTestId("vote-count")).toHaveText("1");
  await expect(heart(a, "Dancing Queen").getByTestId("vote-count")).toHaveText("1", { timeout: 10_000 });
  await expect.poll(() => titles(a), { timeout: 10_000 }).toEqual(["Szampan", "Dancing Queen"]);

  // A failed vote rolls back the optimistic heart and explains why in Polish.
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await b.route("**/api/requests/*/vote", async (route) => {
    await held;
    await route.fulfill({ status: 500, json: { error: "SERVER", message: "Nie udało się zapisać głosu. Spróbuj ponownie." } });
  });
  await heart(b, "Szampan").click();
  await expect(heart(b, "Szampan").getByTestId("vote-count")).toHaveText("2");
  release();
  await expect(b.getByTestId("guest-notice")).toContainText("Nie udało się zapisać głosu.");
  await expect(heart(b, "Szampan").getByTestId("vote-count")).toHaveText("1");
  await expect(heart(b, "Szampan")).toHaveAttribute("aria-pressed", "false");
  await b.unroute("**/api/requests/*/vote");

  // Heart buttons are big enough to hit in a dark room (at least 44 px), no horizontal overflow at 360 px.
  const box = await heart(b, "Szampan").boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(await b.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  // The DJ ends the party: both guests' pages switch to the closing message, and voting is refused.
  const requestId = await row(b, "Szampan").getAttribute("data-request-id");
  await setEventStatus(page, event.id, "close");
  await expect(a.getByRole("heading", { name: "Impreza zakończona" })).toBeVisible({ timeout: 10_000 });
  await expect(b.getByRole("heading", { name: "Impreza zakończona" })).toBeVisible({ timeout: 10_000 });
  const refused = await b.request.post(`/api/requests/${requestId}/vote`, { headers: { "content-type": "application/json" } });
  expect(refused.status()).toBe(403);

  await guestA.context.close();
  await guestB.context.close();
});

test("the search area does not keep a full-screen height after the field loses focus", async ({ page, browser }) => {
  await registerDj(page);
  const event = await createEventRecord(page, "Osiemnastka Oli", 5, ["start"]);
  const guest = await guestPage(browser);
  const g = guest.page;
  await g.goto(`/e/${event.code}`);

  const results = g.getByRole("region", { name: "Wyniki wyszukiwania" });
  const fullScreen = () => results.evaluate((el) => !["0px", "auto"].includes(getComputedStyle(el).minHeight));
  await g.getByLabel("Szukaj utworu").focus();
  await expect.poll(fullScreen).toBe(true);
  await g.getByLabel("Szukaj utworu").blur();
  await expect.poll(fullScreen).toBe(false);

  // Showing results keeps the height (no jump under the finger when tapping "Dodaj" blurs the field).
  await g.getByLabel("Szukaj utworu").fill("sanah");
  await expect(g.getByTestId("search-result")).toHaveCount(TRACKS.length);
  await g.getByLabel("Szukaj utworu").blur();
  await expect.poll(fullScreen).toBe(true);
  await guest.context.close();
});

test("guest endpoints refuse non-JSON posts (cross-site forms)", async ({ page, browser }) => {
  await registerDj(page);
  const event = await createEventRecord(page, "Studniówka", 5, ["start"]);
  const guest = await guestPage(browser);
  await guest.page.goto(`/e/${event.code}`);
  const form = await guest.page.request.post(`/api/events/${event.code}/requests`, {
    form: { track: JSON.stringify(TRACKS[0]) },
  });
  expect(form.status()).toBe(415);
  const text = await guest.page.request.post(`/api/events/${event.code}/requests`, {
    headers: { "content-type": "text/plain" },
    data: JSON.stringify({ track: TRACKS[0] }),
  });
  expect(text.status()).toBe(415);
  await guest.context.close();
});

test("covers that fail to load fall back to the music note, even when they fail before hydration", async ({ page, browser }) => {
  await registerDj(page);
  const event = await createEventRecord(page, "Urodziny Zosi", 5, ["start"]);
  const guest = await guestPage(browser);
  const g = guest.page;

  // Deezer's CDN is never reached: one cover loads (a tiny PNG), one gets a 404, one fails at the network level.
  const cover = (name: string) => `https://cdn-images.dzcdn.net/images/cover/${name}/56x56-000000-80-0-0.jpg`;
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  );
  await guest.context.route(/dzcdn\.net/, async (route) => {
    const url = route.request().url();
    if (url.includes("/ok/")) await route.fulfill({ contentType: "image/png", body: PNG });
    else if (url.includes("/missing/")) await route.fulfill({ status: 404, body: "" });
    else await route.abort("connectionrefused");
  });
  const tracks = [
    { id: "9101", title: "Z okładką", artist: "Sanah", coverUrl: cover("ok"), durationSec: 200 },
    { id: "9102", title: "Okładka 404", artist: "Sanah", coverUrl: cover("missing"), durationSec: 200 },
    { id: "9103", title: "Okładka offline", artist: "Sanah", coverUrl: cover("offline"), durationSec: 200 },
  ];
  await g.route("**/api/search*", (route) => route.fulfill({ json: { tracks } }));

  await g.goto(`/e/${event.code}`); // sets the guest cookie
  for (const track of tracks) {
    const res = await g.request.post(`/api/events/${event.code}/requests`, {
      headers: { "content-type": "application/json" },
      data: { track },
    });
    expect(res.status()).toBe(201);
  }

  const brokenVisibleImages = () =>
    g.evaluate(
      () =>
        Array.from(document.images).filter((img) => img.complete && img.naturalWidth === 0 && img.getClientRects().length > 0)
          .length,
    );
  const coverOf = (title: string) => row(g, title).getByTestId("track-cover");

  // Hold the page's scripts back, so the covers fail in the server-rendered list before React hydrates.
  await g.route("**/_next/static/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.continue();
  });
  await g.reload();
  await expect(row(g, "Okładka offline")).toBeVisible();
  await g.unroute("**/_next/static/**");
  await expect(heart(g, "Z okładką")).toHaveAttribute("aria-pressed", "true"); // hydrated

  for (const title of ["Okładka 404", "Okładka offline"]) {
    await expect(coverOf(title)).toHaveAttribute("data-cover-status", "failed");
    await expect(coverOf(title).getByTestId("cover-fallback")).toBeVisible();
    await expect(coverOf(title).locator("img")).toHaveCount(0);
  }
  await expect(coverOf("Z okładką")).toHaveAttribute("data-cover-status", "loaded");
  await expect(coverOf("Z okładką").locator("img")).toHaveCSS("opacity", "1");
  expect(await coverOf("Z okładką").locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect.poll(brokenVisibleImages).toBe(0);

  // Same for covers rendered on the client (search results).
  await g.getByLabel("Szukaj utworu").fill("okładka");
  await expect(g.getByTestId("search-result")).toHaveCount(3);
  await expect(g.getByTestId("search-result").filter({ hasText: "Okładka 404" }).getByTestId("cover-fallback")).toBeVisible();
  await expect.poll(brokenVisibleImages).toBe(0);
  await guest.context.close();
});
