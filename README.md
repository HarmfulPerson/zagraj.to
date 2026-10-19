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

## Uruchomienie aplikacji lokalnie

### Wymagania
- **Node.js 20.19+ albo 22.12+** (z npm; wymóg Prismy 7). Baza to plik SQLite, nic więcej nie trzeba instalować.

### Pierwsze uruchomienie

```bash
# 1. Zależności (postinstall uruchamia też `prisma generate`)
npm install

# 2. Konfiguracja
cp .env.example .env.local
openssl rand -hex 32          # wklej wynik jako SESSION_SECRET w .env.local

# 3. Baza danych: tworzy dev.db i stosuje migracje
npx prisma migrate dev

# 4. Dane demo (można powtarzać, odtwarza wydarzenie demo)
npx prisma db seed

# 5. Serwer deweloperski → http://localhost:3000
npm run dev
```

Zmienne w `.env.local` (opisane też w `.env.example`; pliku `.env.local` nie commituj):

| Zmienna | Znaczenie |
|---|---|
| `DATABASE_URL` | Plik bazy SQLite względem katalogu projektu, domyślnie `file:./dev.db`. Testy integracyjne (Vitest) zawsze używają osobnego `file:./test.db`. |
| `SESSION_SECRET` | Klucz szyfrujący ciasteczko sesji DJ-a, min. 32 znaki. Wygeneruj: `openssl rand -hex 32`. Wymagany na produkcji. |
| `NEXT_PUBLIC_APP_URL` | Publiczny adres aplikacji, z którego budowane są linki i kody QR dla gości (`<adres>/e/<kod>`). Lokalnie `http://localhost:3000`. Zmiana wymaga restartu `npm run dev`. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO` | **Opcjonalne.** Płatności za plan Pro. Bez nich aplikacja działa, a strona subskrypcji pokazuje „Płatności nie są skonfigurowane”. |

### Dane demo
Po `npx prisma db seed`:
- logowanie DJ-a na `/logowanie`: **dj@example.com** / **haslo1234**
- trwające wydarzenie „Wesele Ani i Tomka” z kodem **WESELE**: strona gościa to http://localhost:3000/e/WESELE (kilka utworów na liście, w tym zaakceptowany, zagrany i odrzucony)

### Testy

```bash
npm run check                    # lint + typecheck + testy jednostkowe/integracyjne (Vitest)

npx playwright install chromium  # tylko raz: przeglądarka dla Playwrighta
npm run e2e                      # testy e2e (Playwright)
```

`npm run e2e` sam uruchamia serwer deweloperski na porcie 3100 (inny port: `E2E_PORT=3200 npm run e2e`) i korzysta z bazy z `DATABASE_URL`, więc najpierw wykonaj `npx prisma migrate dev`. Testy zakładają w tej bazie własnych DJ-ów i wydarzenia. Deezer i Stripe są w testach mockowane: nie trzeba internetu ani kluczy. Scenariusz główny z definicji „MVP gotowe” to `tests/e2e/main-flow.spec.ts`.

### Płatności Stripe (opcjonalnie)
Do ręcznego testu płatności potrzebujesz konta Stripe w trybie testowym i Stripe CLI. Kroki krok po kroku (produkt Pro 25 PLN, klucze, `stripe listen`, karta testowa 4242…) są w sekcji **Log** ticketu `tickets/012-*.md` („Kroki dla człowieka”).

### Test na telefonie w tej samej sieci Wi-Fi
1. Sprawdź adres IP komputera w sieci lokalnej, np. `ipconfig getifaddr en0` (macOS), `hostname -I` (Linux) albo `ipconfig` (Windows). Przykład: `192.168.0.10`.
2. W `.env.local` ustaw `NEXT_PUBLIC_APP_URL="http://192.168.0.10:3000"`, żeby kod QR i link dla gości prowadziły na komputer, a nie na `localhost` telefonu.
3. Uruchom serwer nasłuchujący w sieci:
   ```bash
   npm run dev -- -H 192.168.0.10
   ```
   Podaj właśnie adres IP. Przy `-H 0.0.0.0` strona otworzy się na telefonie, ale Next.js zablokuje połączenie HMR z innego hosta (w konsoli: `Blocked cross-origin request…`) i strona może się przeładowywać zamiast reagować na kliknięcia.
4. Na komputerze też otwieraj `http://192.168.0.10:3000` (zaloguj się jako DJ, otwórz wydarzenie), a telefonem zeskanuj kod QR albo wpisz link dla gości. Jeśli strona się nie otwiera, sprawdź, czy zapora systemu przepuszcza połączenia do Node.js.
