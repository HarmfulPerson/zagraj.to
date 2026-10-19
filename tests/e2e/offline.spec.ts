import { expect, test } from "@playwright/test";

import { seedRequests } from "./db-helpers";
import { createEventRecord, PHONE, registerDj } from "./guest-helpers";

// Ticket 014: losing the connection shows a quiet "Brak połączenia, próbuję ponownie" banner on the guest page and
// on the DJ board; it disappears by itself once the browser is back online and a refresh succeeds.

const BANNER_TEXT = /Brak połączenia, próbuję ponownie/;

test("guest page and DJ board show the connection banner while offline and hide it when back online", async ({ browser }) => {
  const djContext = await browser.newContext({ locale: "pl-PL" });
  const dj = await djContext.newPage();
  await registerDj(dj);
  const event = await createEventRecord(dj, "Poprawiny offline", 5, ["start"]);
  seedRequests(event.code, 1);

  // Guest (phone).
  const guestContext = await browser.newContext(PHONE);
  const guest = await guestContext.newPage();
  await guest.goto(`/e/${event.code}`);
  await expect(guest.getByTestId("guest-request")).toHaveCount(1);
  const guestBanner = guest.getByTestId("connection-banner");
  await expect(guestBanner).toHaveCount(0);

  await guestContext.setOffline(true);
  await expect(guestBanner).toBeVisible();
  await expect(guestBanner).toHaveText(BANNER_TEXT);
  await expect(guest.getByRole("status").filter({ hasText: BANNER_TEXT })).toBeVisible();
  // The list stays on screen (last known state), the guest can still read it.
  await expect(guest.getByTestId("guest-request")).toHaveCount(1);

  // Meanwhile a new request arrives; back online, the banner goes away and the list catches up.
  seedRequests(event.code, 2, 1);
  await guestContext.setOffline(false);
  await expect(guestBanner).toHaveCount(0);
  await expect(guest.getByTestId("guest-request")).toHaveCount(3, { timeout: 10_000 });

  // DJ board.
  await dj.goto(`/panel/wydarzenia/${event.id}`);
  await expect(dj.getByTestId("board-card")).toHaveCount(3);
  const boardBanner = dj.getByTestId("connection-banner");
  await expect(boardBanner).toHaveCount(0);
  await djContext.setOffline(true);
  await expect(boardBanner).toBeVisible();
  await expect(boardBanner).toHaveText(BANNER_TEXT);
  await djContext.setOffline(false);
  await expect(boardBanner).toHaveCount(0);

  await guestContext.close();
  await djContext.close();
});

test("a failing refresh (server error) also shows the banner, and a successful one hides it", async ({ browser }) => {
  const djContext = await browser.newContext({ locale: "pl-PL" });
  const dj = await djContext.newPage();
  await registerDj(dj);
  const event = await createEventRecord(dj, "Wesele z awarią", 5, ["start"]);

  const guestContext = await browser.newContext(PHONE);
  const guest = await guestContext.newPage();
  await guest.goto(`/e/${event.code}`);
  await expect(guest.getByTestId("guest-list-empty")).toBeVisible();

  // The browser is online, but the list endpoint fails (e.g. Wi-Fi without internet, server restart).
  let failing = true;
  await guest.route(`**/api/events/${event.code}/requests`, (route) =>
    failing && route.request().method() === "GET" ? route.fulfill({ status: 503, json: { message: "Błąd" } }) : route.continue(),
  );
  await expect(guest.getByTestId("connection-banner")).toBeVisible({ timeout: 10_000 });
  failing = false;
  await expect(guest.getByTestId("connection-banner")).toHaveCount(0, { timeout: 15_000 });

  await guestContext.close();
  await djContext.close();
});
