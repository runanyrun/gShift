#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f ".env.local" ]]; then
  echo "[verify:cloud] Missing .env.local"
  echo "[verify:cloud] Copy .env.local.example to .env.local and set live Supabase values."
  exit 1
fi

npm run typecheck
npm run test:env
npm run test:all

