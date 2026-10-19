import { describe, expect, it } from "vitest";

import { parseRegisterPlanIntent, planCta, postRegisterPath, publicPageMetadata } from "@/lib/site";

describe("publicPageMetadata", () => {
  it("builds Polish Open Graph data with a relative URL for metadataBase", () => {
    const metadata = publicPageMetadata({ title: "Cennik | ZagrajTo", description: "Opis", path: "/cennik" });
    expect(metadata).toMatchObject({
      title: "Cennik | ZagrajTo",
      description: "Opis",
      alternates: { canonical: "/cennik" },
      openGraph: { type: "website", locale: "pl_PL", siteName: "ZagrajTo", title: "Cennik | ZagrajTo", description: "Opis", url: "/cennik" },
    });
  });
});

describe("planCta", () => {
  it("sends visitors to registration for both plans", () => {
    expect(planCta("FREE", null)).toEqual({ href: "/rejestracja", label: "Załóż darmowe konto" });
    expect(planCta("PRO", null)).toEqual({ href: "/rejestracja?plan=pro", label: "Zacznij z Pro" });
  });

  it("sends a logged-in Free DJ to the panel (Free) or the subscription page (Pro)", () => {
    expect(planCta("FREE", "FREE")).toEqual({ href: "/panel", label: "Przejdź do panelu" });
    expect(planCta("PRO", "FREE")).toEqual({ href: "/panel/subskrypcja", label: "Przejdź na Pro" });
  });

  it("sends a Pro DJ to manage the subscription", () => {
    expect(planCta("PRO", "PRO")).toEqual({ href: "/panel/subskrypcja", label: "Zarządzaj subskrypcją" });
    expect(planCta("FREE", "PRO")).toEqual({ href: "/panel/subskrypcja", label: "Zarządzaj planem" });
  });
});

describe("plan chosen before registration", () => {
  it("accepts only allowlisted plan values", () => {
    expect(parseRegisterPlanIntent("pro")).toBe("pro");
    for (const value of ["PRO", "free", "", " pro", "https://evil.example", "//evil.example", null, undefined, ["pro"], 1]) {
      expect(parseRegisterPlanIntent(value)).toBeNull();
    }
  });

  it("sends a DJ who came for Pro to the subscription page, everyone else to the panel", () => {
    expect(postRegisterPath("pro")).toBe("/panel/subskrypcja");
    expect(postRegisterPath(null)).toBe("/panel");
    expect(postRegisterPath(parseRegisterPlanIntent("https://evil.example"))).toBe("/panel");
  });
});
