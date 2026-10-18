---
id: "015"
title: Test e2e scenariusza głównego
status: todo
depends_on: ["011", "012", "014"]
attempts: 0
---

## Cel
Jeden test potwierdzający definicję „MVP gotowe” ze SPEC.md.

## Kryteria akceptacji
- [ ] Test Playwright z dwoma kontekstami przeglądarki gości (różne ciasteczka) i kontekstem DJ-a:
  DJ rejestruje się → tworzy i rozpoczyna wydarzenie → gość A otwiera `/e/<code>`, wyszukuje i dodaje utwór → gość B lajkuje go → DJ widzi 2 głosy → oznacza utwór jako zagrany → gość A widzi go w sekcji „Zagrane”
- [ ] Deezer zamockowany na poziomie sieci (`page.route`) lub przez zmienną środowiskową włączającą fake catalog
- [ ] Test przechodzi stabilnie 3 razy z rzędu (`--repeat-each=3`)
- [ ] README.md uzupełniony o sekcję „Uruchomienie aplikacji lokalnie” (instalacja, migracja, seed, dev)

## Log
