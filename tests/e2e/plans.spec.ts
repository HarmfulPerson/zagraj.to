import { expect, test } from "@playwright/test";

import { seedRequests, setDjPlan } from "./db-helpers";
import { createEventRecord, guestPage, registerDj } from "./guest-helpers";

const TABLET_LANDSCAPE = { width: 1180, height: 820 };

test("Free DJ starts the first event of the month; the second is blocked with a message and an upgrade link", async ({ page }) => {
  await page.setViewportSize(TABLET_LANDSCAPE);
  await registerDj(page);
  await expect(page.getByTestId("plan-badge")).toHaveText("Plan: Free");
  const first = await createEventRecord(page, "Wesele w październiku", 5, []);
  const second = await createEventRecord(page, "Druga impreza", 5, []);

  // A DRAFT event opens with the "Wydarzenie i QR" section expanded.
  await page.goto(`/panel/wydarzenia/${first.id}`);
  await page.getByRole("button", { name: "Rozpocznij" }).click();
  await expect(page.getByTestId("event-status")).toHaveText("Trwa");

  await page.goto(`/panel/wydarzenia/${second.id}`);
  await page.getByRole("button", { name: "Rozpocznij" }).click();
  const alert = page.getByTestId("plan-limit-alert");
  await expect(alert).toContainText("W planie Free możesz uruchomić 1 wydarzenie w miesiącu kalendarzowym.");
  await expect(alert.getByRole("link", { name: "Przejdź na Pro" })).toHaveAttribute("href", "/panel/subskrypcja");
  await expect(page.getByTestId("event-status")).toHaveText("Szkic");

  // The API refuses it too.
  const res = await page.request.post(`/api/events/${second.id}/status`, { data: { action: "start" } });
  expect(res.status()).toBe(403);
  expect(await res.json()).toMatchObject({ error: "PLAN_LIMIT", upgradeUrl: "/panel/subskrypcja" });

  // The poster text is locked for Free.
  const lockedText = page.getByTestId("poster-text-locked");
  await expect(lockedText).toContainText("Własny tekst na plakacie dostępny w planie Pro");
  await expect(lockedText.getByRole("textbox")).toBeDisabled();
});

test("Pro DJ starts several events, sets a poster text and sees it on the poster", async ({ page }) => {
  await page.setViewportSize(TABLET_LANDSCAPE);
  setDjPlan(await registerDj(page), "PRO");
  await page.reload();
  await expect(page.getByTestId("plan-badge")).toHaveText("Plan: Pro");

  await createEventRecord(page, "Pierwsza", 5, ["start"]);
  const name = "Wesele Ani i Tomka z bardzo długą nazwą, żeby sprawdzić, czy plakat dalej mieści się na jednej A4";
  const text = "Najlepsza para, najlepsza muzyka! Bawimy się do rana, zamawiajcie swoje hity DJ!";
  expect(text.length).toBe(80);
  const event = await createEventRecord(page, name, 5, ["start"]);

  await page.goto(`/panel/wydarzenia/${event.id}`);
  await page.getByRole("button", { name: "Wydarzenie i QR" }).click();
  await expect(page.getByTestId("poster-text-locked")).toHaveCount(0);
  await page.getByLabel("Tekst na plakacie (opcjonalnie)").fill(text);
  await page.getByRole("button", { name: "Zapisz zmiany" }).click();
  await expect(page.getByText("Zmiany zapisane.")).toBeVisible();

  await page.goto(`/panel/wydarzenia/${event.id}/plakat`);
  await expect(page.getByTestId("poster-custom-text")).toHaveText(text);
  await expect(page.getByTestId("poster").getByText("Zeskanuj i zamów piosenkę")).toBeVisible();

  // The longest name with the longest text still prints on exactly one A4 page (same check as poster.spec.ts).
  const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  const counts = [...pdf.toString("latin1").matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  expect(counts.length).toBeGreaterThan(0);
  expect(Math.max(...counts)).toBe(1);
});

test("guests see 'Lista jest pełna' on a full Free event and can still like tracks", async ({ page, browser }) => {
  await registerDj(page);
  const event = await createEventRecord(page, "Pełna lista", 5, ["start"]);
  seedRequests(event.code, 100);

  const { context, page: guest } = await guestPage(browser);
  await guest.goto(`/e/${event.code}`);
  const banner = guest.getByTestId("guest-list-full");
  await expect(banner).toContainText("Lista jest pełna");
  await expect(banner).toContainText("Możesz dalej lajkować");
  await expect(guest.getByRole("searchbox")).toHaveCount(0);

  const like = guest.getByTestId("guest-queue").getByRole("button", { name: /Polub/ }).first();
  const saved = guest.waitForResponse((r) => r.request().method() === "POST" && /\/api\/requests\/[^/]+\/vote$/.test(new URL(r.url()).pathname));
  await like.click();
  expect((await saved).ok()).toBe(true);

  // A new track through the API: 409 LIST_FULL with the Polish message.
  const res = await guest.request.post(`/api/events/${event.code}/requests`, {
    data: { track: { id: "777", title: "Nowy", artist: "X", coverUrl: null, durationSec: 100 } },
  });
  expect(res.status()).toBe(409);
  expect(await res.json()).toMatchObject({ error: "LIST_FULL" });
  await context.close();
});
