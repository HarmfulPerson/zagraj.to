import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { APP_NAME, DARK_THEME_COLOR } from "@/lib/app";
import { PANEL_PATH } from "@/lib/auth";

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: string): { width: number; height: number } {
  const data = readFileSync(file);
  expect(data.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

describe("web app manifest", () => {
  const m = manifest();

  it("installs the DJ panel full-screen with the dark brand colours", () => {
    expect(m.name).toBe(APP_NAME);
    expect(m.short_name).toBe(APP_NAME);
    expect(m.lang).toBe("pl");
    expect(m.description).toMatch(/życzenia/i);
    expect(m.start_url).toBe(PANEL_PATH);
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toBe(DARK_THEME_COLOR);
    expect(m.background_color).toBe(DARK_THEME_COLOR);
  });

  it("lists 192 and 512 px icons (regular and maskable) that exist with those sizes", () => {
    const icons = m.icons ?? [];
    for (const purpose of ["any", "maskable"]) {
      for (const size of [192, 512]) {
        const icon = icons.find((i) => i.purpose === purpose && i.sizes === `${size}x${size}`);
        expect(icon, `${purpose} ${size}`).toBeDefined();
        expect(pngSize(path.join("public", icon!.src))).toEqual({ width: size, height: size });
      }
    }
  });

  it("has a 180 px apple-touch-icon and an SVG icon next to it", () => {
    expect(pngSize(path.join("app", "apple-icon.png"))).toEqual({ width: 180, height: 180 });
    expect(readFileSync(path.join("app", "icon.svg"), "utf8")).toMatch(/^<svg [^>]*viewBox="0 0 512 512"/);
  });
});
