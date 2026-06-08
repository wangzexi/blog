#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -n "${BLOG_ROOT:-}" ]; then
  ROOT_DIR="$BLOG_ROOT"
else
  ROOT_DIR="$SCRIPT_DIR"
  while [ "$ROOT_DIR" != "/" ]; do
    if [ -d "$ROOT_DIR/.git" ]; then
      break
    fi
    ROOT_DIR="$(dirname "$ROOT_DIR")"
  done
  if [ ! -d "$ROOT_DIR/.git" ]; then
    ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
  fi
fi

PORT="${BLOG_PREVIEW_PORT:-4173}"
HOST="${BLOG_PREVIEW_HOST:-127.0.0.1}"

cd "$ROOT_DIR"
python3 -m http.server "$PORT" --bind "$HOST"
