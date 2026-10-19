import { BillingButton } from "@/components/panel/BillingButton";
import { formatRenewalDate, type BillingStatus, type ReturnStatus } from "@/lib/billing";
import { getPlanLimits, PLAN_MESSAGES } from "@/lib/plans";

const card = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900";

const BANNERS: Record<ReturnStatus, { tone: "success" | "info" | "error"; title: string; text: string }> = {
  success: {
    tone: "success",
    title: "Dziękujemy za zakup planu Pro!",
    text: "Płatność została przyjęta. Aktywacja planu może potrwać chwilę. Jeśli nadal widzisz plan Free, odśwież stronę za kilka sekund.",
  },
  cancel: { tone: "info", title: "Płatność anulowana", text: "Nic nie zostało pobrane. Możesz przejść na Pro w dowolnym momencie." },
  error: { tone: "error", title: "Nie udało się połączyć z płatnościami", text: "Spróbuj ponownie za chwilę." },
};

const TONES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  info: "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
  error: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
};

function Banner({ status, plan }: { status: ReturnStatus; plan: BillingStatus["plan"] }) {
  const banner =
    status === "success" && plan === "PRO"
      ? { ...BANNERS.success, text: "Plan Pro jest już aktywny. Możesz korzystać ze wszystkich funkcji bez limitów." }
      : BANNERS[status];
  return (
    <div role="status" data-testid={`billing-banner-${status}`} className={`rounded-2xl border px-4 py-3 sm:px-5 ${TONES[banner.tone]}`}>
      <p className="font-semibold">{banner.title}</p>
      <p className="mt-0.5 text-sm opacity-90">{banner.text}</p>
    </div>
  );
}

function FeatureList({ features }: { features: readonly string[] }) {
  return (
    <ul className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
      {features.map((feature) => (
        <li key={feature} className="flex gap-2">
          <span aria-hidden className="mt-0.5 font-bold text-violet-700 dark:text-violet-400">✓</span>
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

function NotConfigured({ text }: { text: string }) {
  return (
    <div
      role="note"
      data-testid="billing-not-configured"
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
    >
      <p className="font-semibold">Płatności nie są skonfigurowane</p>
      <p className="mt-0.5">{text}</p>
    </div>
  );
}

export type SubscriptionViewProps = {
  status: BillingStatus;
  /** `?status=` after returning from Stripe (banner), or null. */
  returnStatus: ReturnStatus | null;
  /** False without the STRIPE_* variables: "Płatności nie są skonfigurowane", no working buttons. */
  configured: boolean;
  checkoutAction: () => Promise<void>;
  portalAction: () => Promise<void>;
};

/** The subscription page body (`/panel/subskrypcja`): current plan, renewal date, Pro offer or subscription management. */
export function SubscriptionView({ status, returnStatus, configured, checkoutAction, portalAction }: SubscriptionViewProps) {
  const current = getPlanLimits(status.plan);
  const pro = getPlanLimits("PRO");
  const isPro = status.plan === "PRO";

  return (
    <div className="space-y-4">
      {returnStatus && <Banner status={returnStatus} plan={status.plan} />}

      <section className={card} aria-labelledby="current-plan">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Twój plan</p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="current-plan" data-testid="current-plan" className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {current.name}
          </h2>
          <p className="text-base font-semibold text-zinc-700 dark:text-zinc-300">{current.priceLabel}</p>
        </div>
        {isPro && (
          <p data-testid="plan-renews-at" className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {status.planRenewsAt ? (
              <>
                Odnowienie: <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{formatRenewalDate(status.planRenewsAt)}</strong>
              </>
            ) : (
              "Brak zaplanowanego odnowienia."
            )}
          </p>
        )}
        <FeatureList features={current.features} />

        {isPro && (
          <div className="mt-6 space-y-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            {configured ? (
              <>
                {status.hasCustomer && <BillingButton action={portalAction} label="Zarządzaj subskrypcją" variant="secondary" />}
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {status.hasCustomer
                    ? "W panelu Stripe zmienisz metodę płatności, pobierzesz faktury albo anulujesz subskrypcję."
                    : "Ten plan nie jest powiązany z subskrypcją w Stripe, więc nie ma czym zarządzać."}
                </p>
              </>
            ) : (
              <NotConfigured text="Zarządzanie subskrypcją jest chwilowo niedostępne. Spróbuj ponownie później." />
            )}
          </div>
        )}
      </section>

      {!isPro && (
        <section className={`${card} border-violet-200 ring-1 ring-violet-100 dark:border-violet-900 dark:ring-violet-950`} aria-labelledby="pro-offer">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="pro-offer" className="text-xl font-bold text-violet-700 dark:text-violet-400">
              Plan {pro.name}
            </h2>
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{pro.priceLabel}</p>
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{pro.tagline}</p>
          <FeatureList features={pro.features} />
          <div className="mt-6 space-y-3">
            {!configured && <NotConfigured text="Zmiana planu jest chwilowo niedostępna. Spróbuj ponownie później." />}
            <BillingButton action={checkoutAction} label={PLAN_MESSAGES.upgradeCta} disabled={!configured} />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Płatność kartą, BLIK-iem lub przez Przelewy24 w bezpiecznym oknie Stripe. Subskrypcję anulujesz w każdej chwili.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
