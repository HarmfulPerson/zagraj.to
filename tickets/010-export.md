---
id: "010"
title: Eksport listy życzeń
status: done
depends_on: ["009"]
attempts: 2
---

## Cel
DJ może wyjąć listę z aplikacji, np. żeby zbudować playlistę w Spotify lub rekordbox.

## Kryteria akceptacji
- [x] `GET /api/events/[id]/export?format=csv`: kolumny tytuł, artysta, status, głosy, dodano, zagrano; UTF-8 z BOM (polskie znaki w Excelu)
- [x] `format=txt`: linie „Artysta – Tytuł” w kolejności głosów, gotowe do wklejenia
- [x] W panelu przyciski „Pobierz CSV” i „Kopiuj listę”, z filtrem statusów (domyślnie bez odrzuconych)
- [x] Tylko właściciel wydarzenia (test)
- [x] Testy jednostkowe formatów, w tym escapowania przecinków i cudzysłowów w CSV

## Uwagi
Ograniczenie eksportu do planu Pro dochodzi w tickecie 011.

## Log

### Developer (próba 1)
**Co zrobiono**
- `lib/export.ts` (czysty, bez bazy, importowany też przez klienta): schemat zod zapytania (`format=csv|txt`, `status` powtarzany lub po przecinku, domyślnie wszystko poza REJECTED, nieznane wartości → 400), `selectExportRows` (filtr + kolejność z istniejącego `compareQueue`: głosy malejąco, potem najstarsze), `formatCsv` (BOM UTF-8, nagłówek `tytuł,artysta,status,głosy,dodano,zagrano`, CRLF, cudzysłowy wg RFC 4180, ochrona przed CSV/formula injection: komórki tekstowe zaczynające się od `= + - @`, tab lub CR dostają apostrof), polskie etykiety statusów (Nowe/Zaakceptowane/Zagrane/Odrzucone), `formatTxt` („Artysta – Tytuł” z półpauzą, łamania linii w tytułach zamieniane na spację, bez BOM), nazwy plików (slug ASCII z polskimi literami bez ogonków + data; `Content-Disposition: attachment; filename="…"; filename*=UTF-8''…` wg RFC 5987), `exportUrl` dla panelu.
- Daty w CSV: czas lokalny Europe/Warsaw w formacie `RRRR-MM-DD GG:MM` (czytelny, sortuje się jako tekst, Excel/LibreOffice/Sheets rozpoznają go jako datę i godzinę). Data w nazwie pliku: `startsAt` wydarzenia (zapisane jako północ UTC, więc brana w UTC), a bez daty dzień utworzenia wydarzenia w Europe/Warsaw.
- Separator CSV to przecinek (zgodnie z kryteriami). Uwaga: polski Excel domyślnie oczekuje średnika, więc przy dwukliku może pokazać wszystko w jednej kolumnie (Import z tekstu/CSV działa poprawnie). Nie dodałem linii `sep=,`, bo przy niej Excel ignoruje BOM i psuje polskie znaki. Do ewentualnej decyzji produktowej.
- `GET /api/events/[id]/export`: sesja (401), własność przez `findDjEvent` (404 dla cudzego/nieistniejącego wydarzenia, nie do odróżnienia), walidacja zod (400 `VALIDATION`), wiersze z istniejącego `loadBoardRows` (głosy w jednym zapytaniu), nagłówki `Cache-Control: private, no-store` (`noStore`), `X-Content-Type-Options: nosniff`, `text/csv` / `text/plain; charset=utf-8`.
- Panel: `components/panel/ExportControls.tsx`, sekcja „Eksport listy” na całą szerokość w zwijanym obszarze „Wydarzenie i QR” (tablica na żywo bez zmian). Filtr statusów jako chipy z checkboxami (domyślnie bez „Odrzucone”), „Pobierz CSV” (link z `download` do API z bieżącym filtrem), „Kopiuj listę” (pobiera txt i kopiuje do schowka przez `ClipboardItem` z obietnicą, żeby Safari nie odrzucił zapisu po `await`; zapasowo `writeText`). Komunikaty: „Skopiowano”, „Brak utworów o wybranych statusach.”, błędy sieci po polsku, „Wybierz co najmniej jeden status.” (wtedy przyciski nieaktywne). Ciemny styl jak reszta kart na stronie tablicy.
- Ograniczenia do planu Pro nie dodawałem (ticket 011).

**Zmienione / nowe pliki**
- `lib/export.ts` (nowy)
- `app/api/events/[id]/export/route.ts` (nowy)
- `components/panel/ExportControls.tsx` (nowy)
- `app/panel/wydarzenia/[id]/page.tsx` (sekcja eksportu w `ManageEvent`)
- `tests/unit/export.test.ts` (nowy, 15 testów: zapytanie i domyślny filtr, kolejność, daty lato/zima, escapowanie przecinków/cudzysłowów/nowych linii, formula injection, BOM/CRLF/nagłówek, TXT, slug i Content-Disposition)
- `tests/integration/export-api.test.ts` (nowy, 6 testów: CSV z BOM i nagłówkami pobierania, TXT z filtrem, 404 dla innego DJ-a, 401, 400 zod, data z dnia utworzenia)
- `tests/e2e/export.spec.ts` (nowy: DJ pobiera CSV — sprawdzane bajty BOM, polskie znaki, escapowanie, apostrof przed `=1+1`, pominięte odrzucone, nazwa pliku z „Ł”; kopiuje listę z zaznaczonymi „Odrzucone” — sprawdzany schowek i „Skopiowano”; brak statusów blokuje przyciski; inny DJ → 404)

**Testy**
- `npm run check`: lint, typecheck, 288 testów — OK.
- `npm run e2e`: 20/20 — OK.
- Kontrola wizualna: serwer dev na porcie 3200, świeży DJ z wydarzeniem LIVE i życzeniami z polskimi znakami, przecinkami, cudzysłowami i `=SUMA(A1)` (statusy: Nowe, Zaakceptowane, Zagrane, Odrzucone). Zrzuty strony wydarzenia z rozwiniętym „Wydarzenie i QR” w tablet-landscape (1180×820) i phone-360 przez skrypt Playwright (brak poziomego przewijania w obu). Po pierwszym zrzucie zaznaczone chipy były za słabo odróżnialne od niezaznaczonych, więc wzmocniłem ich styl (wypełnienie fioletem, ptaszek) i zrobiłem zrzuty jeszcze raz. Na telefonie przyciski są na całą szerokość, chipy się zawijają. Wygenerowany CSV obejrzany ręcznie: BOM `EF BB BF`, CRLF, `"Kayah, Bregović"`, `"Zażółć, ""gęślą"" jaźń"`, `'=SUMA(A1)`, kolejność według głosów, daty w czasie warszawskim, brak odrzuconych. TXT z półpauzą i w poprawnej kolejności. Dane testowe usunięte z dev.db (użytkownicy `visual-export-*`, kaskadowo wydarzenia/życzenia/głosy), serwer wyłączony.

### Tester (próba 1)
**Wyniki**
- `npm run check`: OK (lint, typecheck, 29 plików / 288 testów).
- `npm run e2e` (cały zestaw, równolegle): **1 failed / 19 passed**. Pada `tests/e2e/export.spec.ts:58` — `expect(lines).toHaveLength(4)`, otrzymano 5: w pobranym CSV jest wiersz `Ona tańczy dla mnie,Weekend,Nowe,…`, czyli odrzucenie nie zdążyło dotrzeć do serwera. Ten sam spec uruchomiony osobno (`--repeat-each=4`) przechodzi 4/4, więc test jest niestabilny (wyścig), a nie błędny w kodzie aplikacji.
- Przyczyna: `DjBoard.act()` robi optymistyczną aktualizację (`optimisticData`), więc `toHaveCount(2)` w kolumnie PENDING jest spełnione od razu, zanim `POST /api/requests/:id/status` zapisze REJECTED. Pod obciążeniem (cały zestaw równolegle) klik „Pobierz CSV” wyprzedza zapis.

**Kryteria**
- ✅ CSV: kolumny `tytuł,artysta,status,głosy,dodano,zagrano`, UTF-8 z BOM — `lib/export.ts` (`formatCsv`), testy unit + integracja (bajty `EF BB BF`); ręcznie: `xxd` pokazuje `efbb bf74 7974 75c5 82…`, CRLF, `text/csv; charset=utf-8`. Separator przecinek bez `sep=` (zaakceptowane przez orkiestratora).
- ✅ TXT: „Artysta – Tytuł” (półpauza `e2 80 93`) w kolejności głosów (`compareQueue`, remis → starsze); ręcznie: Weekend (3) przed @Kult (3, później dodany), potem utwory z 1 głosem od najstarszego.
- ✅ Panel: „Pobierz CSV”, „Kopiuj listę”, filtr statusów domyślnie bez „Odrzucone” — `components/panel/ExportControls.tsx`, e2e (sprawdza checkboxy, pobranie, schowek, blokadę przy braku statusów). Zrzuty tablet-landscape i phone-360: brak poziomego przewijania, chipy czytelne (zaznaczone z ptaszkiem), przyciski na całą szerokość na telefonie, komunikat „Wybierz co najmniej jeden status.” po polsku.
- ✅ Tylko właściciel (test): integracja (404 dla innego DJ-a i nieistniejącego, 401 bez sesji) + e2e (inny DJ → 404 bez `Content-Disposition`); ręcznie curl: 401 bez ciasteczka, 400 dla `format=pdf` i `status=X`.
- ✅ Testy jednostkowe formatów, w tym escapowanie przecinków i cudzysłowów — `tests/unit/export.test.ts` (`csvCell`, `formatCsv`, formula injection, nowe linie, BOM/CRLF, TXT, nazwy plików). Testy sprawdzają realne wartości, żadnych istniejących testów nie usunięto ani nie osłabiono (`git diff` dotyczy tylko `page.tsx` i ticketu).

**Ręczna kontrola (port 3200)**: świeży DJ, wydarzenie o nazwie `Wesele "Ani"; Łódź\r\nX-Evil: 1 Żółć`, utwory z polskimi znakami, przecinkami, cudzysłowami, `=HYPERLINK("http://zlo","x")`, artyści `@Kult`, `-sanah`. Nagłówek: `filename="wesele-ani-lodz-x-evil-1-zolc-2026-10-19.csv"; filename*=UTF-8''Wesele%20Ani%20%3B%20%C5%81%C3%B3d%C5%BA%20X-Evil%201%20…` — bez CRLF i cudzysłowów, brak wstrzyknięcia nagłówka. CSV: `"'=HYPERLINK(""http://zlo"",""x"")",'@Kult,…`, `"Zażółć, ""gęślą"" jaźń",Łzy,…`, `"Kayah, Bregović"`, odrzucony pominięty. Dane usunięte (użytkownik `tester-010-*`, kaskadowo), serwer wyłączony.

**Do naprawy (FAIL)**
1. `tests/e2e/export.spec.ts`, przy odrzucaniu „Ona tańczy”: poczekać na odpowiedź serwera zamiast na optymistyczny stan, np.
   `const saved = page.waitForResponse((r) => r.url().includes("/status") && r.request().method() === "POST" && r.ok());` przed kliknięciem „Odrzuć” i `await saved;` po nim (albo asercja na karcie w kolumnie odrzuconych, jeśli jest renderowana po stronie serwera). Potem uruchomić cały `npm run e2e` (równolegle) co najmniej 2–3 razy.

TEST: FAIL

### Reviewer (próba 1)
**Krytyczne**
1. Niestabilny test e2e (wyścig z optymistyczną aktualizacją tablicy) — `tests/e2e/export.spec.ts`, opis i poprawka jak u testera. Bez tego `npm run e2e` losowo nie przechodzi. Kod aplikacji nie wymaga zmian.

**Bezpieczeństwo — OK**
- `app/api/events/[id]/export/route.ts`: sesja (401), własność przez istniejący `findDjEvent` (404 nieodróżnialne od nieistniejącego), id przez `eventIdSchema`, zapytanie przez zod (`exportQuerySchema`, nieznany format/status → 400). Kolejność: najpierw własność, potem walidacja — nie ujawnia istnienia cudzych wydarzeń.
- `Content-Disposition`: ASCII `filename` ze sluga + `filename*` RFC 5987 z usuniętymi znakami sterującymi, cudzysłowami, ukośnikami; procentowe kodowanie `'()*`. Sprawdzone ręcznie z CRLF i cudzysłowami w nazwie — brak wstrzyknięcia.
- CSV injection: apostrof przed `= + - @ \t \r`, cytowanie RFC 4180. `no-store`, `nosniff`, poprawne `charset`.

**Zgodność / jakość — OK**
- Reużycie: `loadBoardRows` (głosy w jednym zapytaniu, bez N+1), `compareQueue`, `REQUEST_STATUSES`, `noStore`/`validationError` — bez duplikowania liczenia głosów.
- Teksty UI po polsku; brak ograniczenia do Pro (zgodnie z uwagą — ticket 011).

**Drobne**
- Apostrof dodawany też przed `-` zmienia nazwy typu „-M-” (zgodne z zaleceniem OWASP, akceptowalne).
- API tworzenia wydarzenia przyjmuje nazwę z `\r\n` (sprzed tego ticketu) — eksport to neutralizuje, ale warto kiedyś normalizować nazwę przy zapisie.
- Nieaktywny przycisk „Kopiuj listę” (`opacity-50`) w ciemnym motywie mało różni się od aktywnego; można go przyciemnić mocniej, jak „Pobierz CSV”.
- Separator przecinek: polski Excel przy dwukliku pokaże jedną kolumnę (decyzja produktowa, odnotowana przez developera).

REVIEW: CHANGES

### Developer (próba 2)
**Co zrobiono**
- Krytyczne (niestabilny e2e): nowy helper `clickAndWaitForSave(page, target, path, method = "POST")` w `tests/e2e/guest-helpers.ts` — `page.waitForResponse` ustawiany przed kliknięciem, czekanie po kliknięciu i asercja `response.ok()`. W `tests/e2e/export.spec.ts` „Odrzuć” czeka teraz na odpowiedź `POST /api/requests/:id/status`, zanim test pobierze CSV (asercja na optymistycznej kolumnie zostaje).
- Ten sam wzorzec (optymistyczny UI, a potem reload/API/eksport) utwardzony w innych specach, bez osłabiania asercji:
  - `tests/e2e/dj-board.spec.ts`: „Akceptuj”, „Zagrane” (potem reload i `GET /board`), „Odrzuć”, „Cofnij do nowych” → czekanie na `POST …/status`; przełącznik „Zgłoszenia otwarte” (potem reload) → czekanie na `POST …/requests-open`.
  - `tests/e2e/voting.spec.ts`: polubienie przez gościa B (potem reload) — nadal sprawdzany natychmiastowy optymistyczny stan, dodatkowo czekanie na `POST …/vote`; cofnięcie polubienia → czekanie na `DELETE …/vote`.
  - Pozostałe specy (`guest`, `events`, `auth`, `home`, `poster`) nie używają optymistycznych mutacji (komunikaty pokazują się dopiero po odpowiedzi serwera) — bez zmian.
- Drobne (stan nieaktywny w ciemnym motywie): `components/panel/ExportControls.tsx` — gdy nie wybrano statusu, „Pobierz CSV” (span) i „Kopiuj listę” mają `aria-disabled="true"`, `cursor-not-allowed`, przerywaną ramkę, przezroczyste tło, wyszarzony tekst i `opacity-60` (bez fioletowego wypełnienia); hover nie działa na nieaktywnym przycisku (`enabled:hover:`). Podczas kopiowania przycisk jest `disabled` z `cursor-wait`, bez wyglądu „nieaktywny”. Ikona pobierania też w stanie nieaktywnym (stały układ). W e2e dopisane asercje `aria-disabled="true"` dla obu kontrolek.

**Zmienione pliki**
- `tests/e2e/guest-helpers.ts` (helper `clickAndWaitForSave`)
- `tests/e2e/export.spec.ts`
- `tests/e2e/dj-board.spec.ts`
- `tests/e2e/voting.spec.ts`
- `components/panel/ExportControls.tsx`

**Testy**
- `npm run check`: lint, typecheck, 29 plików / 288 testów — OK.
- Pełny `npm run e2e` (równolegle) 3 razy z rzędu: 20/20, 20/20, 20/20 (ok. 35 s każdy). (Wcześniejsza seria wykryła, że cofnięcie głosu to `DELETE`, nie `POST` — helper dostał parametr `method`; potem 3× zielono.)
- Kontrola wizualna: serwer dev na porcie 3200, skrypt Playwright, phone-360, `colorScheme: dark`, zrzuty sekcji „Eksport listy” w stanie aktywnym i bez statusów. Aktywne: fioletowy „Pobierz CSV”, „Kopiuj listę” z pełną ramką; nieaktywne: oba przyciski wyraźnie wyszarzone, przerywana ramka, brak wypełnienia, komunikat „Wybierz co najmniej jeden status.”. Brak poziomego przewijania. Dane usunięte z dev.db (użytkownik `visual-export2-*`, kaskadowo wydarzenie), serwer wyłączony, skrypt usunięty.

### Tester (próba 2)
**Wyniki**
- `npm run check`: OK (lint, typecheck, 29 plików / 288 testów).
- Pełny `npm run e2e` (równolegle, `retries: 0` lokalnie) 3 razy z rzędu: **20/20, 20/20, 20/20** (ok. 35 s każdy), w logach brak `flaky` i `failed`. Niestabilność z próby 1 (`export.spec.ts`, 5 wierszy zamiast 4) nie wystąpiła.

**Utwardzenie specyfikacji (`git diff tests/e2e`)**
- `guest-helpers.ts`: `clickAndWaitForSave` ustawia `waitForResponse` przed kliknięciem (bez wyścigu), dopasowuje metodę i ścieżkę regexem na `pathname` i dodatkowo sprawdza `response.ok()`, więc to wzmocnienie testu.
- `export.spec.ts`: „Odrzuć” czeka na `POST /api/requests/:id/status`, asercja na optymistycznej kolumnie (`toHaveCount(2)`) zostaje. Dopisane asercje `aria-disabled="true"` dla obu kontrolek. Żadnej asercji nie usunięto.
- `dj-board.spec.ts`: Akceptuj / Zagrane / Odrzuć / Cofnij do nowych / przełącznik zgłoszeń, czyli tylko zamiana `.click()` na `clickAndWaitForSave(...)`. Wszystkie `expect` bez zmian.
- `voting.spec.ts`: nadal sprawdzany natychmiastowy stan optymistyczny (`aria-pressed`, licznik „2”), dodatkowo czekanie na `POST …/vote` z `ok()`. Cofnięcie głosu czeka na `DELETE …/vote`. Asercje bez zmian.

**Kryteria**: bez zmian względem próby 1, wszystkie ✅ (CSV z BOM i kolumnami, TXT w kolejności głosów, panel z filtrem domyślnie bez odrzuconych, tylko właściciel z testami integracyjnymi i e2e, testy jednostkowe escapowania). Kod API i `lib/export.ts` nie zmieniał się w próbie 2.

**Stan nieaktywny (kontrola wizualna)**: serwer dev na porcie 3200, skrypt Playwright, phone-360, `colorScheme: dark`, świeży DJ `tester-010-*`. Stan aktywny: fioletowy „Pobierz CSV”, „Kopiuj listę” z pełną ramką, zaznaczone chipy z ptaszkiem. Po odznaczeniu wszystkich statusów (zrzut po wygaśnięciu przejść CSS) oba przyciski są wyraźnie wyszarzone: przerywana ramka, przezroczyste tło, `opacity: 0.6`, `cursor: not-allowed`, identyczny kolor tekstu (computed style sprawdzony dla obu). Komunikat „Wybierz co najmniej jeden status.” na czerwono, brak poziomego przewijania (`scrollWidth − clientWidth = 0`). Dane usunięte (1 użytkownik, kaskadowo), serwer wyłączony, port 3200 wolny.

TEST: PASS

### Reviewer (próba 2)
**Krytyczne**: brak. Uwaga krytyczna z próby 1 (niestabilny e2e) została naprawiona właściwą metodą: test czeka na odpowiedź serwera, a nie na stan optymistyczny. Potwierdzone 3 zielonymi pełnymi przebiegami.

**Przegląd zmian próby 2**
- Helper `clickAndWaitForSave` jest wspólny i nie duplikuje logiki w specach, a komunikat błędu zawiera metodę, URL i status. Wzorzec zastosowano tam, gdzie po optymistycznej akcji następuje reload, API albo eksport. Pozostałe specy słusznie bez zmian.
- `ExportControls.tsx`: stan nieaktywny odróżniony od stanu „kopiuję” (`disabled` + `cursor-wait` bez wyglądu „nieaktywny”), hover tylko dla `enabled:`, `aria-disabled` na spanie i przycisku, teksty po polsku. Kod aplikacji poza tym komponentem nie zmienił się w próbie 2, więc ocena bezpieczeństwa z próby 1 (sesja, własność, zod, Content-Disposition, CSV injection) pozostaje aktualna.

**Drobne**
- `<span aria-disabled="true">` bez roli nie jest ogłaszany przez czytniki ekranu jako nieaktywna kontrolka. Można dodać `role="link"` albo zostawić tak, bo komunikat `aria-live` i tak wyjaśnia stan.
- W `voting.spec.ts` polubienie czeka na odpowiedź ręcznie (żeby sprawdzić stan optymistyczny przed odpowiedzią) zamiast przez helper. Uzasadnione, tylko lekko niespójne.
- Uwagi drobne z próby 1 (separator przecinek w polskim Excelu, normalizacja `\r\n` w nazwie wydarzenia przy zapisie) nadal do decyzji na później.

REVIEW: APPROVE

### Orkiestrator
Próba 2: tester PASS (e2e 3× 20/20), reviewer APPROVE. Separator przecinek zgodnie z kryteriami (polski Excel: import przez Dane → Z tekstu/CSV). Ticket zamknięty.
