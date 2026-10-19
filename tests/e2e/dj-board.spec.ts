import { expect, test, type Page } from "@playwright/test";

import { clickAndWaitForSave, createEventRecord, guestPage, registerDj } from "./guest-helpers";

const TABLET_LANDSCAPE = { width: 1180, height: 820 };
// Board actions are optimistic: the card moves before the server answers. Steps that rely on server state wait for these.
const STATUS_POST = /^\/api\/requests\/[^/]+\/status$/;
const REQUESTS_OPEN_POST = /^\/api\/events\/[^/]+\/requests-open$/;

async function addTrack(page: Page, query: string, title: string, artist: string) {
  await page.getByLabel("Szukaj utworu").fill(query);
  await page.getByRole("button", { name: `Dodaj: ${title} – ${artist}` }).click();
  await expect(page.getByTestId("guest-notice")).toContainText(`Dodano „${title}”`);
  await page.getByLabel("Wyczyść wyszukiwanie").click();
}

const column = (page: Page, status: "PENDING" | "ACCEPTED" | "PLAYED" | "REJECTED") => page.getByTestId(`column-${status}`);
const card = (page: Page, status: "PENDING" | "ACCEPTED" | "PLAYED" | "REJECTED", title: string) =>
  column(page, status).getByTestId("board-card").filter({ hasText: title });

test("guest adds → DJ sees it with votes → Zagrane → guest sees it in Zagrane; another DJ gets 404", async ({ page, browser }) => {
  await page.setViewportSize(TABLET_LANDSCAPE);
  await registerDj(page);
  const event = await createEventRecord(page, "Wesele na tablecie", 5, ["start"]);
  await page.goto(`/panel/wydarzenia/${event.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Wesele na tablecie" })).toBeVisible();
  await expect(column(page, "PENDING")).toContainText("Brak nowych życzeń");

  // Guest A adds two tracks, guest B adds one of them again (a vote).
  const guestA = await guestPage(browser);
  await guestA.page.goto(`/e/${event.code}`);
  await addTrack(guestA.page, "szampan", "Szampan", "sanah");
  await addTrack(guestA.page, "abba", "Dancing Queen", "ABBA");
  const guestB = await guestPage(browser);
  await guestB.page.goto(`/e/${event.code}`);
  await guestB.page.getByLabel("Szukaj utworu").fill("abba");
  await guestB.page.getByRole("button", { name: "Dodaj: Dancing Queen – ABBA" }).click();
  await expect(guestB.page.getByTestId("guest-notice")).toContainText("Dodaliśmy Twój głos");

  // The DJ sees both after polling, by votes, highlighted as new, with a Spotify link.
  const dancing = card(page, "PENDING", "Dancing Queen");
  await expect(dancing.getByTestId("board-votes")).toHaveText("2", { timeout: 10_000 });
  await expect(card(page, "PENDING", "Szampan").getByTestId("board-votes")).toHaveText("1");
  await expect(column(page, "PENDING").getByTestId("board-title")).toHaveText(["Dancing Queen", "Szampan"]);
  await expect(dancing).toHaveAttribute("data-new", "true");
  await expect(page.getByTestId("new-count")).toContainText("2 nowe");
  const spotify = dancing.getByRole("link", { name: /Otwórz w Spotify/ });
  await expect(spotify).toHaveAttribute("href", "https://open.spotify.com/search/ABBA%20Dancing%20Queen");
  await expect(spotify).toHaveAttribute("target", "_blank");
  await expect(spotify).toHaveAttribute("rel", /noopener/);

  // Big targets for a DJ in a dark club.
  const accept = dancing.getByRole("button", { name: /^Akceptuj/ });
  const box = await accept.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(48);

  // Accept, then Zagrane; acting on a card ends its highlight.
  await clickAndWaitForSave(page, accept, STATUS_POST);
  await expect(card(page, "ACCEPTED", "Dancing Queen")).toBeVisible();
  await expect(card(page, "ACCEPTED", "Dancing Queen")).not.toHaveAttribute("data-new", "true");
  await clickAndWaitForSave(page, card(page, "ACCEPTED", "Dancing Queen").getByRole("button", { name: /^Zagrane/ }), STATUS_POST);
  await expect(card(page, "PLAYED", "Dancing Queen")).toBeVisible();

  // Stored for real (survives a reload); playedAt was set.
  await page.reload();
  await expect(card(page, "PLAYED", "Dancing Queen")).toBeVisible();
  const board = await (await page.request.get(`/api/events/${event.id}/board`)).json();
  expect(board.columns.PLAYED[0]).toMatchObject({ title: "Dancing Queen", status: "PLAYED", playedAt: expect.any(String) });

  // The guest sees it in "Zagrane" after polling; adding it again gives a neutral message and no vote.
  const played = guestA.page.getByTestId("guest-played");
  await expect(played).toContainText("Dancing Queen", { timeout: 10_000 });
  await expect(guestA.page.getByTestId("guest-queue")).not.toContainText("Dancing Queen");
  const guestC = await guestPage(browser);
  await guestC.page.goto(`/e/${event.code}`);
  await expect(guestC.page.getByTestId("guest-played")).toContainText("Dancing Queen");
  await guestC.page.getByLabel("Szukaj utworu").fill("abba");
  await guestC.page.getByRole("button", { name: "Dodaj: Dancing Queen – ABBA" }).click();
  await expect(guestC.page.getByTestId("guest-notice")).toContainText("Ten utwór został już zagrany.");
  const afterReAdd = await (await page.request.get(`/api/events/${event.id}/board`)).json();
  expect(afterReAdd.columns.PLAYED[0].votes).toBe(2);

  // Reject Szampan: it disappears for guests and sits in the collapsed "Odrzucone".
  await clickAndWaitForSave(page, card(page, "PENDING", "Szampan").getByRole("button", { name: /^Odrzuć/ }), STATUS_POST);
  await expect(card(page, "REJECTED", "Szampan")).toBeHidden();
  await column(page, "REJECTED").locator("summary").click();
  await expect(card(page, "REJECTED", "Szampan")).toBeVisible();
  await expect(guestA.page.getByTestId("guest-list")).not.toContainText("Szampan", { timeout: 10_000 });
  // "Cofnij do nowych" brings it back.
  await clickAndWaitForSave(page, card(page, "REJECTED", "Szampan").getByRole("button", { name: /^Cofnij do nowych/ }), STATUS_POST);
  await expect(card(page, "PENDING", "Szampan")).toBeVisible();

  // The "Zgłoszenia otwarte" switch closes requests for guests.
  const toggle = page.getByRole("switch", { name: /Zgłoszenia otwarte/ });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await clickAndWaitForSave(page, toggle, REQUESTS_OPEN_POST);
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(guestA.page.getByText("DJ chwilowo nie przyjmuje nowych życzeń.")).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole("switch", { name: /Zgłoszenia otwarte/ })).toHaveAttribute("aria-checked", "false");

  // Another DJ cannot see or change anything (404).
  const requestId = board.columns.PLAYED[0].id as string;
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await registerDj(otherPage);
  for (const res of [
    await otherPage.request.post(`/api/requests/${requestId}/status`, { data: { status: "PENDING" } }),
    await otherPage.request.post(`/api/events/${event.id}/requests-open`, { data: { requestsOpen: true } }),
    await otherPage.request.get(`/api/events/${event.id}/board`),
  ]) {
    expect(res.status()).toBe(404);
  }
  await page.reload();
  await expect(card(page, "PLAYED", "Dancing Queen")).toBeVisible();

  // No horizontal overflow on a phone in landscape.
  await page.setViewportSize({ width: 844, height: 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  await Promise.all([other.close(), guestA.context.close(), guestB.context.close(), guestC.context.close()]);
});

test("a DRAFT or CLOSED board is static: no polling, no actions", async ({ page }) => {
  await registerDj(page);
  const draft = await createEventRecord(page, "Szkic", 5, []);
  let polls = 0;
  page.on("request", (request) => {
    if (request.url().includes("/board")) polls += 1;
  });
  await page.goto(`/panel/wydarzenia/${draft.id}`);
  await expect(page.getByText("Tablica ruszy, gdy rozpoczniesz wydarzenie.")).toBeVisible();
  // Event management is open on a draft, so the DJ can start it.
  await expect(page.getByRole("button", { name: "Rozpocznij" })).toBeVisible();

  const closed = await createEventRecord(page, "Po imprezie", 5, ["start", "close"]);
  await page.goto(`/panel/wydarzenia/${closed.id}`);
  await expect(page.getByText("Wydarzenie zakończone. Tablica jest tylko do podglądu.")).toBeVisible();
  await expect(page.getByRole("switch")).toHaveCount(0);
  await page.waitForTimeout(4000);
  expect(polls).toBe(0);
});
