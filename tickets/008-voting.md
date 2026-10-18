---
id: "008"
title: Lajki i lista dla gości
status: done
depends_on: ["007"]
attempts: 2
---

## Cel
Goście widzą listę życzeń na żywo i lajkują utwory.

## Kryteria akceptacji
- [x] `GET /api/events/[code]/requests` zwraca życzenia PENDING i ACCEPTED posortowane po liczbie głosów (malejąco), potem po dacie, oraz osobno ostatnie 20 PLAYED. REJECTED nigdy nie trafia do gościa.
- [x] Każde życzenie ma `votes`, `votedByMe` i `mine` (dodane przez tego gościa)
- [x] `POST` / `DELETE /api/requests/[id]/vote` dodaje i usuwa głos; podwójny głos jest niemożliwy (test)
- [x] Lajkowanie działa także przy `requestsOpen=false`, ale nie w wydarzeniu CLOSED
- [x] UI: przycisk serca z licznikiem, optymistyczna aktualizacja, odznaka „Twoje”, sekcja „Zagrane”
- [x] Odświeżanie listy co 3 s (SWR)
- [x] Testy jednostkowe sortowania i ukrywania REJECTED

## Log

### Developer (próba 1)
**Co zrobiłem**
- **Logika listy** (`lib/guest-list.ts`):
  - czysta funkcja `buildGuestList(rows, guestId)` odrzuca REJECTED i dzieli wiersze na `queue` (PENDING + ACCEPTED) i `played`;
  - kolejka: głosy malejąco, przy remisie starsze życzenie pierwsze (dłużej czeka), na końcu id dla stabilności;
  - `played`: od ostatnio zagranego, maks. 20 (`PLAYED_LIST_LIMIT`).
  - `loadGuestListRows` pobiera z bazy tylko PENDING/ACCEPTED oraz 20 ostatnich PLAYED. REJECTED odpada już w zapytaniu i drugi raz w czystej funkcji. Własny głos gościa pobieram przez `votes where guestId` z `take: 1`, więc nie ma N+1.
  - `getGuestList(code, guestId)` zwraca `{ event: { status, requestsOpen }, queue, played }`. Dla DRAFT/CLOSED listy są puste.
  - Pozycja listy ma tylko `id, trackId, title, artist, coverUrl, durationSec, status, votes, votedByMe, mine`. Nie ma w niej `createdByGuestId` ani żadnych guestId.
- **Głosy** (`lib/votes.ts`): `castVote` / `removeVote` działają idempotentnie.
  - Podwójny głos blokuje unikalność (requestId, guestId): P2002 jest przechwytywany, więc równoległe kliknięcia dają jeden głos.
  - Głosować można w LIVE także przy `requestsOpen=false`. Przy CLOSED/DRAFT zwracam `EVENT_NOT_LIVE`.
  - REJECTED i nieistniejące życzenie dają ten sam `NOT_FOUND`. PLAYED daje `ALREADY_PLAYED`, bo sekcja „Zagrane” nie ma serc.
- **API**:
  - `GET /api/events/[code]/requests` (w `app/api/events/[id]/requests/route.ts`, segment `[id]` zawiera kod): 200 z listą i `cache-control: private, no-store`, 404 dla nieznanego kodu. Bez ciasteczka `votedByMe`/`mine` = false.
  - `POST` / `DELETE /api/requests/[id]/vote` (`app/api/requests/[id]/vote/route.ts`) zwraca 200 `{ votes, votedByMe }`. Błędy:
    - 401 bez poprawnego guestId („Odśwież stronę i spróbuj ponownie.”)
    - 404 dla id niepoprawnego (zod: `[A-Za-z0-9_-]`, maks. 64), nieistniejącego albo REJECTED („Tego utworu nie ma już na liście.”)
    - 403 dla CLOSED/DRAFT („Impreza zakończona.” / „Impreza jeszcze się nie zaczęła.”)
    - 409 dla PLAYED
    - 415 bez JSON
- **Uwagi reviewera z 007**:
  - (1) Dodanie utworu odrzuconego przez DJ-a: wybrałem neutralną odmowę bez głosu. `addRequest` → `TRACK_UNAVAILABLE`, API 409 `{ error: "TRACK_UNAVAILABLE", message: "Ten utwór nie może zostać dodany." }`. Wszyscy goście (także autor) dostają to samo, nie powstaje głos ani duplikat. Ta sama ścieżka działa przy wyścigu P2002.
    - Uzasadnienie: ciche przyjęcie pokazywałoby „✓ Twój głos” przy utworze, którego nie ma na liście, a to też by go zdradzało.
    - Komunikat nie mówi „odrzucony”. Istnienia nie da się w pełni ukryć (inny utwór by się dodał), ale nie widać statusu ani głosów.
  - (3) Helper `requireJsonContentType` w `lib/api-responses.ts`. Wszystkie gościnne POST/DELETE (dodanie życzenia, głos, cofnięcie głosu) wymagają `Content-Type: application/json` (dopuszczalne parametry, np. `; charset=utf-8`), inaczej 415 `UNSUPPORTED_MEDIA_TYPE`. Formularz HTML z innej strony nie wyśle takiego typu, a `fetch` z nim wymaga preflightu CORS, którego nie obsługujemy.
  - (4) `searchFocused` wraca do `false` przy `onBlur`. `min-h-dvh` zostaje tylko przy fokusie albo przy pokazanych wynikach (≥ 2 znaki), żeby kliknięcie „Dodaj”, które zdejmuje fokus, nie przesuwało listy pod palcem. Lista życzeń renderuje się teraz poza obszarem wyników, a pod listą nie ma już pustego ekranu.
- **UI** (`components/guest/GuestRequestList.tsx`, ciemny styl gościa):
  - lista „Lista życzeń” z licznikiem utworów (polska odmiana) i numerem pozycji;
  - okładka 44 px, tytuł i wykonawca obcinane; odznaki „Twoje” (fiolet) i „✓ Zaakceptowane” (zieleń) w osobnej linii, żeby nie zjadały nazwy wykonawcy;
  - przycisk serca 56×56 px z licznikiem, `aria-pressed`, etykieta „Polub: tytuł – wykonawca”, polubione na różowo;
  - sekcja „Zagrane” przygaszona, z ✓, bez serc, z „N głosów”;
  - pusty stan zależny od `requestsOpen`; dyskretny baner „Nie udało się odświeżyć listy. Próbujemy dalej…” przy błędzie pollingu.
  - `GuestEventLive` używa SWR (`swr` 2.5.1, dopisane do dependencies): `refreshInterval: 3000`, `fallbackData` z serwera (SSR), `revalidateOnFocus`.
  - Serce działa optymistycznie przez `mutate` z `optimisticData` i `rollbackOnError`. Przy błędzie wraca poprzedni stan i pojawia się toast z polskim komunikatem z API; po 404/409 lista jest pobierana od nowa. Kolejne tapnięcia tego samego serca są ignorowane, dopóki trwa żądanie. Lista nie przestawia się lokalnie pod palcem, nową kolejność daje następny polling.
  - `requestsOpen` bierzemy z odpytywanej listy. Baner „DJ chwilowo nie przyjmuje nowych życzeń. Możesz dalej lajkować utwory z listy.” pojawia się i znika bez przeładowania, a podtytuł zmienia się na „Polub utwory, które chcesz usłyszeć…”. Gdy polling zobaczy status ≠ LIVE, `router.refresh()` pokazuje „Impreza zakończona”.
  - Sekcję „Dodane przez Ciebie” z 007 zastąpiła pełna lista z odznaką „Twoje”. `Cover`/`TrackText` przeniosłem do `components/guest/TrackParts.tsx`; okładka, która się nie załaduje, wraca do ikony nuty zamiast pokazywać zepsuty obrazek.
- Poza zakresem: dodanie utworu, który jest już PLAYED, nadal oddaje na niego głos (zachowanie z 007). Endpoint głosowania odmawia głosu na PLAYED. Można to ujednolicić w 009, gdy DJ będzie oznaczał utwory jako zagrane.

**Zmienione/nowe pliki**
- nowe: `lib/guest-list.ts`, `lib/votes.ts`, `app/api/requests/[id]/vote/route.ts`, `components/guest/GuestRequestList.tsx`, `components/guest/TrackParts.tsx`, `tests/unit/guest-list.test.ts`, `tests/integration/votes.test.ts`, `tests/integration/votes-api.test.ts`, `tests/e2e/voting.spec.ts`, `tests/e2e/guest-helpers.ts`
- zmienione: `lib/requests.ts` (TRACK_UNAVAILABLE, nowe komunikaty), `lib/api-responses.ts` (415), `app/api/events/[id]/requests/route.ts` (GET, 415, 409), `app/e/[code]/page.tsx`, `components/guest/GuestEventLive.tsx`, `package.json` / `package-lock.json` (swr), `tests/integration/requests.test.ts` i `tests/integration/requests-api.test.ts` (tylko nowe testy plus opcjonalny parametr content-type w helperze), `tests/e2e/guest.spec.ts`
  - Helpery przeniesione do `guest-helpers.ts`. Asercje `guest-mine` („Dodane przez Ciebie”) zastąpiłem równoważnymi na nowej liście: wiersz A ma „Twoje” po dodaniu i po reloadzie, wiersz B nie ma „Twoje”, a jego serce jest wciśnięte. Żadnej asercji nie osłabiłem.

**Jak testowałem**
- `tests/unit/guest-list.test.ts`:
  - sortowanie po głosach, remis po dacie, stabilność po id; PENDING i ACCEPTED razem; played od najnowszego, limit 20;
  - REJECTED nigdy niewidoczne (także ze 100 głosami i jako „moje”);
  - `mine`/`votedByMe` jako booleany, zestaw kluczy pozycji, brak guestId w JSON, bez gościa nic nie jest „moje”;
  - odmiana „głos/głosy/głosów” (0, 1, 2, 4, 5, 12, 14, 22, 25, 112); 415 dla braku, `text/plain`, form-urlencoded, multipart, `application/json-patch+json`.
- `tests/integration/votes.test.ts` (prawdziwa `test.db`):
  - polub i cofnij; podwójny głos sekwencyjnie i 6× równolegle daje 1 wiersz, a baza sama odrzuca duplikat;
  - cofnięcie nieistniejącego głosu; działa przy `requestsOpen=false`; CLOSED/DRAFT odmawia bez zmian;
  - REJECTED = NOT_FOUND; ACCEPTED można, PLAYED nie;
  - `getGuestList`: kolejność, liczby, flagi, played, limit 20, brak gościa, CLOSED pusty, nieznany kod.
- `tests/integration/votes-api.test.ts`: statusy 200/401/403/404/409/415, identyczne 404 dla REJECTED, nieistniejących i niepoprawnych id; GET z małymi literami, `no-store`, brak guestId/`createdByGuestId`/REJECTED w odpowiedzi, 404 dla kodu.
- `requests*.test.ts`: odrzucony utwór daje `TRACK_UNAVAILABLE` / 409 bez głosu (także przy wyścigu); 415 dla nie-JSON, a `application/json; charset=utf-8` przechodzi.
- e2e `tests/e2e/voting.spec.ts` (360 px, `/api/search` mockowane, własne dane):
  - dwa konteksty: gość A dodaje 2 utwory („Twoje”, własne serce wciśnięte, kolejność po dacie). Gość B lajkuje „Dancing Queen”: optymistycznie 2. U A po pollingu jest 2 i lista się przestawia.
  - reload B zachowuje serce; cofnięcie daje 1 u obu i powrót kolejności;
  - błąd 500 wstrzymany przez `page.route`: najpierw optymistyczne 2, potem rollback do 1 i toast;
  - serce ≥ 44 px, brak poziomego overflow;
  - DJ zamyka imprezę: obie strony pokazują „Impreza zakończona”, a POST głosu dostaje 403;
  - osobny test min-height po blurze (i zachowania go przy wynikach) oraz test 415 dla formularza i `text/plain`.
- `npm run check`: lint + typecheck + 215 testów, zielone. `npm run e2e`: 16/16. `voting` + `guest` z `--repeat-each 3`: 18/18.
- **Kontrola wizualna** (dev na porcie 3200; dane wstawione skryptem Prisma i usunięte po teście):
  - wydarzenie z 13 życzeniami: 9 w kolejce z różną liczbą głosów, jedno ACCEPTED, 3 PLAYED, 1 REJECTED z 50 głosami, bardzo długie tytuły i wykonawcy, 4 dodane przez „tego” gościa, część polubiona;
  - puste wydarzenie oraz wydarzenie z `requestsOpen=false`.
  - `scripts/ui-shots.mjs` (360, landscape, desktop) oraz własny przepływ Playwright 360 px: polub/cofnij, przewinięcie do „Zagrane”, fokus i blur wyszukiwarki (pełna strona), baner błędu pollingu, rollback z toastem, pusty stan, zamknięte zgłoszenia. Obejrzałem wszystkie PNG.
  - Poprawki po obejrzeniu:
    - odznaki „Twoje” + „Zaakceptowane” ściskały wykonawcę do jednej litery, więc dostały osobną linię i ciaśniejszy padding;
    - zepsute okładki pokazywały ikonę błędu, teraz jest fallback na nutę;
    - podtytuł przy zamkniętych zgłoszeniach mówił „Zaproponuj piosenkę”, teraz zachęca do lajkowania.
  - Sprawdzone:
    - hierarchia: nagłówek sekcji, numer, tytuł, wykonawca, serce;
    - serce 56×56 px z czytelnym licznikiem, polubione różowe na ciemnym tle;
    - „Zagrane” wyraźnie przygaszone; REJECTED niewidoczny;
    - obcinanie długich tekstów, brak poziomego overflow (0 px);
    - po blurze brak pustego ekranu pod listą; kontrast zinc-300/400 na zinc-950.
  - Serwer wyłączony.

DEV: DONE

### Tester (próba 1)
**Wyniki**
- `npm run check`: lint i typecheck OK, Vitest 23 pliki / 215 testów zielonych.
- `npm run e2e`: 16/16 zielonych (w tym 3 nowe w `voting.spec.ts`).
- `git diff tests/e2e/guest.spec.ts`: helpery przeniesione do `guest-helpers.ts`. Asercje `guest-mine` zastąpione równoważnymi („Twoje” na wierszu A po dodaniu i po reloadzie, brak „Twoje” u B i wciśnięte serce B). Żadna asercja nie została osłabiona. W `requests*.test.ts` są tylko dopisane testy i opcjonalny parametr content-type w helperze.

**Kryteria**
- ✅ GET listy: PENDING i ACCEPTED po głosach malejąco, potem po dacie; osobno 20 ostatnich PLAYED; REJECTED odfiltrowany w zapytaniu i w `buildGuestList`.
  - Testy: `tests/unit/guest-list.test.ts`, `tests/integration/votes.test.ts`, `votes-api.test.ts`.
  - Ręcznie (curl na dev): kolejność 7, 5 (starsze), 5, 3, 2, 1, 1, 0; REJECTED z 50 głosami niewidoczny; `cache-control: private, no-store`.
- ✅ `votes`, `votedByMe`, `mine` na każdej pozycji. W JSON nie ma guestId ani `createdByGuestId` (test zestawu kluczy i curl).
- ✅ POST/DELETE vote dodaje i usuwa głos; podwójny głos niemożliwy.
  - Testy: sekwencyjnie i 6× równolegle daje 1 wiersz; unikalność w DB.
  - Ręcznie: POST 200 (1), DELETE 200 (0), drugi DELETE 200 (0).
- ✅ Lajki przy `requestsOpen=false` działają (test plus curl 200 na wydarzeniu z zamkniętymi zgłoszeniami); CLOSED/DRAFT daje 403 (test integracyjny i e2e).
- ✅ UI: serce z licznikiem, optymistycznie, odznaka „Twoje”, sekcja „Zagrane”.
  - e2e i własny przepływ 360 px: tap od razu 0→1 i `aria-pressed=true`; cofnięcie wraca do 0.
  - Wstrzyknięty 500: optymistycznie 3, potem rollback do 2 i toast „Nie udało się zapisać głosu…”.
- ✅ SWR: `refreshInterval: 3000`, `fallbackData` z SSR. e2e sprawdza, że drugi gość widzi głos po pollingu.
- ✅ Testy jednostkowe sortowania i ukrywania REJECTED są w `tests/unit/guest-list.test.ts`.

**Uwagi z 007**
- ✅ Ponowne dodanie odrzuconego utworu daje 409 `TRACK_UNAVAILABLE` („Ten utwór nie może zostać dodany.”). Liczba głosów na REJECTED bez zmian (sprawdzone w DB).
- ✅ Gościnne POST/DELETE bez `application/json` dają 415 (curl: formularz i `text/plain`; testy). Bez ciasteczka: 401.
- ✅ Po blurze wyszukiwarki nie ma pustego ekranu pod listą (pełnostronicowy zrzut 360 px, test e2e).

TEST: PASS

### Reviewer (próba 1)
**Krytyczne**
1. **Okładki, które się nie załadują, zostają zepsutymi obrazkami. Fallback z `components/guest/TrackParts.tsx` nie działa dla list renderowanych na serwerze.**
   - Przyczyna: `<img onError>` jest w SSR-owanym HTML. Gdy błąd ładowania przyjdzie przed hydratacją (szybki 404, błąd DNS, słaba sieć na sali), React nie ma jeszcze podpiętego handlera, `failedUrl` się nie ustawia i przeglądarka pokazuje ikonę zepsutego obrazka.
   - Kontrola wizualna (dev 3200, 360 px):
     - wszystkie 8 nieudanych okładek po 4 s od załadowania i po `networkidle` ma `complete=true, naturalWidth=0` i jest widocznych jako zepsute obrazki w kolejce i w „Zagrane”;
     - dotyczy to także okładki z tego samego originu zwracającej 404 (`/brak-okladki.jpg`);
     - na ciemnym tle wygląda to fatalnie. Log developera twierdzi, że fallback działa, a zrzuty temu przeczą.
   - Naprawa:
     - w `Cover` dodać `ref` do `<img>` i `useEffect` po montażu, który wykrywa błąd sprzed hydratacji: `if (img.complete && img.naturalWidth === 0) setFailedUrl(url)` (zależność `[url]`);
     - alternatywnie zawsze renderować tło z ikoną nuty pod obrazkiem, a obrazek pokazywać dopiero po `onLoad` / `complete && naturalWidth > 0`;
     - dodać test e2e: `page.route("**/*.jpg", r => r.abort())` (albo 404) plus seed z `coverUrl`, potem sprawdzić, że po załadowaniu nie ma żadnego `img` z `naturalWidth === 0`, a w wierszu jest ikona nuty.

**Drobne (na później)**
- `countGuestRequests` liczy też REJECTED do limitu gościa. Gość widzi „5 z 5” przy 4 pozycjach „Twoje” i może wywnioskować, że coś mu odrzucono. To zachowanie z 007, ale warto rozstrzygnąć w 009 (nie liczyć REJECTED albo świadomie to zaakceptować).
- Dodanie utworu PLAYED nadal oddaje głos, a endpoint głosu daje 409. Do ujednolicenia w 009, zgodnie z notą developera.
- Odpowiedzi POST/DELETE vote nie mają `cache-control: no-store`. Dla POST/DELETE to bez znaczenia praktycznego; tylko dla spójności z GET.

**Sprawdzone bez zastrzeżeń**
- Bezpieczeństwo:
  - REJECTED nie trafia do gościa ani przez listę (zapytanie + czysta funkcja), ani przez vote (404 identyczne z nieistniejącym), ani przez add (neutralne 409 bez głosu);
  - brak cudzych guestId w odpowiedziach;
  - id walidowane zod-em (regex + max 64);
  - stan wydarzenia sprawdzany przy każdym głosie (DRAFT/CLOSED 403, `requestsOpen=false` dozwolone);
  - 415 jako ochrona CSRF dla gościnnych mutacji; ciasteczko gościa wymagane (401).
- Wydajność pollingu: stała liczba zapytań (event, 2× `findMany` z `_count` jako agregatem, własny głos przez relację z `take: 1` batchowaną przez Prismę). Brak N+1. SWR domyślnie nie odpytuje w ukrytej karcie.
- UI: optymistyczny update z `rollbackOnError`, blokada wielokrotnego tapnięcia, polskie teksty i odmiana, serce 56 px, brak poziomego overflow, czytelny baner zamkniętych zgłoszeń, przygaszone „Zagrane”, długie tytuły obcinane.
- Dane testowe usunięte z `dev.db`, serwer dev wyłączony.

REVIEW: CHANGES

### Developer (próba 2)
**Co zrobiłem**
- **Krytyczne z review: zepsute okładki** (`components/guest/TrackParts.tsx`, `Cover`):
  - Ikona nuty renderuje się zawsze pod spodem. `<img>` leży na niej (`absolute inset-0`) z `opacity-0` i pokazuje się dopiero po faktycznym załadowaniu.
  - Stan `{ url, status: loading | loaded | failed }` jest kluczowany po `url`, więc nowa okładka zaczyna od „loading”. Przy `failed` `<img>` jest usuwany z DOM.
  - Błąd sprzed hydratacji łapie `ref` + `useEffect([url])` po montażu: jeśli `img.complete`, to `naturalWidth > 0` daje „loaded”, a `naturalWidth === 0` daje „failed”. Później działają `onLoad`/`onError`.
  - Zepsuty obrazek nie pokaże się nawet przed hydratacją, bo do tego czasu `<img>` ma `opacity-0`.
  - Komponent zostaje wspólny: lista życzeń, „Zagrane” i wyniki wyszukiwania; nadaje się też dla panelu DJ-a. Dodałem `data-testid="track-cover"`, `data-cover-status` (`none|loading|loaded|failed`) i `data-testid="cover-fallback"`.
- **Drobne (decyzja orkiestratora)**:
  - `POST`/`DELETE /api/requests/[id]/vote`: każda odpowiedź (200 i wszystkie błędy 401/403/404/409/415) ma `Cache-Control: private, no-store`, tak jak GET listy.
  - `countGuestRequests` (`lib/requests.ts`) nie liczy już REJECTED. Odrzucone życzenie zwalnia miejsce w limicie, a licznik „X z Y” (SSR i `usedRequests` po dodaniu) nie zdradza odrzucenia. ACCEPTED i PLAYED dalej się liczą. Liczenie w transakcji przy dodawaniu używa tej samej funkcji.
- Kwestia „dodanie utworu PLAYED oddaje głos” zostaje na 009, zgodnie z decyzją.

**Zmienione pliki (w tej próbie)**
- `components/guest/TrackParts.tsx`
- `app/api/requests/[id]/vote/route.ts`
- `lib/requests.ts`
- `tests/integration/requests.test.ts`:
  - nowy test: zwolnienie miejsca po REJECTED, ale nie po ACCEPTED/PLAYED;
  - asercja w `listGuestRequests` zmieniona z 3 na 2 zgodnie z nową regułą. To zmiana wymagania, nie osłabienie testu.
- `tests/integration/votes-api.test.ts`: nowy test `no-store` dla 200/200/404/409/401/415.
- `tests/e2e/voting.spec.ts`: nowy test okładek.

**Jak testowałem**
- Nowy e2e „covers that fail to load fall back to the music note, even when they fail before hydration”:
  - `context.route(/dzcdn\.net/)`: jedna okładka dostaje PNG, jedna 404, jedna `abort`;
  - skrypty `/_next/static/**` są wstrzymane o 1,5 s, więc błędy okładek przychodzą przed hydratacją;
  - asercje: dla 404 i offline status `failed`, widoczna nuta, brak `<img>`; poprawna okładka ma status `loaded`, `opacity: 1` i `naturalWidth > 0`; na stronie nie ma żadnego widocznego `img` z `complete && naturalWidth === 0`; to samo dla wyników wyszukiwania.
  - Test sprawdzony negatywnie: po wyłączeniu sprawdzenia w `useEffect` pada (`loading` zamiast `failed`), czyli odtwarza błąd z review. `--repeat-each 4`: 4/4.
- `npm run check`: lint + typecheck + 217 testów zielonych. `npm run e2e`: 17/17.
- **Kontrola wizualna** (dev 3200, 360 px):
  - dane: 12 życzeń w kolejce i w „Zagrane”, mieszanka okładek:
    - poprawne (PNG podstawiony przez `route`),
    - 404 z prawdziwego CDN Deezera (nieistniejące id),
    - 404 z tego samego originu (`/brak-okladki.jpg`),
    - przerwane połączenie,
    - brak okładki.
  - Dwa przebiegi: normalny i ze skryptami opóźnionymi o 2 s (błąd przed hydratacją). W obu: statusy `loaded`/`failed`/`none` zgodne z oczekiwaniem i 0 widocznych zepsutych obrazków.
  - Na zrzutach (top i pełna strona) nieudane okładki pokazują szary kafelek z nutą, identyczny jak przy braku okładki. Poprawne okładki są widoczne, w „Zagrane” przygaszone. Układ wierszy bez zmian.
  - Dane usunięte (`deleteMany` użytkownika testowego z kaskadą), serwer wyłączony.

DEV: DONE

### Tester (próba 2)
**Wyniki**
- `npm run check`: lint i typecheck OK, Vitest 23 pliki / 217 testów zielonych.
- `npm run e2e`: 17/17 zielonych, w tym nowy test okładek w `tests/e2e/voting.spec.ts`.

**Krytyczne z próby 1: zepsute okładki (niezależna reprodukcja)**
- Dev na porcie 3200, własny seed (osobny użytkownik testowy): 12 życzeń w kolejce i w „Zagrane”, okładki: poprawne (PNG przez `route`), 404 z CDN, 404 z tego samego originu (`/brak-okladki.jpg`), przerwane połączenie, brak okładki. Widok 360 px.
- Liczyłem `img` z `complete && naturalWidth === 0` (wszystkie oraz widoczne, czyli z prostokątem i `opacity > 0`), także po przewinięciu do „Zagrane” i z powrotem:
  - normalnie: 0 zepsutych (także niewidocznych), 4 poprawne widoczne, statusy `loaded`/`failed`/`none` zgodne z danymi;
  - JS opóźniony o 3–4 s (opóźniałem tylko pliki `.js`, CSS ładuje się normalnie, więc okładki naprawdę padają przed hydratacją): przed hydratacją 5 `img` ma `complete && naturalWidth === 0`, ale wszystkie mają `opacity: 0`, czyli **0 widocznych**. Na zrzucie z tego momentu są tylko kafelki z nutą. Po hydratacji efekt montażu je usuwa (0 zepsutych w DOM), a poprawne okładki dostają `loaded` i stają się widoczne;
  - wszystkie zewnętrzne okładki z błędem DNS plus prawdziwe 404 z originu: wszystkie `failed`, 0 `img` w DOM.
- Obejrzałem PNG (przed hydratacją, góra, pełna strona): nieudane okładki to szary kafelek z nutą, identyczny jak przy braku okładki. Poprawne są widoczne, w „Zagrane” przygaszone. Układ bez zmian.
- Zauważyłem przy okazji: gdy opóźnia się cały `/_next/static/**` (tak robi test e2e), CSS też jest wstrzymany i przeglądarka nie zaczyna pobierać obrazków `loading="lazy"`. Developer sprawdził jednak test negatywnie (pada bez sprawdzenia w `useEffect`), więc test nadal łapie regresję. Uwaga drobna w review.

**Dwie drobne zmiany**
- ✅ `no-store` przy głosach (curl): POST 200, drugi POST 200 (idempotentny, 1 głos), DELETE 200, 415, 401, 404 mają `cache-control: private, no-store`. Jest też test w `votes-api.test.ts`.
- ✅ REJECTED nie liczy się do limitu. W `countGuestRequests` jest `status: { not: "REJECTED" }`. Nowy test pokazuje, że ACCEPTED i PLAYED dalej blokują limit, a REJECTED zwalnia miejsce.
  - Zmiana asercji 3→2 w `listGuestRequests` (`tests/integration/requests.test.ts`) wynika wprost z nowej reguły: gość ma 3 życzenia, w tym 1 REJECTED. Asercja dalej sprawdza dokładną liczbę, a stary komentarz opisywał regułę, którą świadomie zmieniono. To nie jest osłabienie.

**Regresja kryteriów**
- ✅ GET listy (curl): kolejka 9, 7, 6, 4, 3, 2, 1, 1, 0; 3 PLAYED; REJECTED „Bitwa” (50 głosów) niewidoczny; brak guestId w JSON; `votedByMe`/`mine` false dla obcego gościa.
- ✅ `votes`/`votedByMe`/`mine` na każdej pozycji.
- ✅ POST/DELETE vote działa idempotentnie, podwójny głos niemożliwy (testy integracyjne, w tym równoległe).
- ✅ Lajki przy `requestsOpen=false` działają, przy CLOSED nie (testy integracyjne i e2e).
- ✅ UI: serce z licznikiem, optymistycznie z rollbackiem, „Twoje”, „Zagrane” (e2e i zrzuty). Licznik „4 z 5” poprawny.
- ✅ SWR co 3 s (e2e: drugi gość widzi głos po pollingu).
- ✅ Testy jednostkowe sortowania i REJECTED (`tests/unit/guest-list.test.ts`).
- Dane testowe usunięte (`deleteMany` użytkownika z kaskadą, count 1), serwer 3200 wyłączony, port wolny.

TEST: PASS

### Reviewer (próba 2)
**Krytyczne**
- Brak. Problem z próby 1 jest naprawiony u źródła.
  - Nuta jest zawsze pod spodem, a `<img>` ma `opacity-0` aż do faktycznego `loaded`. Ikona zepsutego obrazka nie może się więc pokazać nawet bez JS i przed hydratacją.
  - Efekt po montażu (`img.complete` → `naturalWidth`) łapie błędy sprzed hydratacji. Obrazki leniwe, jeszcze niepobrane, mają `complete=false`, więc obsłużą je później `onLoad`/`onError`.
  - Stan kluczowany po `url` poprawnie resetuje się przy zmianie okładki.
  - Potwierdzone niezależną reprodukcją (wpis testera).

**Drobne (na później)**
- Test e2e okładek opóźnia cały `/_next/static/**`, czyli także CSS. Wtedy obrazki zaczynają się ładować dopiero razem z JS. Faktycznie łapie regresję (developer sprawdził negatywnie), ale opóźnianie tylko `*.js` lepiej oddaje scenariusz „okładka pada przed hydratacją”.
- Bez JS poprawne okładki zostają niewidoczne (`opacity-0`), widać tylko nutę. Strona gościa i tak wymaga JS, więc to akceptowalne.
- Bez zmian z próby 1: dodanie utworu PLAYED oddaje głos. Zostaje na 009.

**Sprawdzone bez zastrzeżeń**
- `app/api/requests/[id]/vote/route.ts`: `no-store` ustawiane na każdej odpowiedzi przez wspólny wrapper `handle`, bez duplikacji w gałęziach. Zod, 401, 403, 404, 409 i 415 bez zmian.
- `lib/requests.ts`:
  - `countGuestRequests` pomija REJECTED; ta sama funkcja działa w transakcji przy dodawaniu, więc limit i licznik „X z Y” są spójne;
  - wyścig równoległych dodań dalej chroniony transakcją;
  - odrzucenie nie wycieka przez licznik.
- Zmiana asercji 3→2 to uprawniona konsekwencja zmiany reguły, nie osłabienie. Dopisano test, który sprawdza graniczne przypadki ACCEPTED, PLAYED i REJECTED.
- Brak nowych zależności i zmian poza zakresem ticketu. Teksty UI po polsku.

REVIEW: APPROVE

### Orkiestrator
Próba 2: tester PASS, reviewer APPROVE (naprawione okładki). Dodawanie już zagranego utworu oddaje głos: do ujednolicenia w 009. Ticket zamknięty.
