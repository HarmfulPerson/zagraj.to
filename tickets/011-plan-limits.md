---
id: "011"
title: Limity planów Free i Pro
status: done
depends_on: ["010"]
attempts: 1
---

## Cel
Plan użytkownika realnie ogranicza funkcje zgodnie z sekcją „Plany” w SPEC.md.

## Kryteria akceptacji
- [x] `lib/plans.ts` jako jedno źródło prawdy o limitach (`getPlanLimits(plan)`, `canStartEvent(user)`, `canExport(user)` itd.)
- [x] Free: drugie uruchomienie wydarzenia (DRAFT → LIVE) w tym samym miesiącu kalendarzowym jest blokowane z komunikatem i linkiem do `/panel/subskrypcja`
- [x] Free: po 100 życzeniach w wydarzeniu goście dostają komunikat „Lista jest pełna”; lajkowanie dalej działa
- [x] Free: eksport zablokowany po stronie API (403) i UI (przycisk z kłódką i opisem)
- [x] Pro: brak tych limitów
- [x] Testy jednostkowe wszystkich limitów, w tym granic miesiąca

## Log

### Developer (próba 1)
**Co zrobiono**
- `lib/plans.ts`: jedno źródło prawdy. `PLAN_LIMITS` (FREE/PRO) z danymi do wyświetlania: nazwa, cena (`25 zł/mies.`), tagline, punkty po polsku (do ponownego użycia w 013/012). Do tego `getPlanLimits`, `canStartEvent(user+startedAt[], now)`, `canAddRequest(plan, count)`, `canExport`, `canCustomizePoster`, `planMonthKey`/`planMonthRange` oraz `PLAN_MESSAGES` (polskie komunikaty). Wszystko to czyste funkcje: `now` i dane są wstrzykiwane.
- **Miesiąc kalendarzowy liczony w strefie Europe/Warsaw** (`Intl`, bez dodatkowych bibliotek), niezależnie od strefy serwera. Sprawdzone też z `TZ=America/Los_Angeles`. Impreza uruchomiona 1. dnia miesiąca o 00:30 czasu polskiego należy do nowego miesiąca. Limit resetuje się o 00:00 czasu polskiego.
- Migracja `20261019004350_event_started_at`: `Event.startedAt DateTime?`, `Event.posterText String?`, indeks `(djId, startedAt)`. Wydarzenia uruchomione przed migracją mają `startedAt = null`, więc nie liczą się do limitu.
- Limit uruchomień (Free: 1/miesiąc): egzekwowany we wspólnym `changeEventStatus` (`lib/events.ts`), więc działa zarówno dla API, jak i server action. Plan jest odczytywany świeżo z bazy. Liczenie startów i update są w jednej transakcji, a test „dwa równoczesne starty różnych wydarzeń” przepuszcza dokładnie jeden. Start ustawia `startedAt = now`. Zamknięcie wydarzenia nie zwraca wykorzystanego startu.
  - API: 403 `{ error: "PLAN_LIMIT", message, upgradeUrl: "/panel/subskrypcja" }`.
  - Panel: alert z komunikatem i przyciskiem „Przejdź na Pro” → `/panel/subskrypcja`. Strona jeszcze nie istnieje (ticket 012), link jest celowo.
- Limit 100 życzeń/wydarzenie (Free): w transakcji `addRequest`, przed limitem gościa. **Liczą się wszystkie życzenia oprócz REJECTED** (PENDING, ACCEPTED, PLAYED). Odrzucenie zwalnia miejsce, tak samo jak przy limicie gościa z 008. Głosy się nie liczą. Dodanie utworu, który już jest na liście, dalej działa jako głos.
  - Nowy utwór ponad limit → 409 `{ error: "LIST_FULL", message: "Lista jest pełna. …" }`.
  - Lista gościa (`GuestList.event`) ma nowe pole `listFull`. Strona gościa pokazuje wtedy baner „Lista jest pełna” (zamiast wyszukiwarki, jak przy wstrzymanych zgłoszeniach), a lajkowanie działa dalej.
- Eksport (Free): API zwraca 403 `{ error: "PLAN_REQUIRED", message: "Eksport dostępny w planie Pro.", upgradeUrl }`. Sprawdzenie własności jest najpierw: cudze wydarzenie dalej daje 404. W UI `ExportControls locked` pokazuje plakietkę Pro, opis „Eksport dostępny w planie Pro”, link „Przejdź na Pro” i przyciski „Pobierz CSV” / „Kopiuj listę” z kłódką (`aria-disabled`).
- Własny tekst na plakacie (Pro): `posterText` w `updateEventSchema` (zod: trim, białe znaki zwinięte do jednej linii, puste → null, max 80; brak pola = bez zmian).
  - Egzekwowane w `updateEvent`: Free z tekstem dostaje `PLAN_REQUIRED` (API 403), a dla cudzego wydarzenia nadal NOT_FOUND.
  - Formularz edycji: Pro ma pole tekstowe, Free widzi zablokowane pole z kłódką, podpowiedzią i linkiem. Zablokowane pole jest `disabled` i nie ma `name`, więc nie jest wysyłane.
  - Plakat: tekst pod hasłem „Zeskanuj i zamów piosenkę”, tylko gdy plan to Pro (po przejściu na Free tekst nie jest drukowany). QR zmniejsza się wtedy do 46cqw.
- `updateEvent` zwraca teraz wynik `{ ok, event } | { ok:false, reason }` zamiast `DjEvent | null`.
- Plakietka „Plan: Free/Pro” w nagłówku panelu (link do `/panel/subskrypcja`).

**Zmiany w istniejących testach (bez osłabiania asercji)**
- `tests/integration/export-api.test.ts`: właściciel wydarzenia jest PRO (`createDj(plan = "PRO")`), bo testy dotyczą formatu eksportu. „Inny DJ” jest teraz FREE, co dodatkowo sprawdza, że 404 ma pierwszeństwo przed 403. Dodany test 403 dla Free (csv i txt).
- `tests/integration/events.test.ts`: `toBeNull()` → `toEqual({ ok:false, reason:"NOT_FOUND" })` oraz `updated.ok && updated.event` (nowy typ wyniku, ta sama siła asercji).
- `tests/integration/votes*.test.ts`: oczekiwany `event` ma dodatkowe pole `listFull: false` (wzmocnienie).
- `tests/e2e/export.spec.ts`: DJ jest ustawiany na PRO przez `setDjPlan` (bezpośrednio w SQLite, `tests/e2e/db-helpers.ts`; loader Playwrighta nie wczytuje wygenerowanego klienta Prisma w ESM). Dodany test e2e dla zablokowanego eksportu Free. `registerDj` zwraca teraz e-mail.
- Pozostałe e2e nie uruchamiają więcej niż jednego wydarzenia na DJ-a, więc nie wymagały zmian.

**Nowe testy**
- `tests/unit/plans.test.ts` (17): limity zgodne ze SPEC; granice miesiąca 23:59/00:00 czasu polskiego vs UTC zimą (UTC+1) i latem (UTC+2); przełom roku; zakresy miesięcy ze zmianą czasu (marzec, październik); limity startów, życzeń, eksportu i plakatu; komunikaty.
- `tests/unit/event-validation.test.ts`: walidacja `posterText`.
- `tests/integration/events.test.ts`:
  - `startedAt`; Free 2. start → PLAN_LIMIT, a wydarzenie zostaje DRAFT;
  - reset o 00:00 czasu polskiego (31.10 22:59:59Z zablokowane, 23:00Z dozwolone);
  - start 1.10 o 00:30 czasu polskiego liczy się do października;
  - poprzedni miesiąc i cudze starty się nie liczą;
  - wyścig dwóch startów; Pro bez limitu;
  - `posterText` dla Pro (zapis, pozostawienie, czyszczenie) i dla Free (PLAN_REQUIRED, czyszczenie dozwolone).
- `tests/integration/events-api.test.ts`: 403 PLAN_LIMIT z treścią; Pro uruchamia kilka wydarzeń; PATCH `posterText`: Free 403, za długi 400, Pro 200.
- `tests/integration/requests.test.ts`: 100. życzenie przechodzi, 101. → LIST_FULL; głos na istniejący utwór działa; PLAYED/ACCEPTED się liczą, a REJECTED zwalnia miejsce; wyścig dwóch gości przy 99; Pro 150+ bez limitu.
- `tests/integration/requests-api.test.ts`: 409 LIST_FULL z polskim komunikatem, głos przy pełnej liście → 200.
- `tests/integration/votes.test.ts`: `listFull` przy 99/100 życzeniach i dla Pro; lajk działa przy pełnej liście.
- `tests/e2e/plans.spec.ts`:
  - Free uruchamia 1. wydarzenie, 2. jest blokowane (komunikat + link, API 403); pole tekstu na plakat jest zablokowane;
  - Pro uruchamia kilka wydarzeń, zapisuje 80-znakowy tekst przy 97-znakowej nazwie, tekst jest na plakacie, a PDF ma 1 stronę A4;
  - gość przy 100 życzeniach widzi „Lista jest pełna”, lajk działa, nowy utwór przez API → 409.

**Zmienione/nowe pliki**
`prisma/schema.prisma`, `prisma/migrations/20261019004350_event_started_at/migration.sql`, `lib/plans.ts` (nowy), `lib/app.ts`, `lib/api-responses.ts`, `lib/events.ts`, `lib/event-validation.ts`, `lib/requests.ts`, `lib/guest-list.ts`, `app/api/events/[id]/route.ts`, `app/api/events/[id]/status/route.ts`, `app/api/events/[id]/export/route.ts`, `app/api/events/[id]/requests/route.ts`, `app/panel/event-actions.ts`, `app/panel/layout.tsx`, `app/panel/wydarzenia/[id]/page.tsx`, `app/panel/wydarzenia/[id]/plakat/page.tsx`, `app/e/[code]/page.tsx`, `components/panel/EventStatusControls.tsx`, `components/panel/ExportControls.tsx`, `components/panel/EventForm.tsx`, `components/guest/GuestEventLive.tsx`, testy: `tests/unit/plans.test.ts` (nowy), `tests/unit/event-validation.test.ts`, `tests/integration/{events,events-api,export-api,requests,requests-api,votes,votes-api}.test.ts`, `tests/e2e/db-helpers.ts` (nowy), `tests/e2e/plans.spec.ts` (nowy), `tests/e2e/export.spec.ts`, `tests/e2e/guest-helpers.ts`.

**Jak przetestowano**
- `npm run check`: lint, typecheck, 30 plików / 326 testów: OK.
- Pełny `npm run e2e` dwa razy: 24/24, 24/24.
- Kontrola wizualna: serwer dev na porcie 3200, skrypt Playwright w scratchpadzie, motyw ciemny. Obejrzane zrzuty:
  - blokada drugiego startu: tablet 1180 i telefon 360 (bursztynowy alert, komunikat, przycisk „Przejdź na Pro”);
  - zablokowany eksport (kłódki, plakietka Pro, link) i zablokowane pole tekstu na plakat (Free). Po pierwszym przebiegu skrócony placeholder, który ucinał się na 360 px;
  - plakat Pro z własnym tekstem w emulacji druku 794×1123: krótka nazwa oraz 97-znakowa nazwa z 80-znakowym tekstem, `scrollHeight` = 1123, czyli jedna strona. Po pierwszym przebiegu zmniejszony QR (46cqw) dla większego odstępu od kroków i dodane `text-balance`, żeby nie zostawało samotne słowo;
  - widok gościa „Lista jest pełna” na 360 px przy 100 życzeniach;
  - plakietki „Plan: Free/Pro” w nagłówku.
  Brak poziomego przewijania (0 px). Dane wizualne usunięte z dev.db (4 użytkowników `visual-011-*`, kaskadowo wydarzenia i życzenia), serwer wyłączony, port 3200 wolny.

**Uwagi dla kolejnych ticketów**
- Na SQLite zapisy w transakcjach są serializowane. Na Postgresie warto rozważyć izolację `Serializable` albo blokadę wiersza użytkownika w `changeEventStatus` i `addRequest`.
- Po zablokowanym starcie przycisk „Rozpocznij” zostaje widoczny (ponowne kliknięcie znów pokaże komunikat). Można by ukrywać go proaktywnie dla Free, gdy limit jest wykorzystany.

### Tester (próba 1)
**Wyniki**
- `npm run check`: lint OK, typecheck OK, Vitest: 30 plików, 326 testów, wszystkie zielone.
- `npm run e2e` (pełny przebieg): 24/24 passed.
- Migracja od zera: stary `dev.db` przeniesiony do scratchpadu, potem `npx prisma migrate dev`. Obie migracje (`init` i `20261019004350_event_started_at`) zastosowane bez błędów, schemat zsynchronizowany. `npx prisma db seed` OK. Zostawiony świeży, zaseedowany `dev.db`.

**Kryteria akceptacji**
- ✅ `lib/plans.ts` jako jedno źródło prawdy. Zawiera `PLAN_LIMITS`, `getPlanLimits`, `canStartEvent`, `canAddRequest`, `canExport`, `canCustomizePoster`, `planMonthKey`/`planMonthRange` i `PLAN_MESSAGES`. Grep po `100` i `25 zł` w `app/`, `components/`, `lib/`: liczby występują tylko w komentarzach i w `lib/plans.ts`. Nigdzie indziej limity nie są wpisane na sztywno.
- ✅ Free, drugi start w miesiącu jest blokowany:
  - Egzekwowane w `changeEventStatus` w transakcji, wspólnej dla API i server action.
  - API zwraca 403 `PLAN_LIMIT` z polskim komunikatem i `upgradeUrl: "/panel/subskrypcja"`. Sprawdzone ręcznie na serwerze 3200; wydarzenie zostaje w DB jako DRAFT.
  - Panel pokazuje alert z przyciskiem „Przejdź na Pro”: zrzuty 1180 i 360 px, bez poziomego przewijania.
  - Pokrycie testami: integracja (`events.test.ts`, `events-api.test.ts`) i e2e (`plans.spec.ts`).
- ✅ Free, 100 życzeń:
  - 100. życzenie przechodzi, 101. dostaje 409 `LIST_FULL`, a głos na utwór z listy dalej działa (`requests.test.ts`, `requests-api.test.ts`, `votes.test.ts`, e2e).
  - Ręcznie: przy 100 życzeniach gość na 360 px widzi baner „Lista jest pełna” zamiast wyszukiwarki, a POST nowego utworu daje 409.
- ✅ Free, eksport:
  - API zwraca 403 `PLAN_REQUIRED` dla csv i txt. Sprawdzone ręcznie i testami `export-api.test.ts` oraz e2e.
  - UI: plakietka Pro, opis, link „Przejdź na Pro” i przyciski z kłódką (`aria-disabled`). Zrzut obejrzany.
- ✅ Pro bez limitów:
  - Kilka startów w miesiącu, ponad 150 życzeń, eksport 200 i własny tekst na plakacie: testy integracyjne i e2e.
  - Ręcznie: Pro uruchomił 2 wydarzenia, PATCH z tekstem na plakat zwrócił 200, eksport 200.
  - Plakat w emulacji druku 794×1123: `scrollHeight` = 1123, czyli jedna strona. Tekst w 2 zrównoważonych liniach pod hasłem; QR, kod i kroki mieszczą się na stronie.
- ✅ Testy jednostkowe limitów i granic miesiąca: `tests/unit/plans.test.ts`, 17 testów. Obejmują 23:59/00:00 czasu polskiego zimą i latem, przełom roku, zakresy miesięcy ze zmianą czasu oraz 100. vs 101. życzenie. Do tego testy integracyjne granicy 31.10 22:59:59Z / 23:00Z.

**Zmienione istniejące testy (`git diff tests/`)**: nic nie zostało osłabione.
- W `export-api.test.ts` właściciel wydarzenia jest PRO, a test „inny DJ → 404” używa DJ-a FREE, więc dodatkowo sprawdza kolejność 404 przed 403. Przypadek Free ma osobny test 403 (csv i txt).
- W e2e `export.spec.ts` test Pro zachował wszystkie asercje. Doszedł osobny test zablokowanego eksportu Free (UI + API 403 bez `Content-Disposition`).
- W `events.test.ts` `toBeNull()` zamieniono na `toEqual({ ok:false, reason:"NOT_FOUND" })`, a `toMatchObject` na `updated.ok && updated.event`. Poprzedzająca asercja `expect(updated.ok).toBe(true)` sprawia, że asercja nie może przejść przy `false`. Siła sprawdzenia bez zmian.
- `votes*.test.ts`: `toEqual` z dodatkowym `listFull: false`, czyli asercja jest mocniejsza.

**Próby obejścia (serwer dev 3200, konto Free)**
- Bezpośredni POST `/status` dla drugiego wydarzenia: 403.
- GET `/export`: 403.
- PATCH z `posterText`: 403.
- Podrobiony server action: odblokowane pole w DOM, nadane `name="posterText"`, wysłany formularz. W DB `posterText` zostaje `null`.

Wszystkie próby zablokowane. Dane wizualne (4 użytkowników `visual-011t-*`, kaskadowo wydarzenia i życzenia) usunięte. W DB zostały tylko dane seeda. Serwer wyłączony, port 3200 wolny.

TEST: PASS

### Reviewer (próba 1)
**Krytyczne**: brak.

**Sprawdzone**
- **Egzekwowanie po stronie serwera:**
  - Limit startów jest w `changeEventStatus`, z którego korzystają i API, i server action.
  - Limit życzeń jest w transakcji `addRequest`.
  - Eksport jest blokowany w route handlerze.
  - `posterText` jest blokowany w `updateEvent`, więc działa dla API i dla server action.
  - Plan jest czytany świeżo z bazy: `getCurrentDj` selekcjonuje `plan`, `changeEventStatus` dołącza `dj.plan` w transakcji.
  - Nie istnieje endpoint usuwania wydarzeń, więc nie da się „odzyskać” startu przez usunięcie. Zamknięcie wydarzenia nie zwalnia startu.
- **Kolejność 404 przed 403** zachowana w trzech miejscach:
  - eksport: najpierw `findDjEvent`, potem `canExport`;
  - `updateEvent`: dla cudzego wydarzenia NOT_FOUND;
  - `changeEventStatus`: własność sprawdzana przed limitem.
- **Miesiąc w Europe/Warsaw**: `planMonthKey` przez `Intl`, `planMonthRange` jako półotwarty zakres UTC z korektą offsetu. Zapytanie korzysta z indeksu `(djId, startedAt)`, a `canStartEvent` dodatkowo filtruje po kluczu miesiąca. Granice przetestowane zimą, latem i na przełomie roku.
- **Wyścigi**: liczenie i zapis są w jednej transakcji (SQLite serializuje zapisy). Oba scenariusze współbieżne są przetestowane. Uwaga o Postgresie jest w Logu developera.
- **Dane planów zgodne ze SPEC**: Free to 1 start/mies., 100 życzeń, bez eksportu. Pro to 25 zł/mies. (`priceLabel: "25 zł/mies."`), bez limitów, eksport i własny tekst na plakacie.
- **Walidacja zod**: `posterText` ma trim, max 80, puste → null.
- **Teksty UI** po polsku.
- **Migracja** addytywna: kolumny nullable plus indeks.

**Drobne (na później)**
1. `app/panel/layout.tsx` wybiera styl plakietki przez `dj.plan === "PRO"`. Lepiej oprzeć to na danych z `lib/plans.ts`, np. fladze `isPaid` albo `priceMonthlyPln > 0`.
2. `PLAN_LIMITS.FREE.features` ma liczby wpisane w tekst („Do 100 życzeń”, „1 wydarzenie”). Można je generować z `maxRequestsPerEvent` i `maxEventStartsPerMonth`, żeby nie rozjechały się przy zmianie limitu.
3. W zablokowanym polu tekstu na plakat błąd `fieldErrors.posterText` z server action (przy podrobionym żądaniu) nie jest widoczny. Hint pokazuje jednak tę samą treść, więc to tylko kosmetyka.
4. Linki „Przejdź na Pro” prowadzą do `/panel/subskrypcja`, która powstanie dopiero w tickecie 012. To świadome i opisane, ale do tego czasu link daje 404.
5. Po zablokowanym starcie przycisk „Rozpocznij” zostaje widoczny. Developer zgłosił to sam w Logu.

REVIEW: APPROVE

### Orkiestrator
Tester: PASS, reviewer: APPROVE (próby obejścia limitów zablokowane). Link /panel/subskrypcja powstaje w 012. Ticket zamknięty.
