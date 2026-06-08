#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="${BLOG_ROOT:-"$(cd "$SCRIPT_DIR/../.." && pwd)"}"
PORT="${BLOG_PREVIEW_PORT:-4173}"
HOST="${BLOG_PREVIEW_HOST:-127.0.0.1}"

cd "$ROOT_DIR"
python3 -m http.server "$PORT" --bind "$HOST"
