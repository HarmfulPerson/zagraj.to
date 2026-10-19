---
id: "013"
title: Landing i cennik
status: done
depends_on: ["003"]
attempts: 2
---

## Cel
Strona, która w kilka sekund tłumaczy DJ-owi, co dostaje, i prowadzi do rejestracji.

## Kryteria akceptacji
- [x] `/`: nagłówek z obietnicą, sekcja „Jak to działa” (3 kroki: QR → goście dodają i lajkują → grasz to, co sala chce), korzyści dla DJ-ów weselnych, CTA „Załóż darmowe konto”
- [x] `/cennik`: Free vs Pro zgodnie ze SPEC, ceny w PLN, CTA
- [x] Nagłówek z linkami: Cennik, Zaloguj, Załóż konto (dla zalogowanego: Panel)
- [x] Responsywne; metadane (title, description, Open Graph) po polsku
- [x] Teksty z cennika pobierane z `lib/plans.ts`, jeśli już istnieje; w przeciwnym razie z jednej stałej
- [x] e2e: z landingu przez CTA na `/rejestracja`

## Log

### Developer (próba 1)
**Co zrobiono**
- Publiczne strony w grupie tras `app/(site)/` ze wspólnym layoutem (zawsze ciemny motyw, link „Przejdź do treści”, `<main id="tresc">`, stopka).
- `/`: hero z obietnicą („Wiesz, czego chce sala, zanim ktoś podejdzie do konsoli.”), CTA „Załóż darmowe konto” → `/rejestracja` i „Zobacz cennik”, mikrotekst z planem Free liczony z `PLAN_LIMITS`; ilustracje w czystym SVG/CSS (telefon gościa z listą życzeń i lajkami, karta z dekoracyjnym wzorem QR); „Jak to działa” – dokładnie 3 kroki; 6 korzyści dla DJ-ów weselnych (koniec z krzyczeniem próśb, widać, czego chce większość, zero instalacji, kontrola DJ-a, plakat A4, eksport do CSV/tekstu pod Spotify/rekordbox – oznaczony jako Pro); krótkie FAQ (`<details>`); końcowe CTA.
- `/cennik`: karty Free i Pro generowane z `PLAN_LIMITS` (nazwa, tagline, cena, punkty), Pro oznaczony „Polecany”. CTA: gość → `/rejestracja`; zalogowany Free → Free: `/panel`, Pro: `/panel/subskrypcja` („Przejdź na Pro”); zalogowany Pro → `/panel/subskrypcja`. Pod kartami krótkie pytania (limit Free liczony z `maxRequestsPerEvent`).
- Nagłówek `components/site/SiteHeader.tsx`: logo, Cennik, Zaloguj, Załóż konto; dla zalogowanego „Panel”. Sesja czytana tylko w małym fragmencie w `<Suspense>` z fallbackiem = linki dla gościa (statyczny shell, SEO, większość ruchu to goście). `next build` pokazuje `/` i `/cennik` jako Partial Prerender. Na 360 px nawigacja mieści się w jednej linii (kompaktowe logo i odstępy), bez menu rozwijanego.
- `lib/plans.ts`: punkty planów nie są już wpisane na sztywno – `describePlanFeatures()` buduje je z wartości limitów (`formatEventAllowance`, `polishPlural` z poprawną odmianą 1/2–4/5+/12–14); dodany `splitPriceLabel()` (wyświetlanie „25 zł” + „/mies.” bez gubienia tekstu z `priceLabel`). Teksty wyjściowe dla obecnych planów są identyczne jak wcześniej (strona subskrypcji bez zmian).
- Metadane: w root layoucie `metadataBase` z `getAppUrl()`, domyślny Open Graph; `lib/site.ts` → `publicPageMetadata()` (title, description, canonical, OG `pl_PL`, twitter) dla `/` i `/cennik`. `lang="pl"` bez zmian.
- `globals.css`: `.site-theme` dopisane do reguły ciemnego tła html/body (overscroll na telefonach).

**Test `home.spec.ts`**: zmieniłem asercję nagłówka h1 z „ZagrajTo” na nową obietnicę, bo landing ma teraz h1 z hasłem sprzedażowym (nazwa jest w logo w nagłówku). Test nie jest słabszy: dalej sprawdza tytuł i `lang="pl"`, a dodatkowo logo w `banner` oraz `og:title`/`og:locale`.

**Kontrola wizualna** (dev na porcie 3200, `scripts/ui-shots.mjs / /cennik`, 4 viewporty + wariant zalogowany z COOKIE na `/cennik` dla 360 i desktop):
- Iteracja 1: na 360 px poziomy overflow 22 px (nagłówek za szeroki) → mniejsze logo i odstępy linków na telefonie; telefon w hero był za mały na desktopie, a karta QR zasłaniała okładki → telefon większy od `sm`, przesunięty w prawo, karta QR po lewej; sierotka w podtytule końcowego CTA → `text-balance`.
- Iteracja 2: brak overflow na wszystkich viewportach; na mobile tagline Pro miał zbędny `min-h` → tylko od `md`. Sprawdzony wariant zalogowany: „Panel” w nagłówku, CTA „Przejdź do panelu”/„Przejdź na Pro”. Serwer zatrzymany.

**Zmienione/nowe pliki**: `app/layout.tsx`, `app/page.tsx` (usunięty, zastąpiony przez `app/(site)/page.tsx`), `app/(site)/layout.tsx`, `app/(site)/cennik/page.tsx`, `app/globals.css`, `components/site/{SiteHeader,SiteFooter,Logo,Illustrations,PricingCards}.tsx`, `components/site/styles.ts`, `lib/plans.ts`, `lib/site.ts`, `tests/unit/plans.test.ts`, `tests/unit/site.test.ts`, `tests/e2e/home.spec.ts`.

**Testy**: unit – punkty planów z limitów (także dla zmienionych wartości), odmiana, `splitPriceLabel`, `publicPageMetadata`, `planCta`. e2e – landing (3 kroki, brak overflow na 360 px) → CTA → `/rejestracja`; linki nagłówka dla gościa; cennik pokazuje oba plany, ceny i punkty z `lib/plans.ts` („25 zł”), Pro „Polecany”; zalogowany DJ widzi „Panel”, CTA Pro prowadzi na `/panel/subskrypcja`. `npm run check` ✅ (383 testy), pełne `npm run e2e` ✅ (33/33), `next build` ✅.

Uwaga: stopka jest statyczna i dla zalogowanego nadal pokazuje „Zaloguj się/Załóż konto” (świadomie, żeby nie dokładać kolejnego dynamicznego fragmentu). Brak obrazka OG (og:image) – można dodać później.

### Tester (próba 1)
**Wyniki**
- `npm run check` ✅ (lint, typecheck, 383 testy unit).
- `npm run e2e` (pełne) ❌ – 32/33, padł `tests/e2e/home.spec.ts:45` („pricing shows Free and Pro…”):
  `Error: strict mode violation: getByTestId('plan-cta-FREE') resolved to 2 elements` (oba `<a href="/rejestracja" data-testid="plan-cta-FREE">`).
- Powtórka `npx playwright test tests/e2e/home.spec.ts --repeat-each=5`: 4–5 z 25 przebiegów czerwonych, na zmianę w teście `:45` (linia 54) i `:61` („logged-in DJ…”, linia 70: `getByTestId('plan-cta-FREE')` → 2 elementy). Test jest **niestabilny (flaky)**.
- Przyczyna: w `components/site/PricingCards.tsx` fallback `<Suspense>` (`<CtaLink plan cta={planCta(plan, null)} />`) i docelowy `AccountCta` renderują ten sam `data-testid`. Podczas streamingu (PPR) w DOM przez chwilę są oba elementy (ukryty segment z gotową treścią + fallback), a `getByTestId` liczy też ukryte węzły, więc strict mode wybucha w zależności od czasu.
- `npm run build` ✅ (`/` i `/cennik` jako Partial Prerender).

**Kryteria**
- ✅ `/`: h1 z obietnicą, sekcja „Jak to działa” z dokładnie 3 krokami (QR → goście dodają i lajkują → grasz to, co sala chce), 6 korzyści dla DJ-ów weselnych, CTA „Załóż darmowe konto” (hero i sekcja końcowa).
- ✅ `/cennik`: Free vs Pro zgodnie ze SPEC (1 wydarzenie/mies., 100 życzeń, bez eksportu vs 25 zł/mies., bez limitów, eksport, własny tekst na plakacie), ceny w PLN, CTA.
- ✅ Nagłówek: Cennik, Zaloguj, Załóż konto; dla zalogowanego „Panel” (e2e + zrzut 360 px z cookie).
- ✅ Responsywność (4 viewporty, brak poziomego overflow, także zalogowany 360 px); metadane po polsku: title, description, canonical, OG `pl_PL`, twitter (unit + e2e).
- ✅ Teksty cennika z `lib/plans.ts` – grep po `components/site` i `app/(site)` nie znajduje wpisanych na sztywno „25”/„100”/„zł” (poza `QR_SIZE = 25` w ilustracji, niezwiązane). Punkty planów budowane z limitów (`describePlanFeatures`), testy na zmienione wartości.
- ✅ e2e: z landingu przez CTA na `/rejestracja` (test na telefonie przechodzi stabilnie).
- Zmiana asercji h1 w `home.spec.ts` (z „ZagrajTo” na hasło): uzasadniona, test nie osłabiony – nadal title i `lang`, doszło logo w `banner` i `og:title`/`og:locale`.
- Przeniesienie `app/page.tsx` do `app/(site)/`: `app/panel/layout.tsx` i `app/e/layout.tsx` bez zmian, pozostałe 32 testy e2e (panel, gość, plakat, plany, Stripe) zielone.

**Do naprawy (FAIL z powodu niestabilnego e2e)**
1. `components/site/PricingCards.tsx`: nie nadawaj `data-testid` w fallbacku `<Suspense>` – np. `CtaLink` z propem `testId?: boolean` (domyślnie true), a w fallbacku `testId={false}`; ewentualnie w testach zawęź do widocznego elementu (`page.getByTestId("plan-cta-FREE").filter({ visible: true })` / `getByRole("link")` w karcie). Lepsza poprawka w aplikacji, bo nie wymaga pamiętania o tym w każdym teście.
2. Zweryfikuj `npx playwright test tests/e2e/home.spec.ts --repeat-each=10` – musi być 100% zielone – i pełne `npm run e2e`.

### Reviewer (próba 1)
**Krytyczne**
1. Niestabilny e2e cennika (opis i poprawka w raporcie testera): zduplikowany `data-testid="plan-cta-*"` w fallbacku i treści `<Suspense>` w `components/site/PricingCards.tsx`. Kryterium „e2e” formalnie spełnione, ale zestaw e2e losowo czerwony = nie do zamknięcia.

**Bezpieczeństwo**: brak nowych API routes; sesja czytana przez istniejące `getCurrentDj()` tylko w małych fragmentach pod `<Suspense>`; brak sekretów (`metadataBase` z publicznego `NEXT_PUBLIC_APP_URL`). OK.

**Zgodność ze SPEC / copy**: teksty po polsku, naturalne, bez anglicyzmów poza nazwami planów Free/Pro (zgodne ze SPEC). Sprawdzone obietnice: brak duplikatów → głos (SPEC), odrzucone znikają u gości (SPEC), lista pełna → nadal lajki (`lib/requests.ts`, e2e `plans.spec.ts`), anulowanie w panelu (Customer Portal w `lib/billing.ts`), płatności Stripe, „goście widzą od razu” (polling 3 s – akceptowalne). Brak obietnic z „Poza MVP”: Spotify/rekordbox pojawia się tylko jako ręczne ułożenie playlisty z eksportu CSV/tekstu (plan Pro) – nie sugeruje integracji. Brak overclaimów.

**Dostępność**: jeden h1 na stronę, h2 → h3 w kolejności; landmarki `banner`, `nav` (z etykietami „Główne menu”/„Stopka”), `main#tresc`, `contentinfo`; skip link; logo z `aria-label` zawierającym widoczną nazwę; ilustracje jako `role="img"` z opisem; numery kroków `aria-hidden` + sr-only „Krok N”. OK.

**Wizualnie** (dev 3200, `ui-shots / /cennik`, 4 viewporty + zalogowany 360/desktop): spójnie, czytelnie, bez overflow; nagłówek zalogowanego: Cennik + Panel; CTA cennika dla zalogowanego Free „Przejdź do panelu”/„Przejdź na Pro”. Nic kompromitującego.

**Drobne**
- Karta QR w hero na desktopie/tablecie zasłania okładki 2.–4. pozycji w makiecie telefonu – dekoracyjnie OK, ale można ją przesunąć niżej/bardziej w lewo.
- „Zacznij z Pro” prowadzi na `/rejestracja`, po której DJ ma Free – rozważ `?plan=pro` lub dopisek, że Pro włącza się w panelu.
- Mikrotekst „Plan Free: 1 wydarzenie w miesiącu za 0 zł” brzmi nieco sztucznie – np. „Plan Free za 0 zł: 1 wydarzenie w miesiącu.”
- Nagłówek przy streamingu sesji przez chwilę pokazuje zalogowanemu „Zaloguj/Załóż konto” (świadomy kompromis PPR); stopka dla zalogowanego też – do rozważenia później.
- Brak `og:image`.

### Developer (próba 2)
**Naprawione zgłoszenia**
1. **Krytyczne, niestabilny e2e cennika.** Problem był w aplikacji: w `components/site/PricingCards.tsx` `CtaLink` dostał prop `variant: "placeholder" | "account"`. Fallback `<Suspense>` ma teraz `data-variant="placeholder"` i **nie ma** `data-testid`. `data-testid="plan-cta-*"` i `data-variant="account"` ma tylko przycisk po odczytaniu sesji. Podczas streamingu w DOM nie ma już dwóch elementów z tym samym test id. W `tests/e2e/home.spec.ts` asercje są mocniejsze, a nie słabsze: najpierw czekają na `data-variant="account"`, potem sprawdzają `href`. Dla zalogowanego sprawdzają też teksty „Przejdź do panelu” i „Przejdź na Pro” oraz `href` przycisku Pro przed kliknięciem.
2. **Drobne, „Zacznij z Pro” dla gościa.** Teraz prowadzi na `/rejestracja?plan=pro`, a po rejestracji DJ trafia na `/panel/subskrypcja`. Bez otwartego przekierowania: `lib/site.ts` → `parseRegisterPlanIntent()` przepuszcza tylko wartości z allowlisty (`"pro"`), a `postRegisterPath()` wybiera stałą ścieżkę (`SUBSCRIPTION_PATH` albo `/panel`). Adres przekierowania nigdy nie pochodzi z żądania. `app/rejestracja/page.tsx` czyta `searchParams` w małym fragmencie pod `<Suspense fallback={null}>`. Ten fragment dokłada do formularza ukryte pole `plan` i komunikat „Po założeniu konta przejdziesz do aktywacji planu Pro.”. `RegisterForm` przyjmuje `children` (dodatkowe pola), a `registerAction` w `app/auth-actions.ts` waliduje `plan` i przekierowuje przez `postRegisterPath`. Logowanie się nie zmieniło.
3. **Drobne, karta QR w hero.** Na zrzutach desktop i tablet karta zasłaniała okładki pozycji 2–5 w makiecie telefonu. Teraz jest pozycjonowana względem telefonu (`right-full` + `translate-x-4`) i nachodzi tylko na ramkę, więc lista na ekranie jest w całości widoczna. Na telefonie karta nadal jest ukryta.

**Zmienione pliki**: `components/site/PricingCards.tsx`, `lib/site.ts`, `app/auth-actions.ts`, `components/auth/RegisterForm.tsx`, `app/rejestracja/page.tsx`, `app/(site)/page.tsx`, `tests/unit/site.test.ts`, `tests/e2e/home.spec.ts`.

**Testy**
- Unit: `planCta("PRO", null)` → `/rejestracja?plan=pro`. Allowlista `parseRegisterPlanIntent` odrzuca `"PRO"`, `"free"`, `" pro"`, URL-e, `//evil`, tablice i `null`. `postRegisterPath` zwraca subskrypcję tylko dla `"pro"`.
- e2e (nowe): gość klika „Zacznij z Pro” → `/rejestracja?plan=pro` → rejestracja → `/panel/subskrypcja`; `?plan=https://evil.example` jest ignorowany (brak komunikatu, przekierowanie na `/panel`).
- `npx playwright test tests/e2e/home.spec.ts --repeat-each=10` ✅ 70/70.
- `npm run check` ✅ (385 testów unit).
- Pełne `npm run e2e` ✅ dwa razy z rzędu (35/35, 35/35).
- Wizualnie: dev na 3200, `node scripts/ui-shots.mjs / /cennik`. Desktop, tablet-landscape i phone-landscape: karta QR nie zasłania listy, brak overflow. Serwer zatrzymany.

Pozostałe drobne uwagi reviewera (mikrotekst Free, nagłówek i stopka przy streamingu sesji, `og:image`) są poza zakresem zgłoszonych poprawek i nie były ruszane.

### Tester (próba 2)
**Wyniki**
- `npx playwright test tests/e2e/home.spec.ts --repeat-each=10` ✅ 70/70 (wcześniej 4–5 czerwonych na 25).
- Pełne `npm run e2e` ✅ dwa razy z rzędu: 35/35, 35/35.
- `npm run check` ✅ (lint, typecheck, 385 testów unit w 35 plikach).
- `git diff tests/`: zmienione tylko `tests/e2e/home.spec.ts` i `tests/unit/plans.test.ts` (same dopisane testy) oraz nowy `tests/unit/site.test.ts`. Żadna asercja nie została osłabiona. W cenniku testy czekają na `data-variant="account"` i dopiero wtedy sprawdzają `href`. Dla zalogowanego doszły teksty „Przejdź do panelu”/„Przejdź na Pro”. Pozostałe pliki e2e i unit są bez zmian.
- Przyczyna flaky usunięta w aplikacji: w `components/site/PricingCards.tsx` fallback `<Suspense>` nie ma już `data-testid` (`variant="placeholder"`).

**Kryteria**
- ✅ `/`: h1 z obietnicą, 3 kroki, korzyści, CTA „Załóż darmowe konto” (e2e + zrzuty).
- ✅ `/cennik`: Free vs Pro z `PLAN_LIMITS`, ceny w PLN, CTA (gość Free → `/rejestracja`, Pro → `/rejestracja?plan=pro`; zalogowany → panel/subskrypcja).
- ✅ Nagłówek: Cennik, Zaloguj, Załóż konto / Panel (e2e).
- ✅ Responsywność i metadane PL. `ui-shots` na 4 viewportach dla `/`, `/cennik` i `/rejestracja?plan=pro`: bez overflow, bez błędów konsoli i bez HTTP ≥ 400.
- ✅ Teksty cennika z `lib/plans.ts`.
- ✅ e2e: z landingu przez CTA na `/rejestracja`. Doszły e2e ścieżki Pro (`?plan=pro` → rejestracja → `/panel/subskrypcja`) i odrzucenia `?plan=https://evil.example` (→ `/panel`).

**Wizualnie** (dev 3200, serwer zatrzymany): na desktopie i tablecie karta QR stoi po lewej od telefonu i nachodzi tylko na ramkę. Wszystkie pozycje listy (okładki, tytuły, lajki) są widoczne. Na phone-landscape karta nie zasłania listy. `/rejestracja?plan=pro` (360 i desktop): fioletowa notka „Po założeniu konta przejdziesz do aktywacji planu Pro.” stoi nad przyciskiem „Załóż konto”, jest czytelna i spójna z formularzem.

### Reviewer (próba 2)
**Krytyczne**: brak.

**Bezpieczeństwo, przekierowanie `?plan=pro`**
- `parseRegisterPlanIntent()` (`lib/site.ts`) przyjmuje wyłącznie string równy `"pro"` z allowlisty. Odrzuca wielkość liter, spacje, URL-e, `//host`, tablice (`?plan=pro&plan=pro` → tablica → `null`) i inne typy (unit).
- `postRegisterPath()` zwraca tylko stałe `SUBSCRIPTION_PATH` albo `/panel`. Cel `redirect()` w `registerAction` nigdy nie pochodzi z żądania, więc nie ma otwartego przekierowania.
- Ukryte pole `plan` jest walidowane po stronie serwera tą samą funkcją. Jeśli ktoś je zmieni, najwyżej trafi na `/panel` albo na stronę subskrypcji, którą i tak widzi każdy zalogowany DJ. Nie daje to żadnych uprawnień ani planu: Pro włącza się dopiero przez Stripe.
- Logika rejestracji bez zmian: walidacja zod (`registerSchema`), hashowanie, sesja (`startDjSession`). `loginAction` nie jest ruszany.
- Wartość z `searchParams` trafia do DOM tylko jako zwalidowane `"pro"`. Notka używa stałej `PLAN_LIMITS.PRO.name`, więc nie ma ryzyka XSS. Istniejące e2e auth (rejestracja/logowanie w innych specach) są zielone.
- `RegisterForm` przyjmuje `children` renderowane w formularzu. Po błędzie walidacji (re-render przez `useActionState`) pole z serwerowego fragmentu zostaje, bo jest częścią drzewa RSC.

**Zgodność / jakość**: poprawka flaky jest w źródle (aplikacja), a nie w testach. Testy są mocniejsze. Teksty po polsku. Nie dodano nic spoza zakresu, a `?plan=pro` to realizacja drobnej uwagi z próby 1. `PlanIntentField` pod `<Suspense fallback={null}>` jest zgodny z PPR.

**Drobne** (na później)
- Notka na rejestracji obiecuje „aktywację planu Pro”. DJ trafia na stronę subskrypcji i sam musi kliknąć przejście na Pro. Brzmi to OK, ale można dopisać „(płatność w następnym kroku)”.
- Nadal aktualne z próby 1: mikrotekst Free w hero, nagłówek i stopka przy streamingu sesji, brak `og:image`.

### Orkiestrator
Próba 2: tester PASS (home.spec 70/70), reviewer APPROVE. Drobne uwagi (og:image, nagłówek/stopka podczas streamingu sesji, mikrocopy) przekazane do ticketu 014. Ticket zamknięty.
