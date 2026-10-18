import { expect, test, type Page } from "@playwright/test";

function uniqueEmail() {
  return `dj-poster-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function registerDj(page: Page, displayName = "DJ Plakat") {
  await page.goto("/rejestracja");
  await page.getByLabel("E-mail").fill(uniqueEmail());
  await page.getByLabel("Nazwa wyświetlana").fill(displayName);
  await page.getByLabel("Hasło").fill("tajnehaslo123");
  await page.getByRole("button", { name: "Załóż konto" }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

async function createEvent(page: Page, name: string) {
  await page.goto("/panel/wydarzenia/nowe");
  await page.getByLabel("Nazwa wydarzenia").fill(name);
  await page.getByRole("button", { name: "Utwórz wydarzenie" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const code = (await page.getByTestId("event-code").textContent())?.trim() ?? "";
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  return { id: page.url().split("/").pop()!, code };
}

test("event page shows QR, guest link and copies it; poster renders with the right code and prints", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await registerDj(page);
  const { id, code } = await createEvent(page, "Osiemnastka Kasi");

  // QR card on the event page.
  const guestUrlPattern = new RegExp(`^https?://[^/]+/e/${code}$`);
  await expect(page.getByRole("heading", { name: "Kod QR dla gości" })).toBeVisible();
  const qr = page.getByTestId("event-qr");
  await expect(qr.locator("svg")).toBeVisible();
  await expect(qr).toHaveAttribute("data-qr-value", guestUrlPattern);
  const guestUrl = (await page.getByTestId("guest-url").textContent())?.trim() ?? "";
  expect(guestUrl).toMatch(guestUrlPattern);

  await page.getByRole("button", { name: "Kopiuj link" }).click();
  await expect(page.getByRole("button", { name: "Skopiowano!" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(guestUrl);

  // Poster.
  await page.getByRole("link", { name: "Plakat do druku" }).click();
  await expect(page).toHaveURL(new RegExp(`/panel/wydarzenia/${id}/plakat$`));
  const poster = page.getByTestId("poster");
  await expect(poster).toBeVisible();
  await expect(page.getByTestId("poster-event-name")).toHaveText("Osiemnastka Kasi");
  await expect(page.getByTestId("poster-code")).toHaveText(code);
  await expect(poster.getByText("Zeskanuj i zamów piosenkę")).toBeVisible();
  await expect(page.getByTestId("poster-qr").locator("svg")).toBeVisible();
  await expect(page.getByTestId("poster-qr")).toHaveAttribute("data-qr-value", guestUrl);
  await expect(page.getByTestId("poster-url")).toHaveText(guestUrl.replace(/^https?:\/\//, ""));

  // „Drukuj” calls window.print().
  await page.evaluate(() => {
    (window as unknown as { printCalls: number }).printCalls = 0;
    window.print = () => {
      (window as unknown as { printCalls: number }).printCalls++;
    };
  });
  await page.getByRole("button", { name: "Drukuj" }).click();
  expect(await page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(1);

  // On paper only the poster is left: no header, no back link, no print button.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("banner")).toBeHidden();
  await expect(page.getByRole("link", { name: "← Wróć do wydarzenia" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Drukuj" })).toBeHidden();
  await expect(poster).toBeVisible();
  await expect(page.getByTestId("poster-code")).toHaveText(code);
});

test("poster prints as exactly one A4 page", async ({ page }) => {
  await registerDj(page);
  const { id } = await createEvent(page, "Wesele z bardzo długą nazwą, żeby sprawdzić, czy plakat dalej mieści się na jednej stronie A4");
  await page.goto(`/panel/wydarzenia/${id}/plakat`);
  await expect(page.getByTestId("poster")).toBeVisible();
  const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  // Page count from the page tree root (`/Type /Pages ... /Count N`); Chromium writes it uncompressed.
  const counts = [...pdf.toString("latin1").matchAll(/\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  expect(counts.length).toBeGreaterThan(0);
  expect(Math.max(...counts)).toBe(1);
});

test("another DJ cannot open someone else's poster", async ({ page, browser }) => {
  await registerDj(page);
  const { id } = await createEvent(page, "Prywatna impreza");

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await registerDj(otherPage, "DJ Obcy");
  await otherPage.goto(`/panel/wydarzenia/${id}/plakat`);
  await expect(otherPage.getByRole("heading", { name: "Nie znaleziono wydarzenia" })).toBeVisible();
  await expect(otherPage.getByTestId("poster")).toHaveCount(0);
  await other.close();
});
