import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { PhoneMock, QrCard } from "@/components/site/Illustrations";
import { focusRing, primaryButton, secondaryButton } from "@/components/site/styles";
import { PLAN_LIMITS, formatEventAllowance } from "@/lib/plans";
import { PRICING_PATH, REGISTER_PATH, SITE_DESCRIPTION, publicPageMetadata } from "@/lib/site";

export const metadata: Metadata = publicPageMetadata({
  title: "ZagrajTo – życzenia muzyczne od gości na weselu",
  description: SITE_DESCRIPTION,
  path: "/",
});

const HERO_TITLE = "Wiesz, czego chce sala, zanim ktoś podejdzie do konsoli.";

const free = PLAN_LIMITS.FREE;
const pro = PLAN_LIMITS.PRO;
const freeEventsLabel = formatEventAllowance(free.maxEventStartsPerMonth).toLocaleLowerCase("pl");

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const STEPS = [
  {
    title: "Wystaw kod QR",
    text: "Tworzysz wydarzenie i drukujesz gotowy plakat A4. Stawiasz go przy parkiecie albo kładziesz na stołach.",
    icon: (
      <Icon>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
      </Icon>
    ),
  },
  {
    title: "Goście dodają i lajkują",
    text: "Skanują kod telefonem, wyszukują utwór i dodają go do listy albo lajkują to, co zgłosili inni. Bez aplikacji i bez logowania.",
    icon: (
      <Icon>
        <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7.1 4.5c2 0 3.7 1.1 4.9 2.8 1.2-1.7 2.9-2.8 4.9-2.8 3.5 0 5.7 3.4 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
      </Icon>
    ),
  },
  {
    title: "Grasz to, co sala chce",
    text: "Na tablicy widzisz utwory ułożone według lajków. Akceptujesz, odrzucasz albo oznaczasz jako zagrane, a goście widzą to od razu.",
    icon: (
      <Icon>
        <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
        <rect x="2.5" y="13.5" width="4.5" height="7" rx="1.5" />
        <rect x="17" y="13.5" width="4.5" height="7" rx="1.5" />
      </Icon>
    ),
  },
];

const BENEFITS = [
  {
    title: "Koniec z krzyczeniem przez muzykę",
    text: "Prośby trafiają na ekran, a nie do ucha w środku seta. Nie zdejmujesz słuchawek co trzy minuty.",
  },
  {
    title: "Widzisz, czego chce większość",
    text: "Pięć osób chce tego samego? Zobaczysz pięć lajków przy jednym utworze, a nie pięć karteczek na konsoli.",
  },
  {
    title: "Zero instalacji dla gości",
    text: "Lista otwiera się w przeglądarce na każdym telefonie, z Androidem i z iPhone’em. Wystarczy aparat.",
  },
  {
    title: "Decyzja zawsze należy do Ciebie",
    text: "Odrzucony utwór znika z listy gości. Gdy masz już plan na resztę nocy, zamykasz zgłoszenia jednym przyciskiem.",
  },
  {
    title: "Plakat gotowy do druku",
    text: "Kod QR i nazwa wydarzenia na arkuszu A4. Drukujesz przed wyjazdem i masz z głowy.",
  },
  {
    title: "Lista zostaje po imprezie",
    text: `Eksportujesz życzenia do CSV albo jako tekst i układasz z nich playlistę w Spotify czy folder w rekordbox (plan ${pro.name}).`,
  },
];

const FAQ = [
  {
    question: "Czy goście muszą coś instalować albo zakładać konto?",
    answer: "Nie. Skanują kod aparatem i lista otwiera się w przeglądarce. Żadnej aplikacji, żadnego logowania.",
  },
  {
    question: "Co, jeśli kilka osób zgłosi ten sam utwór?",
    answer: "Nie powstaje duplikat. Kolejne zgłoszenie tego samego utworu liczy się jako lajk, więc od razu widać, jak bardzo sala go chce.",
  },
  {
    question: "Czy muszę grać wszystko, co jest na liście?",
    answer: "Nie. Lista podpowiada, decyzja jest Twoja. Odrzucone utwory znikają z widoku gości, a zgłoszenia możesz w każdej chwili zamknąć.",
  },
  {
    question: "Ile to kosztuje?",
    answer: `Plan ${free.name} (${free.priceLabel}) obejmuje ${freeEventsLabel}. Plan ${pro.name} kosztuje ${pro.priceLabel}. Pełne porównanie znajdziesz w cenniku.`,
  },
];

function SectionHeading({ id, eyebrow, title, intro }: { id: string; eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold tracking-widest text-lime-300 uppercase">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl">
        {title}
      </h2>
      {intro && <p className="mt-3 text-lg text-pretty text-zinc-400">{intro}</p>}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-violet-600/30 blur-3xl" />
          <div className="absolute top-40 -right-40 h-80 w-80 rounded-full bg-fuchsia-500/25 blur-3xl" />
        </div>
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:pt-24 lg:pb-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm font-medium text-zinc-300 ring-1 ring-white/10">
              <span aria-hidden className="size-2 rounded-full bg-lime-300 shadow-[0_0_10px] shadow-lime-300" />
              Dla DJ-ów weselnych i eventowych
            </p>
            <h1 id="hero-title" className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
              {HERO_TITLE}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-pretty text-zinc-300 sm:text-xl">
              Goście skanują kod QR, dodają utwory i lajkują propozycje innych. Ty widzisz na żywo listę ułożoną według popularności, bez
              wołania przez muzykę i karteczek na konsoli.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={REGISTER_PATH} className={primaryButton}>
                Załóż darmowe konto
              </Link>
              <Link href={PRICING_PATH} className={secondaryButton}>
                Zobacz cennik
              </Link>
            </div>
            <p className="mt-4 text-sm text-zinc-400">
              Plan {free.name}: {freeEventsLabel} za {free.priceLabel}. Bez karty płatniczej.
            </p>
          </div>
          <div className="relative mx-auto flex w-full max-w-md justify-center sm:justify-end sm:pr-6 lg:max-w-none lg:pr-10">
            {/* The QR card hangs off the phone's left edge and overlaps only its frame, never the list on the screen. */}
            <div className="relative">
              <PhoneMock className="sm:w-[19rem]" />
              <QrCard className="absolute right-full bottom-8 hidden translate-x-4 sm:block" />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="jak-to-dziala" className="border-t border-white/10 bg-zinc-900/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionHeading
            id="jak-to-dziala"
            eyebrow="Jak to działa"
            title="Trzy kroki od plakatu do pełnego parkietu"
            intro="Ustawiasz wszystko przed imprezą w kilka minut. W trakcie tylko zerkasz na tablicę."
          />
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative rounded-3xl bg-zinc-900 p-6 ring-1 ring-white/10">
                <div className="flex items-center justify-between">
                  <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                    {step.icon}
                  </span>
                  <span aria-hidden className="text-5xl font-extrabold text-white/10">
                    {index + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-bold text-white">
                  <span className="sr-only">Krok {index + 1}: </span>
                  {step.title}
                </h3>
                <p className="mt-2 text-pretty text-zinc-400">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="korzysci">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionHeading
            id="korzysci"
            eyebrow="Dla DJ-ów weselnych"
            title="Mniej przepychanek przy konsoli, więcej ludzi na parkiecie"
          />
          <ul className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <li key={benefit.title} className="border-l-2 border-lime-300/70 pl-5">
                <h3 className="text-lg font-bold text-white">{benefit.title}</h3>
                <p className="mt-2 text-pretty text-zinc-400">{benefit.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="faq" className="border-t border-white/10 bg-zinc-900/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1fr_1.4fr]">
          <SectionHeading id="faq" eyebrow="Pytania" title="Zanim założysz konto" />
          <div className="divide-y divide-white/10 border-y border-white/10">
            {FAQ.map((item) => (
              <details key={item.question} className="group">
                <summary
                  className={`flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 text-left font-semibold text-white [&::-webkit-details-marker]:hidden ${focusRing}`}
                >
                  {item.question}
                  <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-white/5 text-lime-300 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="pb-5 text-pretty text-zinc-400">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="cta-koncowe" className="relative isolate overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-violet-700/40 via-fuchsia-600/20 to-transparent" />
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <h2 id="cta-koncowe" className="mx-auto max-w-3xl text-3xl font-extrabold tracking-tight text-balance text-white sm:text-5xl">
            Następne wesele zagraj z listą od gości.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-balance text-zinc-300">Konto zakładasz w minutę. Pierwsze wydarzenie uruchomisz jeszcze dziś.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={REGISTER_PATH} className={primaryButton}>
              Załóż darmowe konto
            </Link>
            <Link href={PRICING_PATH} className={secondaryButton}>
              Porównaj plany
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
