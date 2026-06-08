#!/bin/sh
set -eu
KUBECTL_BIN="${KUBECTL_BIN:-kubectl}"
NAMESPACE="${TARGET_NAMESPACE:-blog}"

shift
exec "$KUBECTL_BIN" exec -i -n "$NAMESPACE" deploy/blog -- "$@"
