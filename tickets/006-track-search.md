---
id: "006"
title: Wyszukiwarka utworów (Deezer)
status: todo
depends_on: ["001"]
attempts: 0
---

## Cel
Endpoint wyszukiwania utworów, z którego korzysta strona gościa.

## Kryteria akceptacji
- [ ] `lib/catalog/` z interfejsem `TrackCatalog` (`search(query): Promise<Track[]>`) i implementacją Deezer. Interfejs pozwoli później dodać inne źródła.
- [ ] `Track`: id, title, artist, coverUrl, durationSec
- [ ] `GET /api/search?q=...`: zapytanie 2–100 znaków (zod), max 15 wyników
- [ ] Rate limit 20 zapytań na minutę na guestId (w pamięci, z interfejsem do późniejszej wymiany na Redis); przekroczenie zwraca 429 z komunikatem po polsku
- [ ] Cache w pamięci identycznych zapytań na 5 minut
- [ ] Błąd lub timeout Deezera (5 s) zwraca 502 z czytelnym komunikatem, bez stack trace
- [ ] Testy z zamockowanym `fetch`: mapowanie odpowiedzi, rate limit, cache, obsługa błędu

## Log
