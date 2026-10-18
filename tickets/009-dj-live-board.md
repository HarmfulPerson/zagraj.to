---
id: "009"
title: Tablica na żywo dla DJ-a
status: todo
depends_on: ["008"]
attempts: 0
---

## Cel
DJ widzi napływające życzenia i nimi zarządza w trakcie imprezy.

## Kryteria akceptacji
- [ ] `/panel/wydarzenia/[id]`: kolumny „Nowe” (PENDING), „Zaakceptowane”, „Zagrane”, „Odrzucone” (zwinięte); w każdej sortowanie po głosach
- [ ] Na karcie: okładka, tytuł, artysta, liczba głosów, czas dodania, link „Otwórz w Spotify” (`https://open.spotify.com/search/<artysta tytuł>` z encodeURIComponent)
- [ ] Akcje: Akceptuj, Odrzuć, Zagrane (ustawia `playedAt`), Cofnij do PENDING
- [ ] Przełącznik „Zgłoszenia otwarte” zmienia `requestsOpen`
- [ ] Nowe życzenia od ostatniego odświeżenia są wyróżnione; odświeżanie co 3 s
- [ ] Widok działa na tablecie i telefonie w poziomie (DJ ma go obok konsolety)
- [ ] API zmiany statusu sprawdza własność wydarzenia (test); testy przejść statusów życzenia

## Log
