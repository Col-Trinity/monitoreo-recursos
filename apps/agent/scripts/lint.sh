#!/usr/bin/env bash
set -euo pipefail

# Prefer PATH, fall back to $(go env GOPATH)/bin (where `go install` places binaries).
if command -v golangci-lint > /dev/null 2>&1; then
  exec golangci-lint run ./...
fi

GOBIN="$(go env GOBIN)"
[ -z "$GOBIN" ] && GOBIN="$(go env GOPATH)/bin"

if [ -x "$GOBIN/golangci-lint" ]; then
  exec "$GOBIN/golangci-lint" run ./...
fi

echo "error: 'golangci-lint' not found." >&2
echo "Install with: go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest" >&2
echo "Or run: task tools:install" >&2
exit 1
