#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-4173}"
HOST="${2:-127.0.0.1}"

echo "Starting blog local server at http://$HOST:$PORT/"
cd "$(dirname "$0")/.."
python3 -m http.server "$PORT" --bind "$HOST"
