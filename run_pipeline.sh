#!/usr/bin/env bash
# Jetwise route suggestion pipeline (macOS/Linux bash/zsh compatible).
# Runs from repo root; exits non-zero on first failure.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PY="${ROOT}/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  echo "error: missing executable ${PY}" >&2
  echo "  Create venv at repo root: python3 -m venv .venv && .venv/bin/pip install polars" >&2
  exit 1
fi

echo ""
echo "=== [1/3] build_routes.py ==="
"$PY" "${ROOT}/build_routes.py"

echo ""
echo "=== [2/3] export_hub_seed.py ==="
"$PY" "${ROOT}/export_hub_seed.py"

echo ""
echo "=== [3/3] npm run import-suggestions (web-app) ==="
(cd "${ROOT}/web-app" && npm run import-suggestions)

echo ""
echo "=== pipeline finished OK ==="
