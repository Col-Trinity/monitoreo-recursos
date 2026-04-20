#!/usr/bin/env bash
set -euo pipefail

# Resolve air: prefer PATH, fall back to $(go env GOPATH)/bin.
if command -v air > /dev/null 2>&1; then
  exec air "$@"
fi

GOBIN="$(go env GOBIN)"
[ -z "$GOBIN" ] && GOBIN="$(go env GOPATH)/bin"

if [ -x "$GOBIN/air" ]; then
  exec "$GOBIN/air" "$@"
fi

echo "error: 'air' not found. Install with: go install github.com/air-verse/air@latest" >&2
exit 1
