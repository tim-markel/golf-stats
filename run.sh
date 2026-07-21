#!/usr/bin/env bash
#
# Launch the golf-stats stack (API + web frontend) with one command.
#
#   ./run.sh
#
# Starts the FastAPI backend on :8000 and the Next.js frontend on :3000,
# then waits. Press Ctrl+C once to stop both.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"

# The .venv was created at an old path, so its console scripts (e.g. uvicorn)
# have a stale shebang. Invoking uvicorn via the venv's python sidesteps that.
PYTHON="$ROOT/.venv/bin/python"

if [[ ! -x "$PYTHON" ]]; then
  echo "error: $PYTHON not found. Create the venv first:" >&2
  echo "  python3 -m venv .venv && .venv/bin/pip install -r api/requirements.txt" >&2
  exit 1
fi

# Refuse to start if a port is already taken (e.g. a stale server or another app).
for spec in "API:$API_PORT" "web:$WEB_PORT"; do
  name="${spec%%:*}"; port="${spec##*:}"
  if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "error: port $port ($name) is already in use. Free it or set a different port:" >&2
    echo "  lsof -iTCP:$port -sTCP:LISTEN        # see what's on it" >&2
    echo "  API_PORT=8010 WEB_PORT=3010 ./run.sh # or override ports" >&2
    exit 1
  fi
done

pids=()
cleanup() {
  echo ""
  echo "Shutting down..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "Starting golf-stats API   -> http://localhost:$API_PORT"
( cd "$ROOT" && exec "$PYTHON" -m uvicorn api.main:app --host 127.0.0.1 --port "$API_PORT" --reload ) &
pids+=($!)

echo "Starting golf-stats web   -> http://localhost:$WEB_PORT"
( cd "$ROOT/web" && exec npm run dev -- --port "$WEB_PORT" ) &
pids+=($!)

echo ""
echo "Both running. Open http://localhost:$WEB_PORT  (Ctrl+C to stop both)"
echo ""

# If either process exits, tear the whole thing down.
# (macOS ships bash 3.2, which has no `wait -n`, so poll instead.)
while true; do
  for pid in "${pids[@]}"; do
    kill -0 "$pid" 2>/dev/null || exit 0
  done
  sleep 1
done
