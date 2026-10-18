import { expect, test } from "@playwright/test";

function uniqueEmail() {
  return `dj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test("register → panel → logout → login", async ({ page }) => {
  const email = uniqueEmail();
  const password = "tajnehaslo123";

  await page.goto("/rejestracja");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Nazwa wyświetlana").fill("DJ Testowy");
  await page.getByLabel("Hasło").fill(password);
  await page.getByRole("button", { name: "Załóż konto" }).click();

  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole("heading", { name: "Cześć, DJ Testowy!" })).toBeVisible();

  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === "zagrajto_session");
  expect(session?.httpOnly).toBe(true);

  await page.getByRole("button", { name: "Wyloguj się" }).click();
  await expect(page).toHaveURL(/\/logowanie$/);
  expect((await page.context().cookies()).some((c) => c.name === "zagrajto_session")).toBe(false);

  // Panel is protected again after logout.
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/logowanie$/);

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Hasło").fill(password);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole("heading", { name: "Cześć, DJ Testowy!" })).toBeVisible();
});

test("unauthenticated visitor is redirected from /panel to /logowanie", async ({ page }) => {
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/logowanie$/);
  await page.goto("/panel/wydarzenia/nowe");
  await expect(page).toHaveURL(/\/logowanie$/);
});

test("duplicate email shows a Polish error", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/rejestracja");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Nazwa wyświetlana").fill("DJ Pierwszy");
  await page.getByLabel("Hasło").fill("tajnehaslo123");
  await page.getByRole("button", { name: "Załóż konto" }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await page.getByRole("button", { name: "Wyloguj się" }).click();
  await expect(page).toHaveURL(/\/logowanie$/);

  await page.goto("/rejestracja");
  await page.getByLabel("E-mail").fill(email.toUpperCase());
  await page.getByLabel("Nazwa wyświetlana").fill("DJ Drugi");
  await page.getByLabel("Hasło").fill("tajnehaslo123");
  await page.getByRole("button", { name: "Załóż konto" }).click();
  await expect(page.getByText("Konto z tym adresem e-mail już istnieje.")).toBeVisible();
  await expect(page).toHaveURL(/\/rejestracja$/);
});

test("wrong credentials show a generic message", async ({ page }) => {
  await page.goto("/logowanie");
  await page.getByLabel("E-mail").fill(uniqueEmail());
  await page.getByLabel("Hasło").fill("cokolwiek123");
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Nieprawidłowy" })).toHaveText("Nieprawidłowy e-mail lub hasło.");
  await expect(page).toHaveURL(/\/logowanie$/);
});
