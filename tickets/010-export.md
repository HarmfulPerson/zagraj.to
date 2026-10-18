---
id: "010"
title: Eksport listy życzeń
status: todo
depends_on: ["009"]
attempts: 0
---

## Cel
DJ może wyjąć listę z aplikacji, np. żeby zbudować playlistę w Spotify lub rekordbox.

## Kryteria akceptacji
- [ ] `GET /api/events/[id]/export?format=csv`: kolumny tytuł, artysta, status, głosy, dodano, zagrano; UTF-8 z BOM (polskie znaki w Excelu)
- [ ] `format=txt`: linie „Artysta – Tytuł” w kolejności głosów, gotowe do wklejenia
- [ ] W panelu przyciski „Pobierz CSV” i „Kopiuj listę”, z filtrem statusów (domyślnie bez odrzuconych)
- [ ] Tylko właściciel wydarzenia (test)
- [ ] Testy jednostkowe formatów, w tym escapowania przecinków i cudzysłowów w CSV

## Uwagi
Ograniczenie eksportu do planu Pro dochodzi w tickecie 011.

## Log
