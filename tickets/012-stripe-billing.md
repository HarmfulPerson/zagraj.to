---
id: "012"
title: Subskrypcja przez Stripe
status: done
depends_on: ["011"]
attempts: 1
---

## Cel
DJ może kupić plan Pro i zarządzać subskrypcją.

## Kryteria akceptacji
- [x] `/panel/subskrypcja`: aktualny plan, data odnowienia, przycisk „Przejdź na Pro” (Stripe Checkout, tryb subscription, PLN) albo „Zarządzaj subskrypcją” (Customer Portal)
- [x] Webhook `POST /api/stripe/webhook` z weryfikacją podpisu obsługuje `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` i aktualizuje `plan`, `stripeCustomerId`, `stripeSubscriptionId`, `planRenewsAt`
- [x] Webhook jest idempotentny (ponowne doręczenie tego samego zdarzenia niczego nie psuje)
- [x] Zmienne `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO` w `.env.example`
- [x] Testy z zamockowanym SDK Stripe: każde zdarzenie, zły podpis daje 400
- [x] Bez kluczy w env strona subskrypcji pokazuje „Płatności nie są skonfigurowane” zamiast się wysypywać

## Uwagi
Kod i testy da się zrobić bez kluczy. Ręczny test end-to-end wymaga konta Stripe w trybie testowym. To zostaw człowiekowi i opisz w Logu kroki (utworzenie produktu i ceny, `stripe listen`), ale **nie** ustawiaj `needs-human`, jeśli testy z mockami przechodzą.

## Log

### Developer (próba 1)

**Co zrobiono**
- Zainstalowano oficjalny SDK `stripe` (v23, API `2026-09-30`).
- `lib/stripe.ts`: `getBillingConfig()` / `isBillingConfigured()` (wymagane wszystkie trzy: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`; puste = brak) oraz `getStripe()` tworzący klienta leniwie (nigdy przy imporcie, więc aplikacja działa bez kluczy).
- `lib/billing.ts`: cała logika z wstrzykiwanym klientem Stripe (typ `BillingStripe`, tylko używane metody), więc testy podają atrapę:
  - `createCheckoutSession`: `mode: "subscription"`, cena `STRIPE_PRICE_PRO`, `quantity: 1`, ponowne użycie `stripeCustomerId` albo utworzenie klienta (email + `metadata.userId`, zapis warunkowy `updateMany ... stripeCustomerId: null` na wypadek dwóch kliknięć), `client_reference_id` = id DJ-a, `metadata.userId` i `subscription_data.metadata.userId`, `success_url`/`cancel_url` = `${NEXT_PUBLIC_APP_URL}/panel/subskrypcja?status=success|cancel` (helper `getAppUrl`), `locale: "pl"`. DJ z planem Pro nie dostaje drugiego Checkoutu.
  - `createPortalSession`: Customer Portal dla `stripeCustomerId` DJ-a, `return_url` = strona subskrypcji, `locale: "pl"`.
  - Webhook: `handleStripeWebhook` (brak nagłówka `Stripe-Signature` → 400 `MISSING_SIGNATURE`; zły podpis / zmienione body → 400 `INVALID_SIGNATURE`; surowe body przez `await request.text()` i `stripe.webhooks.constructEvent`; błąd przetwarzania → 500 `WEBHOOK_FAILED` bez szczegółów, log `console.error`, Stripe ponawia; nieznane zdarzenia → 200 i ignorowane).
  - `checkout.session.completed` (tylko `mode=subscription`): DJ z `client_reference_id` (albo `metadata.userId`), pobranie subskrypcji z Stripe i zapis `stripeCustomerId`, `stripeSubscriptionId`, `plan`, `planRenewsAt`.
  - `customer.subscription.updated`: `active`/`trialing` → PRO z `planRenewsAt` = koniec okresu; `canceled`/`unpaid`/`incomplete_expired` (oraz `incomplete`, `paused`) → FREE, czyszczone `stripeSubscriptionId` i `planRenewsAt`; **`past_due` → zostaje PRO** (Stripe jeszcze ponawia płatność; gdy się podda, subskrypcja przechodzi w `canceled`/`unpaid` i przyjdzie kolejne `updated`). DJ szukany po `stripeCustomerId`, awaryjnie po `metadata.userId`.
  - `customer.subscription.deleted` → FREE, czyszczone id subskrypcji i data odnowienia.
  - Koniec okresu: `items.data[].current_period_end` (nowe wersje API), awaryjnie `subscription.current_period_end` (starsze).
  - **Idempotencja i kolejność (decyzja):** dla `checkout.session.completed` i `customer.subscription.updated` payload jest tylko wyzwalaczem: handler pobiera aktualną subskrypcję z Stripe (`subscriptions.retrieve`) i zapisuje jej bieżący stan. Ponowne doręczenie albo zdarzenia w złej kolejności zawsze kończą się stanem, jaki Stripe ma teraz. `deleted` jest stanem końcowym (anulowanej subskrypcji nie da się wznowić), więc jego payload stosujemy wprost. Zapisy to bezwzględne wartości (nie inkrementy). Dodatkowo: nieaktywna subskrypcja obniża plan tylko wtedy, gdy jest bieżącą subskrypcją DJ-a, więc koniec starej subskrypcji nie anuluje nowej. Nieznany klient → 200 z ostrzeżeniem w logu (bez ponawiania).
- `app/api/stripe/webhook/route.ts`: `POST`, bez sesji (uwierzytelnia podpis). Route handlery `POST` nigdy nie są cache'owane; `proxy.ts` ma matcher tylko `/panel` i `/e`, więc webhook jest poza auth proxy. Bez kluczy → 503 (Stripe ponowi po skonfigurowaniu).
- `app/panel/billing-actions.ts`: server actions `startCheckoutAction` i `openPortalAction`: bez wejścia, zawsze na koncie zalogowanego DJ-a (`requireDj` → przekierowanie na `/logowanie`), bez kluczy wracają na stronę, błąd Stripe → `?status=error`, sukces → `redirect` na URL Stripe.
- `/panel/subskrypcja` (`app/panel/subskrypcja/page.tsx` + `components/panel/SubscriptionView.tsx`, `components/panel/BillingButton.tsx`): aktualny plan z `lib/plans.ts` (nazwa, cena, funkcje), data odnowienia po polsku w czasie Europe/Warsaw („Odnowienie: 19 listopada 2026”), Free → karta Pro 25 zł/mies. i „Przejdź na Pro”, Pro → „Zarządzaj subskrypcją” (tylko gdy jest klient Stripe). Bez kluczy: „Płatności nie są skonfigurowane”, przycisk upgrade wyłączony, portalu brak. Banery po powrocie: `?status=success` („Aktywacja planu może potrwać chwilę…”, a jeśli webhook już przyszedł: „Plan Pro jest już aktywny”), `?status=cancel` („Nic nie zostało pobrane”), `?status=error`. Przycisk pokazuje „Przekierowuję do płatności…” w trakcie.
- Nagłówek panelu: odznaka planu już linkowała do `/panel/subskrypcja` (ticket 011), bez zmian.
- `.env.example`: trzy nowe zmienne z komentarzami (puste wartości, żadnych prawdziwych kluczy). `.env.local` nietknięty.

**Zmienione / nowe pliki**
- nowe: `lib/stripe.ts`, `lib/billing.ts`, `app/api/stripe/webhook/route.ts`, `app/panel/billing-actions.ts`, `app/panel/subskrypcja/page.tsx`, `components/panel/SubscriptionView.tsx`, `components/panel/BillingButton.tsx`
- nowe testy: `tests/unit/billing.test.ts`, `tests/unit/subscription-view.test.tsx`, `tests/integration/stripe-webhook-api.test.ts`, `tests/integration/billing-sessions.test.ts`, `tests/e2e/subscription.spec.ts`
- zmienione: `.env.example`, `package.json`, `package-lock.json` (`stripe`), `tests/e2e/db-helpers.ts` (`setDjPlan` przyjmuje opcjonalne `planRenewsAt`)

**Jak przetestowano**
- Testy z zamockowanym SDK (bez sieci i kluczy). Podpisy weryfikuje prawdziwe `stripe.webhooks.constructEvent` (czysta kryptografia) z testowym sekretem i `generateTestHeaderString`; `subscriptions.retrieve`, `customers.create`, `checkout.sessions.create`, `billingPortal.sessions.create` to `vi.fn`.
  - webhook (19 testów): brak podpisu 400, zły sekret / śmieciowy nagłówek 400, zmienione body 400, brak konfiguracji 503, `checkout.session.completed` (client_reference_id i fallback `metadata.userId`, sesja `payment` ignorowana), podwójne doręczenie = ten sam stan, `updated` active/trialing → PRO z nową datą, `past_due` → PRO, `canceled`/`unpaid`/`incomplete_expired` → FREE, późne starsze zdarzenie nie nadpisuje bieżącego stanu, `deleted` ×2 → FREE, usunięcie starej subskrypcji nie rusza nowej, zdarzenie innego klienta zmienia tylko jego DJ-a, nieznany klient 200, nieznane zdarzenie 200, błąd przetwarzania 500 bez szczegółów.
  - checkout/portal (10 testów): wymagane logowanie (redirect na `/logowanie`, Stripe niewołany), dokładne parametry Checkoutu i Portalu, utworzenie i zapis klienta, ponowne użycie klienta, tylko własne konto, Pro bez drugiego Checkoutu, bez kluczy powrót na stronę, błąd Stripe → `?status=error`.
  - widok (5 testów, `renderToStaticMarkup`): bez kluczy komunikat i wyłączony przycisk, Free/Pro, data po polsku, banery.
  - jednostkowe: mapowanie statusów, koniec okresu (oba kształty API), formatowanie daty, `?status=`, konfiguracja env.
- e2e `tests/e2e/subscription.spec.ts` (serwer Playwright bez zmiennych Stripe): Free → „Płatności nie są skonfigurowane” i wyłączony „Przejdź na Pro” (wejście przez odznakę planu), Pro → „Odnowienie: 19 listopada 2026”, banery success/cancel, wymagane logowanie, webhook bez podpisu odrzucony.
- `npm run check`: lint + typecheck + 375 testów przechodzi. Pełne `npm run e2e`: 29/29.
- Kontrola wizualna (dev na porcie 3200, bez kluczy): `/panel/subskrypcja` dla DJ-a Free i Pro (plan + `planRenewsAt` ustawione bezpośrednio w bazie), z banerami `?status=success`/`cancel`, w tablet-landscape (1180×820) i telefonie 360 px. Układ czytelny, bez przepełnień, przyciski min. 48 px. Poprawione po oglądzie: dla Pro bez kluczy osobny komunikat („Zarządzanie subskrypcją jest chwilowo niedostępne”) zamiast dwóch sprzecznych tekstów. Dane testowe usunięte, serwer zatrzymany.

**Kroki dla człowieka (test ręczny Stripe)**
Kod działa z mockami; pełny przepływ z prawdziwym Stripe wymaga konta. Kroki:
1. Załóż konto na https://dashboard.stripe.com i pracuj w **trybie testowym** (przełącznik „Test mode”).
2. Katalog produktów → **Dodaj produkt** „Pro”, cena **cykliczna 25,00 PLN miesięcznie**. Skopiuj id ceny (`price_...`).
3. Ustawienia → Płatności → Metody płatności: włącz **BLIK** i **Przelewy24** (oraz karty). W kodzie nic nie trzeba zmieniać: Checkout pokazuje metody włączone w panelu. Uwaga: BLIK dla płatności cyklicznych może wymagać osobnej aktywacji po stronie Stripe; karty działają zawsze.
4. Ustawienia → Billing → **Customer portal**: aktywuj portal (link testowy), zezwól na anulowanie subskrypcji i zmianę metody płatności, zapisz.
5. Developers → API keys: skopiuj **Secret key** (`sk_test_...`).
6. Zainstaluj Stripe CLI, zaloguj się (`stripe login`) i uruchom: `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Skopiuj wypisany **signing secret** (`whsec_...`); CLI musi działać przez cały test.
7. W `.env.local` (nie commitować) ustaw: `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_WEBHOOK_SECRET=whsec_...`, `STRIPE_PRICE_PRO=price_...` (oraz `NEXT_PUBLIC_APP_URL=http://localhost:3000`). Zrestartuj `npm run dev`.
8. Zaloguj się jako DJ z planem Free → `/panel/subskrypcja` → „Przejdź na Pro”. W Checkoucie (po polsku) zapłać kartą testową **4242 4242 4242 4242**, dowolna przyszła data, dowolne CVC i kod pocztowy.
9. Po powrocie widać zielony baner. W oknie `stripe listen` powinny pojawić się `checkout.session.completed` i `customer.subscription.*` z odpowiedzią `200`. Odśwież stronę: odznaka „Plan: Pro”, data odnowienia za miesiąc.
10. „Zarządzaj subskrypcją” → w portalu anuluj subskrypcję. Przy anulowaniu na koniec okresu plan zostaje Pro do daty odnowienia; natychmiastowe anulowanie (albo `stripe subscriptions cancel sub_...` w CLI) wyśle `customer.subscription.deleted` i plan wróci na Free.
11. Opcjonalnie: `stripe events resend evt_...` dla tego samego zdarzenia, żeby sprawdzić idempotencję (stan się nie zmienia).
12. Produkcja: w Developers → Webhooks dodaj endpoint `https://<domena>/api/stripe/webhook` ze zdarzeniami `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` i użyj jego signing secret jako `STRIPE_WEBHOOK_SECRET`; klucze live zamiast testowych.

### Tester (próba 1)

**Wyniki**
- `npm run check`: lint + typecheck + testy: 34 pliki, **375/375** zielone.
- `npm run e2e` (pełne): **29/29** zielone (w tym 5 nowych w `tests/e2e/subscription.spec.ts`).
- Ręcznie (dev na porcie 3200, bez kluczy Stripe w env): `POST /api/stripe/webhook` bez podpisu → **503** `{"error":"BILLING_NOT_CONFIGURED"}`, ze śmieciowym podpisem → 503, `GET` → 405. Zrzuty `/panel/subskrypcja` (tablet-landscape 1180×820 i telefon 360 px, z i bez `?status=success`) dla DJ-a Free i Pro (z `planRenewsAt`, `stripeCustomerId`, `stripeSubscriptionId` ustawionymi w bazie): brak poziomego przewijania (overflow 0 we wszystkich 8 widokach), teksty po polsku, „Odnowienie: 19 listopada 2026”, odznaka „Plan: Pro/Free” w nagłówku, baner sukcesu dla Pro mówi „Plan Pro jest już aktywny”, dla Free „Aktywacja planu może potrwać chwilę…”, przycisk „Przejdź na Pro” wyłączony z komunikatem „Płatności nie są skonfigurowane”. Dane testowe usunięte, serwer zatrzymany.

**Kryteria**
- ✅ `/panel/subskrypcja`: plan, data odnowienia, „Przejdź na Pro” (Checkout `mode: "subscription"`, cena `STRIPE_PRICE_PRO`; waluta PLN wynika z ceny 25 PLN tworzonej w panelu, opisane w krokach) albo „Zarządzaj subskrypcją” (Customer Portal). Dowód: `components/panel/SubscriptionView.tsx`, `lib/billing.ts` (`createCheckoutSession`, `createPortalSession`), testy `billing-sessions.test.ts` (dokładne parametry), `subscription-view.test.tsx`, e2e i zrzuty.
- ✅ Webhook z weryfikacją podpisu obsługuje trzy zdarzenia i aktualizuje `plan`, `stripeCustomerId`, `stripeSubscriptionId`, `planRenewsAt`. Dowód: `app/api/stripe/webhook/route.ts` → `handleStripeWebhook` (`request.text()` + `constructEvent` przed jakimkolwiek przetwarzaniem); testy w `stripe-webhook-api.test.ts` używają **prawdziwego** `constructEvent` i `generateTestHeaderString` (zmienione body → 400 dowodzi, że weryfikacja jest naprawdę wykonywana), asercje na wszystkich czterech polach.
- ✅ Idempotencja: podwójne doręczenie `checkout.session.completed` i `customer.subscription.deleted` daje identyczny stan; zapisy bezwzględne; stan pobierany z Stripe (`subscriptions.retrieve`) chroni przed złą kolejnością (test „out of order”), stara subskrypcja nie anuluje nowej (test).
- ✅ `.env.example`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO` z komentarzami, puste wartości.
- ✅ Testy z zamockowanym SDK: każde zdarzenie (completed + fallback `metadata.userId` + tryb `payment`, updated active/trialing/past_due/canceled/unpaid/incomplete_expired, deleted), brak podpisu / zły sekret / śmieciowy nagłówek / zmienione body → 400, 503 bez konfiguracji, 500 bez szczegółów. Testy nie wymagają sieci ani kluczy.
- ✅ Bez kluczy: „Płatności nie są skonfigurowane”, przycisk wyłączony, akcje wracają na stronę bez wołania Stripe (testy jednostkowe, integracyjne, e2e, zrzuty).

Istniejące testy nie zostały usunięte ani osłabione (`git diff`: zmiana `tests/e2e/db-helpers.ts` tylko rozszerza `setDjPlan` o opcjonalne `planRenewsAt`).

### Reviewer (próba 1)

Przejrzane: `git diff` (`.env.example`, `package.json`/lock, `tests/e2e/db-helpers.ts`) i wszystkie nowe pliki (`lib/stripe.ts`, `lib/billing.ts`, route webhooka, `app/panel/billing-actions.ts`, strona i komponenty, 5 plików testów). Typy sprawdzone w zainstalowanym `stripe@23.0.0` (API `2026-09-30.endive`): `SubscriptionItem.current_period_end: number` istnieje, `locale: "pl"` dozwolone w Checkout i Portalu, sygnatura `constructEvent(payload: string, header, secret)` zgodna.

**Bezpieczeństwo / billing — sprawdzone, OK**
- Podpis weryfikowany na surowym body (`request.text()`) przed parsowaniem i przed jakimkolwiek zapisem; błąd podpisu → 400 bez szczegółów.
- Server actions `startCheckoutAction` / `openPortalAction` nie przyjmują żadnego wejścia; użytkownik zawsze z `requireDj()`, cena zawsze z env. DJ nie może wybrać ceny ani cudzego konta; nie da się nadać sobie Pro bez zdarzenia podpisanego przez Stripe. `client_reference_id`/`metadata.userId` ustawia wyłącznie nasz serwer, a użytkownik jest szukany najpierw po `stripeCustomerId` (unikalny w schemacie), więc nadużycie wymagałoby dostępu do konta Stripe.
- Klient Stripe: ponowne użycie tylko własnego `stripeCustomerId`; zapis warunkowy (`updateMany ... stripeCustomerId: null`) chroni przed wyścigiem podwójnego kliknięcia; Portal otwierany tylko dla klienta zalogowanego DJ-a (test z cudzym klientem w bazie).
- Obniżenie planu tylko dla bieżącej subskrypcji (`STALE_SUBSCRIPTION`), `deleted` jako stan końcowy, `updated`/`completed` odczytują aktualny stan ze Stripe — poprawne pod kątem kolejności i powtórzeń.
- Sekrety: grep po `sk_live|sk_test_…|whsec_…` poza `node_modules` i `.env*` — tylko oczywiste atrapy w testach (`whsec_test_secret`, `sk_test_not_a_real_key`). Logi nie zawierają kluczy ani payloadu (tylko id i typ zdarzenia).
- Webhook poza `proxy.ts` (matcher `/panel`, `/e`), `POST` route handler nie jest cache'owany; `GET` → 405.
- 503 bez konfiguracji (Stripe ponawia), 500 przy błędzie przetwarzania (ponowienie), 200 dla nieznanych zdarzeń i nieznanego klienta — semantyka rozsądna.
- UI po polsku, kroki dla człowieka w Logu kompletne (produkt i cena 25 PLN, BLIK/P24, Customer Portal, klucze, `stripe listen`, karta 4242, anulowanie, `stripe events resend`, endpoint produkcyjny).

**Krytyczne**
- Brak.

**Drobne (na później)**
1. Przy `cancel_at_period_end = true` subskrypcja ma status `active`, więc strona pokazuje „Odnowienie: …”, choć plan się nie odnowi. Warto zapisywać/pokazywać „Plan aktywny do …” (np. pole z `cancel_at_period_end`/`cancel_at`).
2. `findSubscriptionUser` z podpowiedzią `metadata.userId` może nadpisać istniejący, inny `stripeCustomerId` DJ-a (tylko dla subskrypcji utworzonych poza naszym Checkoutem, np. ręcznie w panelu Stripe). Można pomijać aktualizację `stripeCustomerId`, gdy DJ ma już innego klienta, i logować ostrzeżenie.
3. Checkout blokowany tylko przy `plan === "PRO"`; DJ Free z niezsynchronizowaną aktywną subskrypcją (np. webhook nie doszedł) mógłby kupić drugą. Opcjonalnie sprawdzać też `stripeSubscriptionId`.
4. CLAUDE.md p. 4 (zod w każdym API route): webhook nie używa zod, co jest akceptowalne (wejście uwierzytelnione podpisem i typowane przez SDK), ale warto to odnotować w komentarzu route'a.
5. W krokach produkcyjnych dopisać, żeby wersja API endpointu webhooka w panelu Stripe była zgodna z wersją SDK (`2026-09-30`), bo od niej zależy kształt payloadu (`items.data[].current_period_end`). Fallback na `current_period_end` częściowo to łagodzi.
6. Baner `?status=success` („Płatność została przyjęta”) pokaże się każdemu, kto wpisze ten parametr — kosmetyka, nie wpływa na plan.

### Orkiestrator
Tester: PASS, reviewer: APPROVE. Ręczny test z prawdziwym kontem Stripe czeka na człowieka (kroki w Logu powyżej). Ticket zamknięty.
