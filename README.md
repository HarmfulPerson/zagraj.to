# ZagrajTo — aplikacja budowana przez pętlę agentów

Ten folder nie zawiera jeszcze kodu aplikacji. Zawiera wszystko, czego potrzebują agenci Claude Code, żeby ją zbudować:

| Plik / folder | Do czego służy |
|---|---|
| `SPEC.md` | Co budujemy: produkt, stack, model danych, ekrany, plany. **Przeczytaj i popraw przed startem.** |
| `CLAUDE.md` | Zasady pracy, które Claude Code czyta przy każdym uruchomieniu |
| `tickets/` | Backlog: 15 ticketów z kryteriami akceptacji, statusem i logiem prób |
| `.claude/agents/` | Subagenci: `planner`, `developer`, `tester`, `reviewer` |
| `.claude/commands/next-ticket.md` | Orkiestrator, komenda `/next-ticket` |
| `.claude/settings.json` | Uprawnienia: co agenci mogą robić bez pytania (npm, git commit), a czego nigdy (git push, rm -rf, czytanie .env) |
| `scripts/loop.sh` | Pętla: uruchamia `/next-ticket` raz po razie, aż wszystko będzie gotowe albo coś będzie wymagało Ciebie |

## Jak działa pętla

```
/next-ticket  →  bierze następny ticket
               →  developer implementuje + pisze testy
               →  tester uruchamia testy i sprawdza kryteria  ──FAIL──┐
               →  reviewer sprawdza bezpieczeństwo i jakość  ──CHANGES─┤
               →  status: done + git commit                           │
                                                                      │
 kolejna iteracja: ten sam ticket wraca do developera z raportem  ◄───┘
 (max 3 próby, potem status blocked i pętla czeka na Ciebie)
```

Gdy backlog się skończy, `planner` porównuje aplikację ze `SPEC.md` i dopisuje brakujące tickety albo ogłasza, że MVP jest gotowe.

## Wymagania

- **Node.js 20+** i **git**
- **Claude Code**. Instalacja (macOS / Linux / WSL):
  ```bash
  curl -fsSL https://claude.ai/install.sh | bash
  ```
  Windows (PowerShell): `irm https://claude.ai/install.ps1 | iex`
  Szczegóły: https://code.claude.com/docs/en/overview
- Konto Claude z płatnym planem (Pro / Max) albo klucz API z Anthropic Console. Pętla zużywa dużo tokenów: przy całym backlogu realnie są to godziny pracy agentów. Na planie Pro szybko trafisz na limity, Max albo API sprawdzą się lepiej.

## Krok po kroku

```bash
# 1. Rozpakuj i wejdź do folderu
unzip zagrajto.zip && cd zagrajto

# 2. Repozytorium git (pętla commituje po każdym tickecie)
git init
git add -A
git commit -m "chore: project setup"

# 3. Uruchom Claude Code i zaloguj się przy pierwszym starcie
claude
```

**4. Najpierw pracuj interaktywnie.** W sesji Claude Code wpisz:

```
/next-ticket
```

Zrób tak dla 2–3 pierwszych ticketów i obserwuj, co robią agenci. Claude Code zapyta o zgodę na polecenia spoza listy w `settings.json`. Akceptuj świadomie. Po każdym tickecie sprawdź `git log` i odpal `npm run dev`.

**5. Gdy ufasz procesowi, puść pętlę** (wyjdź z Claude Code, `/exit`):

```bash
chmod +x scripts/loop.sh
MAX_ITER=5 ./scripts/loop.sh     # na początek krótko
./scripts/loop.sh                # potem do 30 iteracji
```

Logi każdej iteracji trafiają do `logs/`.

## Gdy pętla się zatrzyma

| Komunikat | Co zrobić |
|---|---|
| `STATUS: NEEDS_HUMAN <id>` | Otwórz `tickets/<id>-*.md`, sekcja **Log** mówi, czego brakuje (np. klucza). Dostarcz to, zmień status na `in-progress` i uruchom pętlę ponownie. |
| `STATUS: BLOCKED <id>` | 3 nieudane próby. Przeczytaj Log, popraw ticket (doprecyzuj kryteria, podziel na mniejsze) albo napraw sam z pomocą `claude`. Ustaw `status: todo` i `attempts: 0`. |
| `STATUS: ALL_DONE` | MVP gotowe. Zrób przegląd, przetestuj ręcznie, zdecyduj o kolejnych funkcjach i dopisz je do SPEC. |
| brak linii STATUS | Zwykle skończył się limit tur albo limit planu. Sprawdź log i uruchom ponownie; stan jest w plikach i gicie, nic nie ginie. |

## Twoje checkpointy (nie pomijaj)

1. **Przed startem:** przeczytaj `SPEC.md`. Zmień nazwę, ceny, limity planów. Agenci budują dokładnie to, co tam jest.
2. **Po tickecie 001:** czy projekt się uruchamia (`npm run dev`)?
3. **Po tickecie 007–009:** przetestuj z telefonu: QR, dodawanie, lajki, tablica DJ-a. To serce produktu.
4. **Przed 012 (Stripe):** załóż konto Stripe w trybie testowym, utwórz produkt „Pro” z ceną w PLN i wpisz klucze do `.env.local`.

## Bezpieczeństwo

- Agenci **nie mogą** robić `git push`, `rm -rf` ani czytać `.env.local` (zablokowane w `.claude/settings.json`).
- Nie używaj `--dangerously-skip-permissions` na swoim komputerze. Jeśli chcesz pełnej autonomii, uruchamiaj pętlę w kontenerze lub na osobnej maszynie wirtualnej.
- Przed wdrożeniem na produkcję przejrzyj kod sam albo daj go do review człowiekowi. Chodzi tu o auth, płatności i dane gości.
