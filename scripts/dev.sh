#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-4173}"
HOST="${2:-127.0.0.1}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Generating blog content..."
python3 "$ROOT/scripts/generate.py" "$ROOT"

echo "Starting blog local server at http://$HOST:$PORT/"
python3 -m http.server "$PORT" --bind "$HOST"
