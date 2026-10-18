#!/usr/bin/env node
// Visual check: opens pages in a real browser and saves screenshots for review.
//
// Usage (dev server must be running, e.g. `npm run dev -- --port 3200`):
//   node scripts/ui-shots.mjs /e/ABC234 /panel
//   BASE_URL=http://localhost:3200 node scripts/ui-shots.mjs /
//   COOKIE="name=value" node scripts/ui-shots.mjs /panel   # e.g. logged-in DJ session
//
// Screenshots land in ui-shots/<viewport>/<page>.png (gitignored).
// Viewports match SPEC: guest phone (360px), DJ tablet/phone in landscape, desktop.
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3200";
const OUT_DIR = process.env.OUT_DIR ?? "ui-shots";

const VIEWPORTS = {
  "phone-360": { width: 360, height: 780, isMobile: true, hasTouch: true },
  "phone-landscape": { width: 844, height: 390, isMobile: true, hasTouch: true },
  "tablet-landscape": { width: 1180, height: 820, hasTouch: true },
  desktop: { width: 1440, height: 900 },
};

const pages = process.argv.slice(2);
if (pages.length === 0) {
  console.error("Podaj ścieżki stron, np.: node scripts/ui-shots.mjs / /cennik");
  process.exit(1);
}

const only = process.env.VIEWPORTS?.split(",");
const browser = await chromium.launch();
const problems = [];

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  if (only && !only.includes(name)) continue;
  const { width, height, ...rest } = viewport;
  const context = await browser.newContext({ viewport: { width, height }, ...rest, locale: "pl-PL" });
  if (process.env.COOKIE) {
    const [cookieName, ...value] = process.env.COOKIE.split("=");
    await context.addCookies([{ name: cookieName, value: value.join("="), url: BASE_URL }]);
  }
  for (const route of pages) {
    const page = await context.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") problems.push(`[${name}] ${route} console: ${msg.text()}`);
    });
    page.on("pageerror", (err) => problems.push(`[${name}] ${route} pageerror: ${err.message}`));
    const res = await page.goto(BASE_URL + route, { waitUntil: "networkidle" });
    if (res && res.status() >= 400) problems.push(`[${name}] ${route} HTTP ${res.status()}`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 0) problems.push(`[${name}] ${route} horizontal overflow: ${overflow}px`);
    const file = path.join(OUT_DIR, name, (route.replace(/[^a-zA-Z0-9]+/g, "_") || "_") + ".png");
    await mkdir(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
    await page.close();
  }
  await context.close();
}

await browser.close();
if (problems.length) {
  console.log("\nProblemy:\n" + problems.join("\n"));
  process.exitCode = 2;
}
