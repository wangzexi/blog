#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-4321}"
HOST="${2:-127.0.0.1}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Starting blog local server at http://$HOST:$PORT/"
npm run dev -- --host "$HOST" --port "$PORT"
