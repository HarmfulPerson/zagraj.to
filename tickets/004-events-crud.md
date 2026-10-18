---
id: "004"
title: Zarządzanie wydarzeniami w panelu
status: done
depends_on: ["003"]
attempts: 1
---

## Cel
DJ tworzy, przegląda, edytuje i zmienia status swoich wydarzeń.

## Kryteria akceptacji
- [x] `/panel` pokazuje listę wydarzeń zalogowanego DJ-a (nazwa, data, status, kod), od najnowszych
- [x] `/panel/wydarzenia/nowe`: nazwa (wymagana), data (opcjonalna), limit życzeń na gościa (1–20, domyślnie 5); po zapisie wydarzenie ma unikalny kod i status DRAFT
- [x] Akcje: „Rozpocznij” (DRAFT → LIVE), „Zakończ” (LIVE → CLOSED), edycja nazwy i limitu
- [x] API sprawdza własność: próba zmiany cudzego wydarzenia zwraca 404 (test)
- [x] Walidacja zod na wszystkich wejściach
- [x] Testy jednostkowe przejść statusów (niedozwolone przejścia, np. CLOSED → LIVE, są odrzucane)

## Uwagi
Limity planu Free dochodzą w tickecie 011. Tutaj ich nie implementuj.

## Log

### Developer (próba 1)
**Co zrobiono**
- Logika przejść statusów (`lib/event-status.ts`): dozwolone tylko DRAFT → LIVE („Rozpocznij”, akcja `start`) i LIVE → CLOSED („Zakończ”, akcja `close`); wszystko inne (np. CLOSED → LIVE, DRAFT → CLOSED, LIVE → DRAFT) odrzucane jako `INVALID_TRANSITION`. Polskie etykiety statusów (Szkic / Trwa / Zakończone) i odmiana „1 życzenie / 3 życzenia / 5 życzeń”.
- Walidacja zod (`lib/event-validation.ts`): nazwa wymagana (trim, max 100 znaków), data opcjonalna `YYYY-MM-DD` (z `<input type="date">`, zapisywana jako północ UTC i wyświetlana w UTC, więc dzień się nie przesuwa; lata 2000–2100), limit życzeń na gościa liczba całkowita 1–20 (domyślnie 5 przy tworzeniu, wymagany przy edycji; przyjmuje liczbę z JSON i string z formularza), akcja statusu `start | close`, id wydarzenia. Komunikaty po polsku.
- Warstwa danych (`lib/events.ts`): `listDjEvents` (tylko wydarzenia DJ-a, od najnowszych), `findDjEvent`, `createEvent` (status DRAFT, unikalny kod przez istniejący `generateUniqueEventCode` + ponowienie przy wyścigu P2002), `updateEvent` (tylko nazwa i limit), `changeEventStatus`. Każde zapytanie filtruje po `djId`, więc cudze wydarzenie = brak wydarzenia. Zmiana statusu jest warunkowa (`updateMany` z bieżącym statusem), więc dwa równoczesne kliknięcia nie wykonają przejścia dwa razy.
- API (wszystkie sprawdzają sesję → 401, walidują zod → 400 z `fieldErrors`, cudze/nieistniejące wydarzenie → 404):
  - `GET/POST /api/events` (lista, tworzenie → 201),
  - `GET/PATCH /api/events/[id]` (podgląd, edycja nazwy i limitu),
  - `POST /api/events/[id]/status` `{ action }` (niedozwolone przejście → 409 `INVALID_TRANSITION` z aktualnym statusem).
- UI (Server Actions w `app/panel/event-actions.ts` korzystające z tych samych funkcji; `requireDj()`, zod, `notFound()` dla cudzych wydarzeń, `refresh()` po zmianie):
  - `/panel`: powitanie + lista wydarzeń (nazwa, data lub „Bez daty”, kod, kolorowa plakietka statusu), od najnowszych, przycisk „Nowe wydarzenie”; pusty stan z jednym CTA „Utwórz pierwsze wydarzenie”.
  - `/panel/wydarzenia/nowe`: formularz (nazwa, data opcjonalna, limit 1–20 domyślnie 5), błędy walidacji pod polami, po zapisie przekierowanie do wydarzenia.
  - `/panel/wydarzenia/[id]`: nazwa, status, duży kod dla gości, data, limit; sekcja „Status wydarzenia” z opisem i przyciskiem „Rozpocznij” albo „Zakończ” (z potwierdzeniem „Tak, zakończ / Nie, wróć”, bo zakończenia nie można cofnąć); sekcja „Edycja” (nazwa i limit, komunikat „Zmiany zapisane.”). Cudze lub nieistniejące wydarzenie pokazuje „Nie znaleziono wydarzenia” (bez zdradzania, że istnieje). Tablica na żywo dojdzie w tickecie 009.
  - Odczyty sesji i parametrów za `<Suspense>` (Cache Components); `next build` przechodzi (`/panel`, `/panel/wydarzenia/nowe`, `/panel/wydarzenia/[id]` jako Partial Prerender).
- Limity planu Free nie są implementowane (ticket 011).

**Zmienione/nowe pliki**
- nowe: `lib/event-status.ts`, `lib/event-validation.ts`, `lib/events.ts`, `lib/api-responses.ts`, `app/api/events/route.ts`, `app/api/events/[id]/route.ts`, `app/api/events/[id]/status/route.ts`, `app/panel/event-actions.ts`, `app/panel/wydarzenia/nowe/page.tsx`, `app/panel/wydarzenia/[id]/page.tsx`, `app/panel/wydarzenia/[id]/not-found.tsx`, `components/panel/StatusBadge.tsx`, `components/panel/EventForm.tsx`, `components/panel/EventStatusControls.tsx`
- zmienione: `app/panel/page.tsx` (lista wydarzeń zamiast placeholdera), `lib/app.ts` (ścieżki `NEW_EVENT_PATH`, `eventPanelPath`)
- testy: `tests/unit/event-status.test.ts`, `tests/unit/event-validation.test.ts`, `tests/integration/events.test.ts`, `tests/integration/events-api.test.ts`, `tests/e2e/events.spec.ts`
- Brak nowych zmiennych środowiskowych.

**Jak przetestowano**
- `npm run check`: lint, typecheck, 96 testów (11 plików). Nowe: unit przejść statusów (wszystkie pary from→to, w tym odrzucenie CLOSED → LIVE, DRAFT → CLOSED, LIVE → DRAFT), walidacji (nazwa, limit 0/21/5.5/„abc”, daty niepoprawne i spoza zakresu, ignorowanie pól typu `status`/`code` przy edycji), odmiany; integracja na test.db: tworzenie (DRAFT, poprawny i unikalny kod), lista tylko własnych od najnowszych, edycja, pełny cykl DRAFT → LIVE → CLOSED z odrzuceniem ponownego otwarcia, równoczesne „start” wykonane tylko raz, własność; route handlery (z zamockowanym `getCurrentDj`): 401 bez sesji, 400 z polskimi `fieldErrors` i przy złym JSON, **404 dla GET/PATCH/zmiany statusu cudzego wydarzenia (dane bez zmian)**, 409 dla CLOSED → LIVE.
- `npm run e2e`: 7/7. Nowe: pełny przepływ (pusty stan → błędy walidacji → utworzenie z datą i limitem → Szkic + kod → Rozpocznij → Trwa → edycja nazwy i limitu → Zakończ z anulowaniem i potwierdzeniem → Zakończone, brak przycisków; API zwraca 409 przy próbie ponownego startu; wiersz na liście z nazwą, kodem, statusem, datą) oraz kolejność od najnowszych i drugi DJ dostający 404 z API (GET/PATCH/status) i stronę „Nie znaleziono wydarzenia”. Unikalne e-maile w każdym uruchomieniu.
- Kontrola wizualna (dev :3200, `scripts/ui-shots.mjs`, 4 viewporty): `/panel` z 3 wydarzeniami (Trwa, Szkic z bardzo długą nazwą, Zakończone), `/panel/wydarzenia/nowe`, szczegóły każdego ze statusów, pusty panel nowego DJ-a, „Nie znaleziono wydarzenia” dla cudzego wydarzenia, a przy 360 px dodatkowo: błędy walidacji formularza tworzenia i edycji, potwierdzenie zakończenia, komunikat „Zmiany zapisane.”. Skrypt nie zgłosił poziomego przewijania, błędów konsoli ani HTTP ≥ 400. Długa nazwa zawija się (lista i nagłówek), plakietki statusu się nie ściskają, przyciski i pola ≥ 48 px, kontrast plakietek OK, teksty po polsku. Poprawki po oglądzie: „3 życzeń” → poprawna odmiana („3 życzenia”); w pustym stanie były dwa przyciski tworzenia — nagłówek z „Nowe wydarzenie” pokazuje się tylko przy niepustej liście; cofnięte zwężenie pola limitu (podpowiedź łamała się na jedno słowo). Uwaga: w headless Chromium pole daty pokazuje placeholder `mm/dd/yyyy` (format zależy od języka przeglądarki/systemu, u polskiego użytkownika będzie `dd.mm.rrrr`).

**Uwagi dla kolejnych ticketów**
- Edycja nazwy/limitu jest dozwolona także dla zakończonych wydarzeń (nieszkodliwe; łatwo zablokować, jeśli zajdzie potrzeba).
- `notFound()` w strumieniowanej części strony daje stronę „Nie znaleziono” ze statusem HTTP 200 (ograniczenie streamingu w Next); API zwraca prawdziwe 404.

### Tester (próba 1)
**Wyniki**
- `npm run check`: lint ✅, typecheck ✅, Vitest 96/96 (11 plików) ✅
- `npm run e2e`: 7/7 ✅ (w tym 2 nowe w `tests/e2e/events.spec.ts`)

**Kryteria akceptacji**
- ✅ `/panel` – lista wydarzeń DJ-a (nazwa, data/„Bez daty”, plakietka statusu, kod), od najnowszych: `app/panel/page.tsx` + `listDjEvents` (`where: { djId }`, `orderBy createdAt desc, id desc`). Testy: `tests/integration/events.test.ts` („only the DJ's own events, newest first”), e2e (kolejność Nowsze/Starsze, zawartość wiersza).
- ✅ `/panel/wydarzenia/nowe` – nazwa wymagana, data opcjonalna, limit 1–20 domyślnie 5; po zapisie DRAFT + unikalny kod: `createEventSchema`, `createEvent` (`generateUniqueEventCode` + ponowienie przy P2002). Testy: unit walidacji, integracja (DRAFT, format kodu, różne kody), API (201, domyślny limit 5), e2e (błędy walidacji, utworzenie, „Szkic”, kod).
- ✅ Akcje „Rozpocznij” (DRAFT → LIVE), „Zakończ” (LIVE → CLOSED, z potwierdzeniem), edycja nazwy i limitu: `EventStatusControls`, `EventForm`, `event-actions.ts`, `PATCH /api/events/[id]`, `POST /api/events/[id]/status`. Testy: integracja + API + e2e (pełny cykl, „Zmiany zapisane.”).
- ✅ Własność → 404 (test): `findDjEvent`/`updateMany` zawsze z `djId`; `tests/integration/events-api.test.ts` sprawdza 404 dla GET/PATCH/status cudzego wydarzenia i że dane się nie zmieniły; e2e – drugi DJ dostaje 404 z API i stronę „Nie znaleziono wydarzenia”.
- ✅ Walidacja zod na wszystkich wejściach: body (create/update/status), parametr `id` (`eventIdSchema`), dane formularzy w Server Actions. Zły JSON → 400, nieznana akcja → 400.
- ✅ Testy jednostkowe przejść statusów: `tests/unit/event-status.test.ts` – wszystkie pary from→to, odrzucenie CLOSED → LIVE, DRAFT → CLOSED, LIVE → DRAFT itd.; integracyjnie 409 przy ponownym starcie zamkniętego i równoczesne „start” wykonane raz.

Testy rzeczywiście sprawdzają zachowanie (asercje na statusach HTTP, treści i stanie bazy). `git diff` – żaden istniejący test nie został usunięty ani osłabiony (zmienione tylko `app/panel/page.tsx`, `lib/app.ts`, reszta to nowe pliki).

**Kontrola wizualna** (dev :3200, `scripts/ui-shots.mjs`, 4 viewporty: `/panel` z 3 wydarzeniami w różnych statusach, w tym bardzo długa nazwa, `/panel/wydarzenia/nowe`, szczegóły LIVE i DRAFT): skrypt nie zgłosił poziomego przewijania ani błędów. Przy 360 px długa nazwa zawija się w liście i nagłówku, plakietki się nie ściskają, przyciski pełnej szerokości ≥ 48 px, kontrast dobry, teksty po polsku. Jedyna kosmetyka: placeholder pola daty `mm/dd/yyyy` w headless Chromium (zależy od języka przeglądarki – nie blokuje).

TEST: PASS

### Reviewer (próba 1)
**Krytyczne:** brak.

Sprawdzone:
- **Sesja i własność:** wszystkie route handlery (`GET/POST /api/events`, `GET/PATCH /api/events/[id]`, `POST /api/events/[id]/status`) zaczynają od `getCurrentDj()` → 401. Każde zapytanie w `lib/events.ts` filtruje po `djId` (`findFirst`, `updateMany` z `{ id, djId }`, zmiana statusu warunkowa `{ id, djId, status }`), więc cudze id = 404, bez wycieku istnienia. Server Actions (`createEventAction`, `updateEventAction`, `changeEventStatusAction`) wołają `requireDj()` i te same funkcje z `djId` – podrobione `eventId` w wywołaniu akcji (bound arg) trafia na `notFound()` i nic nie zmienia. Strona szczegółów również używa `findDjEvent(dj.id, …)`. Nie znalazłem ścieżki, którą DJ A odczyta lub zmieni wydarzenie DJ-a B.
- **zod:** body, parametr id, formularze; `status`/`code`/`djId` nie da się ustawić przez edycję (schemat ich nie przyjmuje, test „ignores fields that cannot be edited”).
- **Przejścia statusów:** jedna tabela w `lib/event-status.ts`, używana w API, akcjach i UI (przyciski z `availableStatusActions`); odporne na wyścig.
- **CSRF:** ciasteczko `httpOnly`, `sameSite: lax`, więc cross-site POST/PATCH do API nie niesie sesji; Server Actions mają wbudowaną kontrolę Origin.
- **Next 16:** `refresh()` z `next/cache` tylko w Server Actions (zgodnie z docs), `notFound()` dozwolone w Server Functions, `RouteContext`/`PageProps` z typegen, odczyty za `<Suspense>`.
- **N+1:** brak – lista to jedno zapytanie.
- **Zakres:** brak limitów planu (011), brak tablicy na żywo (009). Teksty UI po polsku.

**Drobne (na później):**
- `readJson` nie sprawdza `Content-Type: application/json`; przy `sameSite: lax` nie jest to dziura, ale wymuszenie typu byłoby dodatkową warstwą obrony.
- `updateEvent` robi `updateMany` + ponowny `findFirst` (2 zapytania) – akceptowalne, bo daje filtr po `djId`.
- `notFound()` w strumieniowanej części strony zwraca HTTP 200 z treścią „Nie znaleziono” (znane ograniczenie, opisane przez developera; API zwraca prawdziwe 404).
- Edycja zakończonego wydarzenia jest dozwolona – do rozważenia przy tickecie z tablicą/limitami.
- `formatEventDate` mieszka w `StatusBadge.tsx`; lepiej przenieść do osobnego modułu `lib/format`.

REVIEW: APPROVE

### Orkiestrator
Tester: PASS, reviewer: APPROVE. Ticket zamknięty.
