# ZagrajTo — specyfikacja MVP

> Robocza nazwa. Aplikacja do zbierania życzeń muzycznych od gości na imprezach.

## Problem
Goście podchodzą do DJ-a z prośbami w trakcie grania, wołają przez muzykę, powtarzają te same utwory. DJ nie wie, czego chce większość sali.

## Rozwiązanie
DJ tworzy wydarzenie i wystawia kod QR. Goście skanują go telefonem (bez instalacji i bez logowania), wyszukują utwory, dodają je do listy życzeń i lajkują propozycje innych. DJ widzi na żywo listę posortowaną po popularności i oznacza utwory jako zaakceptowane, odrzucone lub zagrane.

## Użytkownicy
- **DJ** (płacący klient): zakłada konto, tworzy wydarzenia, zarządza listą, kupuje subskrypcję.
- **Gość**: anonimowy, identyfikowany ciasteczkiem urządzenia. Dodaje i lajkuje utwory.

## Główny rynek
Polscy DJ-e, szczególnie weselni. Interfejs po polsku, ceny w PLN.

## Stack (decyzje)
- **Next.js (App Router) + TypeScript + Tailwind CSS**
- **Prisma + SQLite** w dev, schemat gotowy do przejścia na Postgres
- **Auth DJ-a:** email + hasło (bcrypt) z sesją w ciasteczku httpOnly (iron-session)
- **Gość:** anonimowy `guestId` (UUID) w ciasteczku
- **Odświeżanie na żywo:** polling co 3 s (SWR). SSE lub WebSockets dopiero po MVP.
- **Katalog utworów:** publiczne API Deezer (`https://api.deezer.com/search?q=...`), bez klucza, wywoływane przez proxy w API route
- **Spotify:** w MVP bez logowania przez Spotify (limit 5 użytkowników w trybie deweloperskim). Zamiast tego linki „Otwórz w Spotify” (`https://open.spotify.com/search/<artysta tytuł>`) i eksport listy.
- **Płatności:** Stripe Checkout + Customer Portal + webhook (BLIK i Przelewy24 włącza się w panelu Stripe)
- **QR:** biblioteka `qrcode`
- **Testy:** Vitest (unit/integration), Playwright (e2e)

## Model danych
- `User` (DJ): id, email (unikalny), passwordHash, displayName, plan (`FREE` | `PRO`), stripeCustomerId?, stripeSubscriptionId?, planRenewsAt?, createdAt
- `Event`: id, djId → User, name, code (6 znaków, unikalny, bez mylących znaków 0/O/1/I), startsAt?, status (`DRAFT` | `LIVE` | `CLOSED`), requestsOpen (bool), maxRequestsPerGuest (domyślnie 5), createdAt
- `Request`: id, eventId → Event, trackId (Deezer), title, artist, coverUrl?, durationSec?, status (`PENDING` | `ACCEPTED` | `REJECTED` | `PLAYED`), createdByGuestId, createdAt, playedAt?. Unikalność: (eventId, trackId).
- `Vote`: id, requestId → Request, guestId, createdAt. Unikalność: (requestId, guestId).

Dodanie utworu, który już jest na liście, nie tworzy duplikatu, tylko oddaje głos.

## Ekrany
**Publiczne**
- `/` landing z wyjaśnieniem i CTA
- `/cennik` plany Free i Pro
- `/logowanie`, `/rejestracja`

**Gość**
- `/e/[code]` lista życzeń wydarzenia: wyszukiwarka, dodawanie, lajki, oznaczenie „Twoje”, sekcja „Zagrane”
- Zamknięte wydarzenie pokazuje komunikat; zamknięte zgłoszenia pozwalają tylko lajkować

**DJ (wymaga logowania)**
- `/panel` lista wydarzeń
- `/panel/wydarzenia/nowe`
- `/panel/wydarzenia/[id]` tablica na żywo: kolumny według statusu, sortowanie po głosach, akcje, przełącznik „zgłoszenia otwarte”, kod QR, start i zamknięcie wydarzenia, eksport
- `/panel/wydarzenia/[id]/plakat` plakat A4 z QR do druku
- `/panel/subskrypcja` plan, przejście do Stripe Checkout lub Customer Portal

## Plany (założenie, do weryfikacji)
- **Free:** 1 wydarzenie w stanie LIVE na miesiąc kalendarzowy, do 100 życzeń na wydarzenie, bez eksportu
- **Pro (39 zł/mies.):** bez limitów, eksport CSV/tekst, własny tekst na plakacie

## Ochrona przed nadużyciami
- Limit życzeń na gościa na wydarzenie (`maxRequestsPerGuest`)
- Rate limit wyszukiwania: 20 zapytań na minutę na guestId
- DJ może zamknąć zgłoszenia; odrzucone utwory nie są widoczne dla gości
- Walidacja wszystkich wejść (zod)

## Poza MVP
Napiwki, logowanie przez Spotify i dodawanie do playlisty, Apple Music, rozpoznawanie granego utworu, planowanie przed imprezą przez parę młodą, analityka po imprezie, plan dla agencji, aplikacje natywne.

## Definicja „MVP gotowe”
Wszystkie tickety mają status `done`, a test e2e scenariusza głównego przechodzi. Scenariusz: DJ się rejestruje → tworzy wydarzenie → gość A dodaje utwór → gość B go lajkuje → DJ widzi 2 głosy → oznacza utwór jako zagrany → gość widzi go w sekcji „Zagrane”.
