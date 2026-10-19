import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { clickAndWaitForSave, guestPage, registerDj } from "./guest-helpers";

// The "MVP gotowe" scenario from SPEC.md, end to end through the UI, with three separate browser contexts
// (DJ, guest A, guest B: separate cookies). Deezer is never called: guestPage() mocks /api/search in the browser.

const VOTE_PATH = /^\/api\/requests\/[^/]+\/vote$/;
const STATUS_PATH = /^\/api\/requests\/[^/]+\/status$/;
// Polling (guest list and DJ board) refreshes every few seconds; allow a few rounds.
const POLL = { timeout: 15_000 };

/** Optional screenshots of the key moments, for a human check: `E2E_SCREENSHOT_DIR=/some/dir npx playwright test …`. */
async function snapshot(page: Page, name: string) {
  const dir = process.env.E2E_SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: path.join(dir, `${name}-${test.info().repeatEachIndex}.png`), fullPage: true });
}

test("MVP: DJ registers and starts an event → guest A adds → guest B likes → DJ sees 2 votes → Zagrane → guest A sees it", async ({
  page: dj,
  browser,
}) => {
  // 1. The DJ registers (UI, unique e-mail) and creates an event (UI).
  await dj.setViewportSize({ width: 1180, height: 820 });
  await registerDj(dj);
  await dj.getByRole("link", { name: "Utwórz pierwsze wydarzenie" }).click();
  await dj.getByLabel("Nazwa wydarzenia").fill("Wesele Oli i Kuby");
  await dj.getByRole("button", { name: "Utwórz wydarzenie" }).click();
  await expect(dj.getByRole("heading", { level: 1, name: "Wesele Oli i Kuby" })).toBeVisible();
  await expect(dj.getByTestId("event-status")).toHaveText("Szkic");

  // 2. …and starts it (UI); the board goes live.
  await dj.getByRole("button", { name: "Rozpocznij" }).click();
  await expect(dj.getByTestId("event-status")).toHaveText("Trwa");
  const pending = dj.getByRole("region", { name: "Nowe" });
  await expect(pending).toContainText("Brak nowych życzeń");
  const code = (await dj.getByTestId("event-code").textContent())?.trim() ?? "";
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

  // 3. Guest A opens /e/<code>, searches and adds a track.
  const guestA = await guestPage(browser);
  const a = guestA.page;
  await a.goto(`/e/${code}`);
  await expect(a.getByText("Lista jest jeszcze pusta")).toBeVisible();
  await a.getByLabel("Szukaj utworu").fill("abba");
  await a.getByRole("button", { name: "Dodaj: Dancing Queen – ABBA" }).click();
  await expect(a.getByTestId("guest-notice")).toContainText("Dodano „Dancing Queen”");
  await a.getByLabel("Wyczyść wyszukiwanie").click();
  const queueA = a.getByRole("region", { name: "Lista życzeń" });
  await expect(queueA.getByRole("button", { name: "Polub: Dancing Queen – ABBA" })).toHaveAttribute("aria-pressed", "true");
  await snapshot(a, "1-guest-a-list");

  // 4. Guest B (own cookies) likes it; wait until the vote is stored.
  const guestB = await guestPage(browser);
  const b = guestB.page;
  await b.goto(`/e/${code}`);
  const likeB = b.getByRole("region", { name: "Lista życzeń" }).getByRole("button", { name: "Polub: Dancing Queen – ABBA" });
  await expect(likeB).toHaveAttribute("aria-pressed", "false");
  await clickAndWaitForSave(b, likeB, VOTE_PATH);
  await expect(likeB).toHaveAttribute("aria-pressed", "true");
  await expect(likeB).toContainText("2");

  // 5. The DJ sees 2 votes on the board (after polling).
  const card = pending.getByRole("listitem").filter({ hasText: "Dancing Queen" });
  await expect(card.getByRole("img", { name: "2 głosy" })).toBeVisible(POLL);
  await snapshot(dj, "2-dj-board-2-votes");

  // 6. The DJ marks it "Zagrane" and waits until the server stored it.
  await clickAndWaitForSave(dj, card.getByRole("button", { name: "Zagrane: Dancing Queen – ABBA" }), STATUS_PATH);
  await expect(dj.getByRole("region", { name: "Zagrane" })).toContainText("Dancing Queen");
  await expect(pending).toContainText("Brak nowych życzeń");

  // 7. Guest A sees it in "Zagrane" (after polling), and it left the queue.
  const playedA = a.getByRole("region", { name: "Zagrane" });
  await expect(playedA).toContainText("Dancing Queen", POLL);
  await expect(playedA).toContainText("2 głosy");
  await expect(queueA.getByRole("button", { name: "Polub: Dancing Queen – ABBA" })).toHaveCount(0);
  await snapshot(a, "3-guest-a-zagrane");

  await Promise.all([guestA.context.close(), guestB.context.close()]);
});
