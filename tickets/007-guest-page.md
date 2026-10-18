---
id: "007"
title: Strona gościa i dodawanie życzeń
status: done
depends_on: ["004", "006"]
attempts: 1
---

## Cel
Gość skanuje QR, wyszukuje utwór i dodaje go do listy, bez logowania.

## Kryteria akceptacji
- [x] `/e/[code]`: nieznany kod daje stronę 404 po polsku; wydarzenie DRAFT pokazuje „Impreza jeszcze się nie zaczęła”, CLOSED pokazuje „Impreza zakończona”
- [x] Przy pierwszej wizycie gość dostaje ciasteczko `guestId` (UUID, httpOnly, 30 dni)
- [x] Wyszukiwarka z debounce (300 ms) korzystająca z `/api/search`
- [x] `POST /api/events/[code]/requests` z utworem:
  - [x] utworu nie ma na liście → tworzy Request (PENDING) i od razu głos dodającego
  - [x] utwór już jest → nie tworzy duplikatu, tylko oddaje głos (jeśli gość jeszcze nie głosował)
  - [x] przekroczony `maxRequestsPerGuest` → 429 z komunikatem; dodanie głosu na istniejący utwór nie zużywa limitu
  - [x] `requestsOpen=false` lub status inny niż LIVE → 403
- [x] Logika w `lib/requests.ts` z testami jednostkowymi wszystkich powyższych przypadków
- [x] Widok mobilny (360 px) czytelny i wygodny

## Log

### Developer (próba 1)
**Co zrobiłem**
- **guestId** (`lib/guest.ts`): serwer wydaje UUID przez `crypto.randomUUID()`. Ciasteczko ma `httpOnly`, `sameSite=lax`, `secure` w produkcji, `path=/`, `maxAge` 30 dni. Przy odczycie sprawdzam format (`parseGuestId`, małe litery, regex UUID). Wartość niepoprawna liczy się jak brak ciasteczka. Ciasteczko wydaje `proxy.ts` (matcher rozszerzony o `/e/:path*`) przy pierwszej wizycie albo przy niepoprawnej wartości. Nowe id trafia też do przekazywanego żądania, więc strona widzi je już przy pierwszym renderze. Zapasowo wydaje je też `POST .../requests`, gdy przyjdzie żądanie bez poprawnego ciasteczka. Dodatkowo proxy przekierowuje kod pisany małymi literami (`/e/k7qx2m` → 308 → `/e/K7QX2M`).
- **Uwaga 1 reviewera z 006**: `MemoryRateLimiter` ma teraz `maxKeys` (domyślnie 10 000). Po przekroczeniu limitu usuwa najstarsze okna (mapa w kolejności startu okna, a restart okna przenosi klucz na koniec). Czyszczenie wygasłych kluczy chodzi najwyżej raz na okno albo przy zapełnieniu, więc nie ma już pełnego przeglądu mapy przy każdym nowym kluczu. `searchRateLimitKey` bierze `guestId` tylko wtedy, gdy to poprawny UUID, inaczej przechodzi na IP. `readCookie` przeniosłem z `lib/search.ts` do `lib/guest.ts`, żeby nie duplikować logiki.
- **`lib/requests.ts`**:
  - `trackInputSchema` (zod). `id`: `[A-Za-z0-9_-]`, maks. 32 znaki. `title` i `artist`: trim, 1–200 znaków. Okładka spoza hostów Deezera (`*.dzcdn.net`, `*.deezer.com`, tylko https) albo niepoprawny `durationSec` zamieniane są na `null` i nie odrzucają żądania.
  - `addRequest()` wymaga wydarzenia LIVE z otwartymi zgłoszeniami, inaczej zwraca `EVENT_NOT_LIVE` / `REQUESTS_CLOSED`.
  - Utwór, który już jest na liście, dostaje głos (`VOTED`, przy powtórce `ALREADY_VOTED`, bo unikalność (requestId, guestId)). Nie powstaje duplikat i limit nie jest zużywany.
  - Nowy utwór: liczenie życzeń gościa i `create` (Request PENDING + zagnieżdżony Vote) idą w jednej transakcji, więc szybkie podwójne kliknięcia nie przekroczą limitu. Przy limicie zwraca `LIMIT_REACHED`.
  - Wyścig dwóch gości: P2002 na (eventId, trackId) → ponowne wyszukanie i głos na zwycięski wpis.
  - Do tego `findGuestEvent`, `countGuestRequests` i `listGuestRequests` (bez REJECTED) oraz `GUEST_MESSAGES` po polsku.
- **`POST /api/events/[code]/requests`**: plik `app/api/events/[id]/requests/route.ts`. Segment musi nazywać się `[id]`, bo dzieli folder z trasami DJ-a, ale zawiera kod wydarzenia, normalizowany przez `normalizeEventCode`. Odpowiedzi:
  - 201 `{ outcome: "CREATED", request, usedRequests, maxRequests }`; 200 przy `VOTED` / `ALREADY_VOTED`
  - 400 `VALIDATION` / `INVALID_JSON`
  - 403 `EVENT_NOT_LIVE` („Impreza jeszcze się nie zaczęła.” / „Impreza zakończona.”) albo `REQUESTS_CLOSED` („DJ chwilowo nie przyjmuje nowych życzeń.”)
  - 404 „Nie ma imprezy o takim kodzie.”
  - 429 `REQUEST_LIMIT` („Wykorzystano limit życzeń (N) na tę imprezę. Możesz dalej dodawać głosy na utwory, które już są na liście.”)
- **Strona `/e/[code]`** (ciemny motyw, `app/e/layout.tsx` z `themeColor`/`colorScheme: dark`, w `globals.css` ciemne tło także przy overscrollu):
  - nieznany kod → `not-found.tsx` „Nie ma takiej imprezy”
  - DRAFT → „Impreza jeszcze się nie zaczęła”, CLOSED → „Impreza zakończona” (z nazwą imprezy)
  - LIVE → `components/guest/GuestEventLive.tsx`:
    - nagłówek z nazwą i znacznikiem „Na żywo”, licznik „Twoje życzenia X z N” z paskiem postępu
    - przyklejona wyszukiwarka (h-14, 16 px, bez zoomu na iOS). Po fokusie przewija się na górę, żeby klawiatura nie zasłaniała wyników.
    - debounce 300 ms z `AbortController`: starsze zapytanie jest przerywane
    - stany: skeleton przy ładowaniu, spinner w polu przy odświeżaniu wyników, „Nic nie znaleźliśmy”, błąd z komunikatem z API i przyciskiem „Spróbuj ponownie”, podpowiedź przy 1 znaku
    - wiersze wyników: okładka 56 px, tytuł i wykonawca obcinane (`truncate`), czas, przycisk „Dodaj” (min. 44 px, spinner w trakcie). Po dodaniu przycisk zmienia się w „✓ Dodano” albo „✓ Twój głos”.
    - toast na dole (`aria-live`, safe-area, przycisk zamknięcia 44 px)
    - sekcja „Dodane przez Ciebie”
    - przy `requestsOpen=false` baner zamiast wyszukiwarki; po 403 baner plus `router.refresh()`
    - pełna lista z lajkami zostaje na ticket 008.
- 404: w dev strona zwraca prawdziwy status 404 (`export const instant = false`, wydarzenie sprawdzane przed streamingiem). W `next build` + `next start` trasa jest Partial Prerender, więc odpowiedź ma status 200 z `<meta name="robots" content="noindex">` i polską stroną „Nie ma takiej imprezy”. To udokumentowane zachowanie Next (`loading.md`, „soft 404”), tak samo działa już `/panel/wydarzenia/[id]`. Twardy 404 w prod wymagałby zapytania do bazy w `proxy.ts`, czego nie robiłem.

**Zmienione/nowe pliki**
- nowe: `lib/requests.ts`, `app/api/events/[id]/requests/route.ts`, `app/e/layout.tsx`, `app/e/[code]/page.tsx`, `app/e/[code]/not-found.tsx`, `components/guest/GuestEventLive.tsx`, `components/guest/GuestMessage.tsx`, `components/guest/Brand.tsx`, `tests/integration/requests.test.ts`, `tests/integration/requests-api.test.ts`, `tests/unit/guest.test.ts`, `tests/e2e/guest.spec.ts`
- zmienione: `lib/guest.ts`, `lib/rate-limit.ts`, `lib/search.ts`, `proxy.ts`, `app/globals.css`, `tests/unit/rate-limit.test.ts` (nowe testy `maxKeys`), `tests/unit/search-api.test.ts` (ciasteczka testowe zmienione na poprawne UUID, bo niepoprawny guestId nie jest już kluczem limitu; dodany test tej zmiany, żadnej asercji nie osłabiłem)

**Jak testowałem**
- `tests/integration/requests.test.ts` (15 testów, prawdziwa baza `test.db`):
  - nowy utwór → PENDING + głos dodającego
  - istniejący → głos bez duplikatu, potem `ALREADY_VOTED`
  - ten sam utwór w innym wydarzeniu to osobny wpis
  - limit → `LIMIT_REACHED`; inny gość ma własny limit; gość na limicie dalej głosuje; głos nie zużywa limitu; 4 równoległe dodania przy limicie 2 → dokładnie 2
  - DRAFT/CLOSED → `EVENT_NOT_LIVE`; `requestsOpen=false` → `REQUESTS_CLOSED`, także dla istniejącego utworu
  - nieznany kod
  - wyścig: deterministycznie przez Proxy na kliencie Prisma, który ukrywa pierwszy `findUnique`, oraz współbieżny `Promise.all`
  - `listGuestRequests` bez odrzuconych
- `tests/integration/requests-api.test.ts`: statusy 201/200/429/403/404/400 i polskie komunikaty, walidacja zod (puste id, `../etc`, za długie pola, brak pól), odrzucenie obcej okładki, wydanie ciasteczka (UUID, HttpOnly, SameSite=lax, Max-Age=2592000) przy braku lub niepoprawnym guestId.
- `tests/unit/guest.test.ts`: format UUID, opcje ciasteczka, `readCookie`; proxy wydaje ciasteczko i przekazuje je do żądania, zostawia poprawne, podmienia sfałszowane, robi 308 dla małych liter. `tests/unit/rate-limit.test.ts`: eksmisja przy `maxKeys`, 12 000 kluczy → rozmiar 10 000, restart okna przesuwa klucz.
- e2e `tests/e2e/guest.spec.ts` (viewport 360 px, `/api/search` mockowane przez `page.route`, bez Deezera, dane tworzone w teście):
  - przekierowanie z małych liter; ciasteczko UUID/httpOnly/Lax/30 dni
  - debounce: szybkie wpisanie „sanah” daje jedno zapytanie
  - dodanie → „Dodano „Szampan””, licznik 1 z 1; drugi utwór → komunikat limitu; po reloadzie lista „Dodane przez Ciebie”
  - gość B dodaje ten sam utwór → „Dodaliśmy Twój głos”, jego licznik 0 z 1
  - pusty wynik, brak poziomego overflow
  - błąd 429 wyszukiwarki z retry
  - DRAFT/CLOSED/nieznany kod (404) oraz 403 z API
  - Przeszło 3× z `--repeat-each 3`.
- `npm run check`: lint + typecheck + 169 testów, zielone. `npm run e2e`: 13/13. `npm run build`: OK (`/e/[code]` ◐, API ƒ).
- **Kontrola wizualna** (dev na porcie 3200, dane: DJ + wydarzenia LIVE z długą nazwą i limitem 2, DRAFT, CLOSED):
  - `scripts/ui-shots.mjs` dla LIVE/DRAFT/CLOSED/XXXXXX we wszystkich viewportach
  - skrypt Playwright 360 px z mockiem wyszukiwarki: ładowanie (skeleton), wyniki, sukces dodania, limit, pusty wynik, błąd z retry, lista „Dodane przez Ciebie”
  - Obejrzałem wszystkie PNG i poprawiłem:
    - mniejszy nagłówek dla długich nazw
    - przewijanie paska wyszukiwania na górę po fokusie
    - usunięta pusta przestrzeń nad „Dodane przez Ciebie”
    - przycisk zamknięcia toastu
  - Sprawdzone: brak poziomego overflow, obcinanie bardzo długiego tytułu i wykonawcy, cele dotyku ≥ 44 px, kontrast (biały tekst na violet-600, zinc-300/400 na zinc-950), polskie teksty.
  - Serwer wyłączony po teście.
- Nie sprawdziłem wizualnie banera „DJ chwilowo nie przyjmuje nowych życzeń”, bo nie ma jeszcze UI ani API do przełączania `requestsOpen` (będzie w tablicy DJ-a). Logika 403 jest pokryta testami.

### Tester (próba 1)
**Wyniki**
- `npm run check`: lint OK, typecheck OK, Vitest 20 plików / 169 testów zielone.
- `npm run e2e`: 13/13 zielone (w tym 3 testy `tests/e2e/guest.spec.ts`).

**Kryteria**
- ✅ `/e/[code]`: nieznany kod → `app/e/[code]/not-found.tsx` „Nie ma takiej imprezy” (dev: HTTP 404, `<meta name="robots" content="noindex">` obecny, sprawdzone curlem; w prod soft 404 z noindex, zaakceptowane przez orkiestratora). DRAFT → „Impreza jeszcze się nie zaczęła”, CLOSED → „Impreza zakończona” (`app/e/[code]/page.tsx`, e2e „draft, closed and unknown events show Polish messages”).
- ✅ Ciasteczko `guestId`: `proxy.ts` (matcher `/e/:path*`) wydaje `crypto.randomUUID()`; curl: `Set-Cookie: guestId=<uuid>; Path=/; Max-Age=2592000; HttpOnly; SameSite=lax` (`secure` w produkcji). Testy: `tests/unit/guest.test.ts`, `requests-api.test.ts`, e2e.
- ✅ Wyszukiwarka z debounce 300 ms (`SEARCH_DEBOUNCE_MS`, `AbortController`) korzysta z `/api/search`; e2e sprawdza, że szybkie wpisanie daje jedno zapytanie.
- ✅ POST, nowy utwór → Request PENDING + głos dodającego (`requests.test.ts` „creates a PENDING request…”, API 201).
- ✅ POST, utwór już jest → brak duplikatu, głos; powtórka → `ALREADY_VOTED` bez drugiego głosu (testy sprawdzają liczbę wierszy w bazie).
- ✅ POST, limit → 429 z polskim komunikatem; głos na istniejący utwór nie zużywa limitu i działa przy wyczerpanym limicie; 4 równoległe dodania przy limicie 2 → dokładnie 2.
- ✅ POST, `requestsOpen=false` lub DRAFT/CLOSED → 403 (`requests-api.test.ts`, także dla istniejącego utworu).
- ✅ Logika w `lib/requests.ts` z testami na prawdziwej bazie (`tests/integration/requests.test.ts`, 15 testów, w tym wyścig P2002 deterministycznie i współbieżnie).
- ✅ Widok 360 px: obejrzane zrzuty `ui-shots.mjs` (LIVE/DRAFT/CLOSED/XXXXXX) i własny przepływ Playwright z mockiem `/api/search` (skeleton → wyniki → „Dodaj” → „✓ Dodano” + toast → limit → „Dodane przez Ciebie”). Brak poziomego overflow, długie tytuły obcinane, przyciski ≥ 44 px, dobry kontrast w ciemnym motywie.

**Testy nie osłabione:** w `tests/unit/search-api.test.ts` zmieniono tylko wartości ciasteczek na poprawne UUID; asercje (statusy, komunikat, `Retry-After`, klucze) bez zmian, doszedł test ignorowania niepoprawnego guestId. W `rate-limit.test.ts` wyłącznie nowe testy.

TEST: PASS

### Reviewer (próba 1)
**Krytyczne:** brak.

Sprawdzone: `guestId` wydawany tylko przez serwer i walidowany regexem UUID (sfałszowana wartość = nowy gość); ciasteczko httpOnly, SameSite=lax, secure w prod, 30 dni. `proxy.ts` rozgałęzia `/e/` vs `/panel` — ochrona panelu bez zmian (curl `/panel` → 307 `/logowanie`, e2e auth zielone). Wejście walidowane zod-em (`id` regex + długość, trim/limity tekstów, okładka tylko https z hostów Deezera, inaczej `null`). Status LIVE i `requestsOpen` sprawdzane przed jakimkolwiek zapisem, także dla głosu. Odpowiedzi nie zawierają `createdByGuestId`, cudzych guestId ani danych DJ-a (`guestRequestSelect`, `findGuestEvent` z jawnym `select`). Komunikaty po polsku. Brak N+1 (stała liczba zapytań na żądanie). Next 16: `export const instant = false` i soft 404 z noindex zgodne z `docs/.../instant.md` i `loading.md`.

**Drobne (na później):**
1. Dodanie utworu, który DJ odrzucił (REJECTED), zwraca `VOTED` i toast „już jest na liście. Dodaliśmy Twój głos” — pośrednio ujawnia istnienie odrzuconego utworu (SPEC: odrzucone niewidoczne dla gości). Warto w 008/009 zdecydować, czy zwracać np. neutralny komunikat bez głosu.
2. Obejście limitu przez czyszczenie ciasteczek / wiele guestId oraz brak ciasteczka w POST (każde żądanie dostaje nowe id) — znane i akceptowalne w MVP; ewentualnie rate limit POST per IP.
3. POST nie sprawdza `Content-Type` ani `Origin` (`request.json()` parsuje też `text/plain`). Dzięki SameSite=lax cross-site POST nie niesie ciasteczka gościa, więc nie da się działać w jego imieniu — ale obca strona może dodawać utwory jako „nowi goście” (spam). Niski wpływ; można wymagać `application/json`.
4. `searchFocused` nigdy nie wraca do `false` (brak `onBlur`), więc po pierwszym fokusie sekcja wyników zostaje `min-h-dvh` i pod listą „Dodane przez Ciebie” jest dużo pustego miejsca przy przewijaniu. Kosmetyka.
5. Ciasteczko wydawane dla każdej ścieżki `/e/*`, także nieistniejących kodów — bez znaczenia praktycznego.

REVIEW: APPROVE

### Orkiestrator
Tester: PASS, reviewer: APPROVE. Soft 404 w produkcji zaakceptowany przez orkiestratora. Uwagi 1, 3, 4 reviewera (komunikat przy odrzuconym utworze, wymaganie application/json, min-height wyników) przekazane do ticketu 008. Ticket zamknięty.
