import type { Metadata } from "next";

import { APP_NAME, SUBSCRIPTION_PATH } from "@/lib/app";
import { PLAN_LIMITS, type Plan } from "@/lib/plans";

/** Public marketing pages (ticket 013): paths and metadata shared by the landing and the pricing page. */
export const PRICING_PATH = "/cennik";
export const REGISTER_PATH = "/rejestracja";
/** Same as `PANEL_PATH` in lib/auth.ts (not imported: that module pulls in the database client). */
const PANEL_HOME_PATH = "/panel";

/** The landing's promise: hero heading and the shared (Open Graph) image. */
export const HERO_TITLE = "Wiesz, czego chce sala, zanim ktoś podejdzie do konsoli.";

export const SITE_DESCRIPTION =
  "Goście skanują kod QR, dodają utwory i lajkują propozycje innych. DJ widzi na żywo, czego chce sala. Bez aplikacji i bez logowania dla gości.";

/**
 * Title, description and Open Graph for a public page. Next.js replaces `openGraph` per segment instead of merging it,
 * so every page builds the full object here. URLs are relative and resolve against `metadataBase` from the root layout.
 */
export function publicPageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "pl_PL",
      siteName: APP_NAME,
      title,
      description,
      url: path,
    },
    // The image itself comes from app/(site)/opengraph-image.tsx (file-based metadata).
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * Plan chosen on the pricing page before registering (`/rejestracja?plan=pro`). Only values from this allowlist are
 * accepted; the redirect target after registration is picked here, never taken from the request.
 */
export const REGISTER_PLAN_PARAM = "plan";
const REGISTER_PLAN_INTENTS = ["pro"] as const;
export type RegisterPlanIntent = (typeof REGISTER_PLAN_INTENTS)[number];

export function parseRegisterPlanIntent(value: unknown): RegisterPlanIntent | null {
  return typeof value === "string" && (REGISTER_PLAN_INTENTS as readonly string[]).includes(value) ? (value as RegisterPlanIntent) : null;
}

/** Where a freshly registered DJ lands: the subscription page when they came for Pro, otherwise the panel. */
export function postRegisterPath(intent: RegisterPlanIntent | null): string {
  return intent === "pro" ? SUBSCRIPTION_PATH : PANEL_HOME_PATH;
}

export const REGISTER_PRO_PATH = `${REGISTER_PATH}?${REGISTER_PLAN_PARAM}=pro`;

export type PlanCta = { href: string; label: string };

/**
 * Where a plan's button on the pricing page leads. Visitors (`currentPlan` null) register (Pro carries `?plan=pro`); a logged-in DJ goes to
 * the panel (already on Free) or to the subscription page (upgrade to Pro, manage the subscription).
 */
export function planCta(plan: Plan, currentPlan: Plan | null): PlanCta {
  if (currentPlan === null) {
    return plan === "FREE"
      ? { href: REGISTER_PATH, label: "Załóż darmowe konto" }
      : { href: REGISTER_PRO_PATH, label: `Zacznij z ${PLAN_LIMITS.PRO.name}` };
  }
  if (plan === "FREE") {
    return currentPlan === "FREE" ? { href: PANEL_HOME_PATH, label: "Przejdź do panelu" } : { href: SUBSCRIPTION_PATH, label: "Zarządzaj planem" };
  }
  return currentPlan === "PRO"
    ? { href: SUBSCRIPTION_PATH, label: "Zarządzaj subskrypcją" }
    : { href: SUBSCRIPTION_PATH, label: `Przejdź na ${PLAN_LIMITS.PRO.name}` };
}
