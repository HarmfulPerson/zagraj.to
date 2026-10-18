import { describe, expect, it } from "vitest";

import { posterTitleSize } from "@/lib/poster";
import { renderQrSvg } from "@/lib/qr";

describe("renderQrSvg", () => {
  it("returns a scalable SVG without fixed dimensions", async () => {
    const svg = await renderQrSvg("https://zagrajto.pl/e/ABC234");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("viewBox=");
    expect(svg).not.toMatch(/\s(width|height)="/);
    expect(svg).toContain("<path");
  });

  it("encodes different URLs differently", async () => {
    expect(await renderQrSvg("https://zagrajto.pl/e/ABC234")).not.toBe(await renderQrSvg("https://zagrajto.pl/e/XYZ789"));
  });
});

describe("posterTitleSize", () => {
  it("shrinks the font for longer names", () => {
    const sizes = ["Wesele", "Osiemnastka Kasi w klubie", "Wesele Ani i Tomka w Dworku pod Lipami, Kraków", "x".repeat(70), "x".repeat(100)].map(
      (name) => parseFloat(posterTitleSize(name)),
    );
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1]);
    expect(sizes[0]).toBeGreaterThan(sizes[sizes.length - 1]);
  });
});
