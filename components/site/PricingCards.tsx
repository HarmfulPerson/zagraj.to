import Link from "next/link";
import { Suspense } from "react";

import { focusRing } from "@/components/site/styles";
import { getCurrentDj } from "@/lib/auth";
import { PLAN_LIMITS, splitPriceLabel, type Plan } from "@/lib/plans";
import { planCta, type PlanCta } from "@/lib/site";

const PLAN_ORDER: readonly Plan[] = ["FREE", "PRO"];
const RECOMMENDED: Plan = "PRO";

/**
 * `variant` tells the static placeholder ("placeholder": visitor links shown while the session streams in) from the resolved button
 * ("account"). Only the resolved button gets the test id: during streaming both can be in the DOM at once.
 */
function CtaLink({ plan, cta, variant }: { plan: Plan; cta: PlanCta; variant: "placeholder" | "account" }) {
  const highlighted = plan === RECOMMENDED;
  return (
    <Link
      href={cta.href}
      data-testid={variant === "account" ? `plan-cta-${plan}` : undefined}
      data-variant={variant}
      className={`inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 text-base font-semibold transition ${focusRing} ${
        highlighted
          ? "bg-lime-300 text-zinc-950 shadow-[0_0_32px_-6px] shadow-lime-300/60 hover:bg-lime-200"
          : "text-white ring-1 ring-white/25 ring-inset hover:bg-white/10"
      }`}
    >
      {cta.label}
    </Link>
  );
}

async function AccountCta({ plan }: { plan: Plan }) {
  const dj = await getCurrentDj();
  return <CtaLink plan={plan} cta={planCta(plan, dj?.plan ?? null)} variant="account" />;
}

/** Free vs Pro, straight from `PLAN_LIMITS` (names, prices, bullets). */
export function PricingCards() {
  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2 md:items-stretch">
      {PLAN_ORDER.map((plan) => {
        const limits = PLAN_LIMITS[plan];
        const { amount, period } = splitPriceLabel(limits.priceLabel);
        const recommended = plan === RECOMMENDED;
        return (
          <section
            key={plan}
            aria-labelledby={`plan-${plan}`}
            data-testid={`plan-card-${plan}`}
            className={`relative flex flex-col rounded-3xl p-6 sm:p-8 ${
              recommended
                ? "bg-gradient-to-b from-violet-600/30 to-zinc-900 ring-2 ring-lime-300/80 shadow-2xl shadow-violet-900/50"
                : "bg-zinc-900 ring-1 ring-white/10"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id={`plan-${plan}`} className="text-2xl font-bold text-white">
                {limits.name}
              </h2>
              {recommended && (
                <span className="rounded-full bg-lime-300 px-3 py-1 text-xs font-bold tracking-wide text-zinc-950 uppercase">Polecany</span>
              )}
            </div>
            <p className="mt-2 text-pretty md:min-h-12 text-zinc-400">{limits.tagline}</p>
            <p className="mt-6 flex items-baseline gap-1" data-testid={`plan-price-${plan}`}>
              <span className="text-5xl font-extrabold tracking-tight text-white">{amount}</span>
              {period && <span className="text-lg font-medium text-zinc-400">{period}</span>}
            </p>
            <ul className="mt-6 flex-1 space-y-3" aria-label={`Co zawiera plan ${limits.name}`}>
              {limits.features.map((feature) => (
                <li key={feature} className="flex gap-3 text-zinc-200">
                  <svg viewBox="0 0 20 20" className="mt-0.5 size-5 shrink-0 text-lime-300" fill="currentColor" aria-hidden>
                    <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Suspense fallback={<CtaLink plan={plan} cta={planCta(plan, null)} variant="placeholder" />}>
                <AccountCta plan={plan} />
              </Suspense>
            </div>
          </section>
        );
      })}
    </div>
  );
}
