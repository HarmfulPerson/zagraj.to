#!/usr/bin/env bash
# Pętla agentów: każda iteracja = świeża sesja Claude Code, która przeprowadza
# jeden ticket przez developer → tester → reviewer (komenda /next-ticket).
#
# Użycie:
#   ./scripts/loop.sh              # domyślnie max 30 iteracji
#   MAX_ITER=5 ./scripts/loop.sh   # krótszy przebieg na próbę
set -uo pipefail

MAX_ITER="${MAX_ITER:-30}"
MAX_TURNS="${MAX_TURNS:-150}"

cd "$(dirname "$0")/.." || exit 1
mkdir -p logs

if ! command -v claude >/dev/null 2>&1; then
  echo "Nie znaleziono polecenia 'claude'. Zainstaluj Claude Code i zaloguj się (zobacz README.md)."
  exit 1
fi

if [ ! -d .git ]; then
  echo "Brak repozytorium git. Uruchom najpierw: git init && git add -A && git commit -m 'chore: project setup'"
  exit 1
fi

# Treść komendy /next-ticket bez frontmattera
PROMPT="$(awk 'c<2 && /^---$/ {c++; next} c>=2' .claude/commands/next-ticket.md)"
[ -z "$PROMPT" ] && PROMPT="$(cat .claude/commands/next-ticket.md)"

for i in $(seq 1 "$MAX_ITER"); do
  ts="$(date +%Y%m%d-%H%M%S)"
  log="logs/iter-${ts}.log"
  echo ""
  echo "=================== Iteracja $i / $MAX_ITER ($ts) ==================="

  claude -p "$PROMPT" \
    --permission-mode acceptEdits \
    --max-turns "$MAX_TURNS" \
    2>&1 | tee "$log"

  status="$(grep -E '^STATUS:' "$log" | tail -1)"
  echo ">>> $status"

  case "$status" in
    *ALL_DONE*)
      echo "MVP gotowe. Wszystkie tickety zamknięte."
      exit 0 ;;
    *NEEDS_HUMAN*|*BLOCKED*)
      echo "Pętla zatrzymana: potrzebna Twoja decyzja. Zajrzyj do sekcji Log w tickecie: $status"
      exit 2 ;;
    "")
      echo "Brak linii STATUS w odpowiedzi (np. skończył się limit tur albo wystąpił błąd). Zobacz $log"
      exit 3 ;;
  esac
done

echo "Osiągnięto limit $MAX_ITER iteracji. Uruchom ponownie, aby kontynuować."
