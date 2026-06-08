#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BLOG_SKILL_DIR="$SCRIPT_DIR"

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
    ROOT_DIR="$(cd "$BLOG_SKILL_DIR/../.." && pwd)"
  fi
fi

MANIFEST="${BLOG_MANIFEST:-${ROOT_DIR}/.agent/skills/blog/blog-deploy.yaml}"
KUBECTL_BIN="${KUBECTL_BIN:-kubectl}"
TARGET_POD_QUERY="${TARGET_POD_QUERY:-app=blog}"
TARGET_NAMESPACE="${TARGET_NAMESPACE:-blog}"
LOCAL_BLOG_PATH="${LOCAL_BLOG_PATH:-$ROOT_DIR}"

if ! command -v "$KUBECTL_BIN" >/dev/null 2>&1; then
  echo "kubectl not found. Set KUBECTL_BIN to your kubectl binary path."
  exit 1
fi

if [ ! -f "$MANIFEST" ]; then
  echo "Deploy manifest not found: $MANIFEST"
  exit 1
fi

cd "$ROOT_DIR"
python3 .agent/skills/blog/gen_sidebar.py

if [ ! -x "$KUBECTL_BIN" ]; then
  KUBECTL_BIN="$(command -v "$KUBECTL_BIN")"
fi

"$KUBECTL_BIN" apply -f "$MANIFEST"
"$KUBECTL_BIN" -n "$TARGET_NAMESPACE" rollout status deploy/blog --timeout=120s

BLOG_POD="$("$KUBECTL_BIN" -n "$TARGET_NAMESPACE" get pod -l "$TARGET_POD_QUERY" -o jsonpath='{.items[0].metadata.name}')"
if [ -z "$BLOG_POD" ]; then
  echo "No blog pod found with selector: $TARGET_POD_QUERY"
  exit 1
fi

echo "Syncing content to pod: $BLOG_POD"
"$KUBECTL_BIN" exec -i -n "$TARGET_NAMESPACE" "$BLOG_POD" -- rm -rf /usr/share/nginx/html/*
tar -cf - --exclude='.git' -C "$LOCAL_BLOG_PATH" . | "$KUBECTL_BIN" exec -i -n "$TARGET_NAMESPACE" "$BLOG_POD" -- tar -xf - -C /usr/share/nginx/html
