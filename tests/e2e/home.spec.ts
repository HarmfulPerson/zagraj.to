import { expect, test } from "@playwright/test";

test("home page renders in Polish", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ZagrajTo/);
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(page.getByRole("heading", { level: 1, name: "ZagrajTo" })).toBeVisible();
});
