import { expect, test, type Page } from "@playwright/test";

function uniqueEmail() {
  return `dj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function registerDj(page: Page, displayName = "DJ Wydarzenia") {
  await page.goto("/rejestracja");
  await page.getByLabel("E-mail").fill(uniqueEmail());
  await page.getByLabel("Nazwa wyświetlana").fill(displayName);
  await page.getByLabel("Hasło").fill("tajnehaslo123");
  await page.getByRole("button", { name: "Załóż konto" }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test("create → list → start → edit → close an event", async ({ page }) => {
  await registerDj(page);
  await expect(page.getByText("Nie masz jeszcze wydarzeń")).toBeVisible();

  await page.getByRole("link", { name: "Utwórz pierwsze wydarzenie" }).click();
  await expect(page).toHaveURL(/\/panel\/wydarzenia\/nowe$/);

  // Validation errors from the server, in Polish.
  await page.getByLabel("Limit życzeń na gościa").fill("50");
  await page.getByRole("button", { name: "Utwórz wydarzenie" }).click();
  await expect(page.getByText("Podaj nazwę wydarzenia.")).toBeVisible();
  await expect(page.getByText("Limit musi być liczbą całkowitą od 1 do 20.")).toBeVisible();

  await page.getByLabel("Nazwa wydarzenia").fill("Wesele Ani i Tomka");
  await page.getByLabel("Data (opcjonalnie)").fill("2026-10-24");
  await page.getByLabel("Limit życzeń na gościa").fill("7");
  await page.getByRole("button", { name: "Utwórz wydarzenie" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Wesele Ani i Tomka" })).toBeVisible();
  await expect(page).not.toHaveURL(/\/nowe$/);
  const eventUrl = page.url();
  await expect(page.getByTestId("event-status")).toHaveText("Szkic");
  await expect(page.getByText("24 października 2026")).toBeVisible();
  await expect(page.getByText("7 życzeń")).toBeVisible();
  const code = (await page.getByTestId("event-code").textContent())?.trim() ?? "";
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

  await page.getByRole("button", { name: "Rozpocznij" }).click();
  await expect(page.getByTestId("event-status")).toHaveText("Trwa");
  await expect(page.getByRole("button", { name: "Rozpocznij" })).toHaveCount(0);

  await page.getByLabel("Nazwa wydarzenia").fill("Wesele A&T");
  await page.getByLabel("Limit życzeń na gościa").fill("3");
  await page.getByRole("button", { name: "Zapisz zmiany" }).click();
  await expect(page.getByText("Zmiany zapisane.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Wesele A&T" })).toBeVisible();
  await expect(page.getByText("3 życzenia")).toBeVisible();

  await page.getByRole("button", { name: "Zakończ" }).click();
  await page.getByRole("button", { name: "Nie, wróć" }).click();
  await expect(page.getByTestId("event-status")).toHaveText("Trwa");
  await page.getByRole("button", { name: "Zakończ" }).click();
  await page.getByRole("button", { name: "Tak, zakończ" }).click();
  await expect(page.getByTestId("event-status")).toHaveText("Zakończone");
  await expect(page.getByRole("button", { name: /Rozpocznij|Zakończ/ })).toHaveCount(0);

  // A closed event cannot be reopened through the API either.
  const id = eventUrl.split("/").pop();
  const reopen = await page.request.post(`/api/events/${id}/status`, { data: { action: "start" } });
  expect(reopen.status()).toBe(409);

  await page.getByRole("link", { name: "← Wszystkie wydarzenia" }).click();
  await expect(page).toHaveURL(/\/panel$/);
  const row = page.getByTestId("event-row");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Wesele A&T");
  await expect(row).toContainText(code);
  await expect(row).toContainText("Zakończone");
  await expect(row).toContainText("24 października 2026");
});

test("list shows newest first; another DJ gets 404 for someone else's event", async ({ page, browser }) => {
  await registerDj(page);
  for (const name of ["Starsze wydarzenie", "Nowsze wydarzenie"]) {
    await page.goto("/panel/wydarzenia/nowe");
    await page.getByLabel("Nazwa wydarzenia").fill(name);
    await page.getByRole("button", { name: "Utwórz wydarzenie" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  }
  const eventId = page.url().split("/").pop();

  await page.goto("/panel");
  await expect(page.getByTestId("event-row")).toHaveText([/Nowsze wydarzenie/, /Starsze wydarzenie/]);
  await expect(page.getByTestId("event-row").first()).toContainText("Bez daty");
  await expect(page.getByTestId("event-row").first()).toContainText("Szkic");

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await registerDj(otherPage, "DJ Obcy");
  await expect(otherPage.getByTestId("event-row")).toHaveCount(0);

  for (const res of [
    await otherPage.request.get(`/api/events/${eventId}`),
    await otherPage.request.patch(`/api/events/${eventId}`, { data: { name: "Hack", maxRequestsPerGuest: 20 } }),
    await otherPage.request.post(`/api/events/${eventId}/status`, { data: { action: "start" } }),
  ]) {
    expect(res.status()).toBe(404);
  }

  await otherPage.goto(`/panel/wydarzenia/${eventId}`);
  await expect(otherPage.getByRole("heading", { name: "Nie znaleziono wydarzenia" })).toBeVisible();
  await other.close();

  await page.reload();
  await expect(page.getByTestId("event-row").first()).toContainText("Nowsze wydarzenie");
  await expect(page.getByTestId("event-row").first()).toContainText("Szkic");
});
