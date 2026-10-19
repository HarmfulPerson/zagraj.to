import type { Metadata } from "next";

import { PricingCards } from "@/components/site/PricingCards";
import { PLAN_LIMITS } from "@/lib/plans";
import { PRICING_PATH, publicPageMetadata } from "@/lib/site";

const free = PLAN_LIMITS.FREE;
const pro = PLAN_LIMITS.PRO;

export const metadata: Metadata = publicPageMetadata({
  title: "Cennik | ZagrajTo",
  description: `Plan ${free.name} za ${free.priceLabel} na start i ${pro.name} za ${pro.priceLabel} dla DJ-ów, którzy grają co weekend. Ceny w złotówkach, bez umów.`,
  path: PRICING_PATH,
});

const requestLimit = free.maxRequestsPerEvent;

const QUESTIONS = [
  {
    question: `Co się stanie, gdy skończy się limit w planie ${free.name}?`,
    answer:
      requestLimit === null
        ? "Plan nie ma limitu życzeń."
        : `Gdy lista dobije do ${requestLimit} życzeń, goście nadal lajkują utwory, ale nie dodają nowych. Kolejne wydarzenie w tym samym miesiącu uruchomisz po przejściu na ${pro.name}.`,
  },
  {
    question: "Czy goście za coś płacą?",
    answer: "Nie. Dla gości ZagrajTo jest zawsze darmowe i nie wymaga konta ani aplikacji.",
  },
  {
    question: `Jak zrezygnować z planu ${pro.name}?`,
    answer: "Subskrypcją zarządzasz w panelu. Tam też ją anulujesz, bez dzwonienia i bez pisania maili.",
  },
];

export default function PricingPage() {
  return (
    <div className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[32rem] w-[56rem] -translate-x-1/2 rounded-full bg-violet-600/25 blur-3xl" />
      <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-widest text-lime-300 uppercase">Cennik</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-balance text-white sm:text-5xl">
            Zacznij za darmo. Przejdź na {pro.name}, gdy grasz co weekend.
          </h1>
          <p className="mt-4 text-lg text-pretty text-zinc-300">Ceny w złotówkach, bez umów i okresu wypowiedzenia. Płatności obsługuje Stripe.</p>
        </div>
        <div className="mt-12">
          <PricingCards />
        </div>
        <section aria-labelledby="cennik-pytania" className="mx-auto mt-20 max-w-3xl">
          <h2 id="cennik-pytania" className="text-2xl font-bold text-white">
            Najczęstsze pytania
          </h2>
          <dl className="mt-6 divide-y divide-white/10 border-y border-white/10">
            {QUESTIONS.map((item) => (
              <div key={item.question} className="py-5">
                <dt className="font-semibold text-white">{item.question}</dt>
                <dd className="mt-2 text-pretty text-zinc-400">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
