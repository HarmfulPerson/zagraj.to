import { readFile } from "node:fs/promises";

import { type Browser, expect, test } from "@playwright/test";

import { clickAndWaitForSave, createEventRecord, registerDj } from "./guest-helpers";

const TABLET_LANDSCAPE = { width: 1180, height: 820 };
const STATUS_POST = /^\/api\/requests\/[^/]+\/status$/;

/** A guest (own cookie jar, so own guestId) adds a track straight through the guest API. */
async function guestAdds(browser: Browser, code: string, track: { id: string; title: string; artist: string }) {
  const context = await browser.newContext();
  const res = await context.request.post(`/api/events/${code}/requests`, { data: { track } });
  expect([200, 201]).toContain(res.status());
  await context.close();
}

test("DJ downloads the CSV and copies the list; another DJ gets 404", async ({ page, browser, baseURL }) => {
  await page.setViewportSize(TABLET_LANDSCAPE);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
  await registerDj(page);
  const event = await createEventRecord(page, "Wesele Łucji", 5, ["start"]);

  const tricky = { id: "8001", title: 'Zażółć, "gęślą" jaźń', artist: "Łzy" };
  const formula = { id: "8002", title: "=1+1", artist: "Kult" };
  const plain = { id: "8003", title: "Ona tańczy dla mnie", artist: "Weekend" };
  await guestAdds(browser, event.code, tricky);
  await guestAdds(browser, event.code, tricky); // second guest: a vote
  await guestAdds(browser, event.code, formula);
  await guestAdds(browser, event.code, plain);

  await page.goto(`/panel/wydarzenia/${event.id}`);
  await expect(page.getByTestId("column-PENDING").getByTestId("board-card")).toHaveCount(3);
  // Reject one: it is left out of the export by default.
  // The board moves the card optimistically, so wait for the server to store the change before exporting.
  const reject = page.getByTestId("column-PENDING").getByTestId("board-card").filter({ hasText: "Ona tańczy" }).getByRole("button", { name: /^Odrzuć/ });
  await clickAndWaitForSave(page, reject, STATUS_POST);
  await expect(page.getByTestId("column-PENDING").getByTestId("board-card")).toHaveCount(2);

  // The export sits in the collapsed "Wydarzenie i QR" section, not on the live board.
  const exportSection = page.getByTestId("export-controls");
  await expect(exportSection).toBeHidden();
  await page.getByRole("button", { name: "Wydarzenie i QR" }).click();
  await expect(exportSection).toBeVisible();
  await expect(exportSection.getByRole("checkbox", { name: "Nowe" })).toBeChecked();
  await expect(exportSection.getByRole("checkbox", { name: "Zaakceptowane" })).toBeChecked();
  await expect(exportSection.getByRole("checkbox", { name: "Zagrane" })).toBeChecked();
  await expect(exportSection.getByRole("checkbox", { name: "Odrzucone" })).not.toBeChecked();

  const downloadPromise = page.waitForEvent("download");
  await exportSection.getByRole("link", { name: "Pobierz CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Wesele Łucji \d{4}-\d{2}-\d{2}\.csv$/);
  const bytes = await readFile((await download.path())!);
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const csv = bytes.subarray(3).toString("utf8");
  const lines = csv.split("\r\n");
  expect(lines[0]).toBe("tytuł,artysta,status,głosy,dodano,zagrano");
  expect(lines[1]).toMatch(/^"Zażółć, ""gęślą"" jaźń",Łzy,Nowe,2,\d{4}-\d{2}-\d{2} \d{2}:\d{2},$/);
  expect(lines[2]).toMatch(/^'=1\+1,Kult,Nowe,1,/);
  expect(lines).toHaveLength(4);
  expect(csv).not.toContain("Ona tańczy");

  // "Kopiuj listę" with "Odrzucone" ticked too.
  await exportSection.getByText("Odrzucone").click();
  await expect(exportSection.getByRole("checkbox", { name: "Odrzucone" })).toBeChecked();
  await exportSection.getByRole("button", { name: "Kopiuj listę" }).click();
  await expect(page.getByTestId("export-feedback")).toHaveText("Skopiowano");
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe('Łzy – Zażółć, "gęślą" jaźń\nKult – =1+1\nWeekend – Ona tańczy dla mnie\n');

  // Nothing ticked: no download, no copy.
  for (const name of ["Nowe", "Zaakceptowane", "Zagrane", "Odrzucone"]) await exportSection.getByText(name, { exact: true }).click();
  await expect(exportSection.getByRole("link", { name: "Pobierz CSV" })).toHaveCount(0);
  await expect(exportSection.getByRole("button", { name: "Kopiuj listę" })).toBeDisabled();
  await expect(exportSection.getByRole("button", { name: "Kopiuj listę" })).toHaveAttribute("aria-disabled", "true");
  await expect(exportSection.getByText("Pobierz CSV")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("export-feedback")).toHaveText("Wybierz co najmniej jeden status.");

  // Another DJ cannot export it.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await registerDj(otherPage);
  const res = await otherPage.request.get(`/api/events/${event.id}/export?format=csv`);
  expect(res.status()).toBe(404);
  expect(res.headers()["content-disposition"]).toBeUndefined();
  await other.close();
});
