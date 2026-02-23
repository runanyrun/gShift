#!/usr/bin/env bash
set -euo pipefail

if [[ -f ".env.test.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.test.local
  set +a
fi

exec "$@"
