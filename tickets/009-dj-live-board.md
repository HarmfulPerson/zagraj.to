---
id: "009"
title: Tablica na żywo dla DJ-a
status: done
depends_on: ["008"]
attempts: 1
---

## Cel
DJ widzi napływające życzenia i nimi zarządza w trakcie imprezy.

## Kryteria akceptacji
- [x] `/panel/wydarzenia/[id]`: kolumny „Nowe” (PENDING), „Zaakceptowane”, „Zagrane”, „Odrzucone” (zwinięte); w każdej sortowanie po głosach
- [x] Na karcie: okładka, tytuł, artysta, liczba głosów, czas dodania, link „Otwórz w Spotify” (`https://open.spotify.com/search/<artysta tytuł>` z encodeURIComponent)
- [x] Akcje: Akceptuj, Odrzuć, Zagrane (ustawia `playedAt`), Cofnij do PENDING
- [x] Przełącznik „Zgłoszenia otwarte” zmienia `requestsOpen`
- [x] Nowe życzenia od ostatniego odświeżenia są wyróżnione; odświeżanie co 3 s
- [x] Widok działa na tablecie i telefonie w poziomie (DJ ma go obok konsolety)
- [x] API zmiany statusu sprawdza własność wydarzenia (test); testy przejść statusów życzenia

## Log

### Developer (próba 1)
**Co zrobiłem**
- **Przejścia statusów** (`lib/request-status.ts`, czysta logika):
  - dozwolone: PENDING→ACCEPTED/REJECTED/PLAYED, ACCEPTED→PLAYED/REJECTED/PENDING, REJECTED→PENDING, PLAYED→PENDING;
  - niedozwolone: ten sam status (podwójne tapnięcie, dwa urządzenia), REJECTED→ACCEPTED/PLAYED, PLAYED→ACCEPTED/REJECTED. Odrzucony albo zagrany utwór wraca najpierw do „Nowych”;
  - `planRequestStatusChange`: „Zagrane” ustawia `playedAt = now`, każdy inny cel czyści `playedAt`.
- **Logika tablicy** (`lib/dj-board.ts`):
  - `getDjBoard` zwraca wszystkie statusy (z REJECTED) w kolumnach, każda posortowana po głosach, potem od najstarszego. Głosy liczy `_count` w jednym zapytaniu, bez N+1 (test liczy zapytania SQL: 1 i 13 życzeń dają tyle samo zapytań);
  - `changeRequestStatus`: sprawdza własność (`event.djId`), wymaga wydarzenia LIVE. Zapis jest warunkowy na zwalidowanym statusie, więc z dwóch równoczesnych identycznych akcji przechodzi jedna;
  - `setRequestsOpen`, schematy zod body.
- `compareQueue` przeniosłem do czystego `lib/queue-order.ts`. Jest re-eksportowany z `guest-list.ts` i używany też po stronie klienta, który nie może importować prismy.
- **API** (wszystkie odpowiedzi `Cache-Control: private, no-store`, nowy helper `noStore` w `lib/api-responses.ts`):
  - `GET /api/events/[id]/board`: dane tablicy, 401/404;
  - `POST /api/requests/[id]/status` `{status}`: 415 bez JSON, 401, 404 dla cudzego lub nieistniejącego życzenia, 400 zod, 409 `INVALID_TRANSITION` (z aktualnym statusem) lub `EVENT_NOT_LIVE`;
  - `POST /api/events/[id]/requests-open` `{requestsOpen}`: 415/401/404/400.
- **Ujednolicenie z 008:** dodanie przez wyszukiwarkę utworu już PLAYED zwraca 409 `ALREADY_PLAYED` z komunikatem „Ten utwór został już zagrany.” (ten sam co przy głosowaniu). Głos nie jest oddawany. Strona gościa odświeża wtedy listę. Po „Cofnij do nowych” utwór znów przyjmuje głosy.
- **UI** `/panel/wydarzenia/[id]` (`components/panel/board/*`):
  - zawsze ciemny motyw: klasa `dj-board-theme` i własny wariant `dark` w `globals.css`, więc nagłówek panelu i istniejące karty zarządzania też są ciemne. Wariant `board:` poszerza layout na tej stronie;
  - przyklejony kompaktowy nagłówek: ←, nazwa, status, kod, licznik „N nowych ↓” (przewija do pierwszego nowego), „Na żywo”/„Brak połączenia”, przełącznik „Zgłoszenia otwarte” (role=switch, optymistyczny, podpis „Goście dodają utwory”/„Tylko głosowanie”) i przycisk „Wydarzenie i QR”;
  - przycisk „Wydarzenie i QR” rozwija zarządzanie: QR, kod, data, limit, link, plakat, start/zakończenie, edycja. Dla DRAFT sekcja jest domyślnie rozwinięta;
  - kolumny „Nowe”, „Zaakceptowane”, „Zagrane” z licznikami. „Odrzucone” to zwinięty `<details>` pod spodem;
  - karta: okładka (`Cover` z fallbackiem), tytuł (2 linie), artysta, duży licznik głosów, czas dodania („7 min temu”, tylko po hydratacji, bez hydration mismatch), link Spotify (`encodeURIComponent(artist + " " + title)`, `target=_blank rel="noopener noreferrer"`, aria-label „Otwórz w Spotify: …”);
  - duże przyciski akcji (52 px): Akceptuj, Zagrane, Odrzuć, Cofnij do nowych. Na wąskich kartach (telefon w poziomie) ikona nad etykietą, przez container queries;
  - akcje optymistyczne (SWR `mutate` z rollbackiem). Przy 409/404: komunikat po polsku i odświeżenie tablicy;
  - polling SWR co 3 s tylko gdy LIVE. DRAFT i CLOSED są statyczne, bez zapytań i bez akcji. CLOSED pokazuje „Tablica jest tylko do podglądu”. Gdy status zmieni się z innego urządzenia, wywoływane jest `router.refresh()`;
  - „Nowe od ostatniego odświeżenia”: widziane id są zapamiętywane w localStorage per wydarzenie. Przy pierwszej wizycie nic nie jest „nowe”, a po powrocie lub przeładowaniu wyróżnione są życzenia dodane w międzyczasie. Wyróżnienie to bursztynowa ramka i plakietka „NOWE”. Znika po 90 s albo po akcji DJ-a na karcie.
  - Na wysokości poniżej 500 px (telefon w poziomie) nagłówek panelu jest ukryty, żeby zostało miejsce na tablicę.

**Zmienione/nowe pliki**
- Nowe:
  - lib: `lib/request-status.ts`, `lib/dj-board.ts`, `lib/board-view.ts`, `lib/queue-order.ts`;
  - API: `app/api/events/[id]/board/route.ts`, `app/api/events/[id]/requests-open/route.ts`, `app/api/requests/[id]/status/route.ts`;
  - UI: `components/panel/board/DjBoard.tsx`, `components/panel/board/BoardCard.tsx`, `components/panel/board/useNewHighlights.ts`.
- Zmienione:
  - `app/panel/wydarzenia/[id]/page.tsx`, `app/panel/layout.tsx` (warianty `board:`), `app/globals.css`;
  - `lib/requests.ts` i `app/api/events/[id]/requests/route.ts` (ALREADY_PLAYED);
  - `components/guest/GuestEventLive.tsx` (odświeżenie przy 409), `lib/guest-list.ts`, `lib/api-responses.ts`.
- Testy:
  - nowe: `tests/unit/request-status.test.ts`, `tests/unit/board-view.test.ts`, `tests/integration/dj-board.test.ts`, `tests/integration/dj-board-api.test.ts`, `tests/e2e/dj-board.spec.ts`;
  - uzupełnione: `tests/integration/requests.test.ts`, `tests/integration/requests-api.test.ts`.

**Jak testowałem**
- Unit: tabela wszystkich 16 par przejść (8 dozwolonych, 8 zabronionych, jawnie wypisane), `playedAt` ustawiany i czyszczony, przyciski dla każdego statusu. Do tego: URL Spotify, `formatAgo`, kolumny i sortowanie, optymistyczne przeniesienie, `unseenIds`.
- Integracja:
  - zmiana statusu z DB (`playedAt`, ścieżki, odmowy bez zapisu, cudzy DJ = NOT_FOUND, DRAFT/CLOSED, wyścig dwóch „Zagrane”);
  - tablica: wszystkie statusy z głosami, tylko dla właściciela, brak N+1;
  - API: 200/401/404 (cudzy DJ)/400/415/409, `no-store` na każdej odpowiedzi;
  - ALREADY_PLAYED bez głosu (lib i API, 409 z polskim komunikatem).
- E2E (`tests/e2e/dj-board.spec.ts`, Deezer mockowany przez `page.route` na `/api/search`, dane własne):
  - goście A i B dodają utwory, DJ po pollingu widzi je z głosami (2 i 1), posortowane, wyróżnione jako nowe; sprawdzony link Spotify (href, `_blank`, noopener) i przyciski ≥ 48 px;
  - Akceptuj, potem Zagrane; po przeładowaniu dalej zagrane, `playedAt` ustawiony; gość widzi utwór w „Zagrane”;
  - gość C dodaje zagrany utwór: komunikat „Ten utwór został już zagrany.”, liczba głosów bez zmian;
  - Odrzuć: utwór znika u gości i jest w zwiniętych „Odrzuconych”; „Cofnij do nowych” go przywraca;
  - przełącznik zamyka zgłoszenia, a gość widzi baner;
  - inny DJ dostaje 404 na status, requests-open i board;
  - brak poziomego przewijania na 844×390;
  - drugi test: DRAFT i CLOSED bez żadnego zapytania do `/board` przez 4 s, CLOSED bez przełącznika i akcji.
- `npm run check`: lint i typecheck OK, 27 plików / 267 testów zielonych. `npm run e2e`: 19/19 (istniejące testy wydarzeń i plakatu przechodzą bez zmian).

**Kontrola wizualna** (dev 3200, świeży DJ, wydarzenie LIVE z 15 życzeniami)
- Dane: 6 nowych, 3 zaakceptowane, 3 zagrane, 3 odrzucone; głosy 1–14, bardzo długi tytuł i długi artysta. Okładki: poprawne (data-URI), 404 z CDN Deezera, 404 lokalne, brak okładki.
- Zrzuty `scripts/ui-shots.mjs` dla tablet-landscape, phone-landscape, desktop i phone-360, plus zrzuty własnym skryptem: nowe życzenie dodane w trakcie (wyróżnienie i licznik), po akcji „Zagrane”, przy zamkniętych zgłoszeniach z rozwiniętymi „Odrzuconymi”, z otwartym „Wydarzenie i QR”.
- Iteracje po obejrzeniu PNG:
  - przyciski w „Zaakceptowanych” wychodziły poza kartę, a etykiety obcinały się na „Zag…”/„Akcep…”: przeszedłem na flex, krótkie „Cofnij” i ikonę nad etykietą na wąskich kartach;
  - meta-wiersz zajmował osobny rząd: czas z ikoną zegara i link Spotify są teraz pod artystą, „temu” znika na wąskich kartach;
  - na telefonie w poziomie nagłówki zajmowały ~160 z 390 px: nagłówek panelu ukryty przy niskiej wysokości, link „←” kompaktowy, podpis przełącznika ukryty;
  - nowe życzenie bywało poza ekranem: licznik „N nowych ↓” przewija do niego.
- Efekt: na tablecie mieszczą się 3 kolumny po ~3–4 karty bez przewijania. Tytuły i liczniki głosów są duże i czytelne. Zepsute okładki pokazują nutę. Brak poziomego overflow na żadnym widoku, brak błędów JS (jedyne błędy konsoli to celowe 404 okładek).
- Dane testowe usunięte (`deleteMany` użytkownika z kaskadą, wydarzenie 0), serwer 3200 wyłączony.

DEV: DONE

### Tester (próba 1)
**Wyniki**
- `npm run check`: lint i typecheck OK, Vitest 27 plików / 267 testów zielonych.
- `npm run e2e`: 19/19 zielonych, w tym `tests/e2e/dj-board.spec.ts` (2 testy) oraz istniejące testy zarządzania wydarzeniem, plakatu i głosowania.
- `git diff`: istniejące testy nie zostały usunięte ani osłabione. `requests.test.ts` i `requests-api.test.ts` mają tylko nowe przypadki (ALREADY_PLAYED), a w `tests/e2e` nie zmieniono żadnego istniejącego pliku.

**Kryteria**
- ✅ Kolumny „Nowe”, „Zaakceptowane”, „Zagrane” i zwinięte „Odrzucone” (`<details>`), każda posortowana po głosach, a przy remisie od najstarszego. Dowód: `MAIN_COLUMNS` w `DjBoard.tsx`, `buildBoardColumns` i `compareQueue`. Testy: `dj-board.test.ts` („returns all statuses…”), `board-view.test.ts`, e2e (kolejność `["Dancing Queen", "Szampan"]`, zwinięte Odrzucone).
- ✅ Karta zawiera okładkę (fallback z nutą działa przy 404 i braku URL), tytuł, artystę, liczbę głosów, czas dodania i link Spotify. Link to `encodeURIComponent(artist + " " + title)` z `target=_blank` i `rel="noopener noreferrer"`. Testy: unit `spotifySearchUrl` (także `/ ? # &`) i e2e (`href`, `target`, `rel`).
- ✅ Akcje Akceptuj, Odrzuć, Zagrane (ustawia `playedAt`) i „Cofnij do nowych”. Orkiestrator akceptuje tę etykietę. Testy: unit `planRequestStatusChange`, integracja (`playedAt` ustawiany i czyszczony), e2e (pełna ścieżka i przeładowanie).
- ✅ Przełącznik „Zgłoszenia otwarte” zmienia `requestsOpen`. Testy: integracja API i e2e (gość widzi baner, stan przetrwał przeładowanie).
- ✅ Nowe życzenia są wyróżnione (ramka i plakietka „NOWE”, licznik „N nowe ↓”), odświeżanie co 3 s przez SWR `refreshInterval` tylko dla LIVE. Testy: e2e (`data-new`, licznik, brak pollingu dla DRAFT/CLOSED) i unit `unseenIds`. Sprawdziłem też ręcznie: życzenie dodane przez API gościa pojawiło się wyróżnione po ≤ 3 s na tablecie i telefonie w poziomie.
- ✅ Widok działa na tablecie i telefonie w poziomie. Wynik kontroli wizualnej jest niżej, a e2e sprawdza brak overflow na 844×390.
- ✅ API zmiany statusu sprawdza własność: cudzy DJ dostaje 404 i nic się nie zapisuje (integracja i e2e). Przejścia statusów są przetestowane tabelą wszystkich 16 par.
- ✅ (zlecenie orkiestratora) Dodanie przez wyszukiwarkę utworu już PLAYED daje 409 `ALREADY_PLAYED` z komunikatem „Ten utwór został już zagrany.”, bez głosu. Testy: `requests.test.ts`, `requests-api.test.ts`, e2e (liczba głosów bez zmian). Ręcznie przez HTTP na dev też dostałem 409 z tym samym body. Ścieżka wyścigu (unique violation) również przechodzi przez `voteForExisting`.

**Kontrola ręczna** (dev 3200, świeży DJ, LIVE z 12 życzeniami: 5 nowych, 3 zaakceptowane, 2 zagrane, 2 odrzucone; długie tytuły i artyści; okładki zepsute (404 CDN i lokalne) albo brak)
- DJ B: `POST /api/requests/:id/status` → 404, `GET /board` → 404, `POST /requests-open` → 404. Strona `/panel/wydarzenia/:id` pokazuje „Nie znaleziono wydarzenia”, bez kodu i utworów. Status życzenia nie zmienił się. Wysłanie formularza (form-urlencoded) → 415.
- Zrzuty: `ui-shots.mjs` (wszystkie 4 widoki) oraz własne: nowe życzenie, zamknięte zgłoszenia z rozwiniętymi „Odrzuconymi”, rozwinięte „Wydarzenie i QR”. Na tablecie w poziomie widać 3 kolumny, duże tytuły i liczniki, przyciski 52 px, brak obciętych etykiet. Na telefonie w poziomie ikony są nad etykietami, a nagłówek panelu jest ukryty. Na 360 px kolumny układają się jedna pod drugą. Brak poziomego overflow (0 px). Jedyne błędy konsoli to celowe 404 okładek. QR, status („Zakończ”) i edycja działają w ciemnym motywie i są czytelne.
- Dane testowe usunięte (3 konta tester009*, kaskada), serwer 3200 wyłączony.

TEST: PASS

### Reviewer (próba 1)
**Krytyczne:** brak.

**Sprawdzone**
- **Własność:**
  - `GET /board`: `findDjEvent(djId, id)`;
  - `requests-open`: `updateMany where {id, djId}`;
  - `status`: `findFirst where {id, event: {djId}}`. Warunkowy `updateMany` po id i statusie wykonuje się dopiero po tym sprawdzeniu, a eventId życzenia się nie zmienia.
  - Nie znalazłem ścieżki, którą DJ A mógłby odczytać lub zmienić dane DJ-a B. Sprawdziłem też ręcznie: wszystkie trzy endpointy i strona zwracają 404 albo „nie znaleziono”.
- **Walidacja i nagłówki:** wejścia przez zod (`z.enum(REQUEST_STATUSES)`, `z.boolean`, `eventIdSchema`/`requestIdSchema`). POST-y wymagają `application/json` (415, ochrona przed CSRF z formularza). Wszystkie odpowiedzi mają `private, no-store`. Board nie ujawnia `createdByGuestId`.
- **Przejścia statusów:** jawna tabela, ten sam status → 409. Z REJECTED/PLAYED da się wrócić tylko do PENDING. Dla DRAFT/CLOSED zwracany jest `EVENT_NOT_LIVE`. Wyścig dwóch identycznych akcji obsługuje warunkowy update (test). Klient przy 409/404 pokazuje polski komunikat i odświeża tablicę, optimistic update ma rollback.
- **Zapytania:** głosy liczone przez `_count` w jednym zapytaniu, test potwierdza stałą liczbę zapytań. Polling co 3 s pobiera tylko LIVE, nie odpytuje w ukrytej karcie (domyślne SWR), DRAFT i CLOSED nie odpytują wcale (e2e).
- **localStorage:** tylko id życzeń per wydarzenie, w try/catch, bez danych wrażliwych.
- **Spotify:** link zakodowany przez `encodeURIComponent`, `rel="noopener noreferrer"`.
- **UI i regresje:** teksty po polsku. Zarządzanie wydarzeniem (QR, kod, link, plakat, start/zakończenie, edycja) jest pod „Wydarzenie i QR”, dla DRAFT rozwinięte domyślnie. Istniejące e2e wydarzeń i plakatu są zielone. Druk plakatu nie jest dotknięty (`print:` bez zmian).

**Drobne** (na później)
1. `setRequestsOpen` pozwala przełączyć `requestsOpen` także dla DRAFT/CLOSED. UI ukrywa przełącznik dla CLOSED, a gość i tak nie doda nic poza LIVE, więc to nieszkodliwe. Można ograniczyć do DRAFT/LIVE.
2. Komentarz przy `REQUEST_ACTION_LABELS` i w `REQUEST_STATUS_TRANSITIONS` dalej mówi „Cofnij do PENDING”, a etykieta to „Cofnij do nowych”.
3. W `lib/guest-list.ts` po przeniesieniu `compareQueue` został podwójny pusty wiersz.
4. Klucze `zagrajto:board-seen:<id>` w localStorage nigdy nie są sprzątane po zakończonych wydarzeniach. Zbiory są małe (≤ liczba życzeń), ale można je czyścić np. dla CLOSED.
5. Wyróżniony nowy utwór z 1 głosem trafia na dół kolumny „Nowe”. Licznik „N nowe ↓” to łagodzi, ale przy długiej kolumnie warto rozważyć krótki pasek „Ostatnio dodane” u góry.

REVIEW: APPROVE

### Orkiestrator
Tester: PASS, reviewer: APPROVE. Etykieta „Cofnij do nowych” zaakceptowana przez orkiestratora. Ticket zamknięty.
