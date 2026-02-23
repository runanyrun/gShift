#!/usr/bin/env bash
set -euo pipefail

echo "[db:push] Checking Supabase migrations..."

if ! command -v supabase >/dev/null 2>&1; then
  echo "[db:push] Supabase CLI not found. Skipping automatic migration apply."
  echo "[db:push] Install CLI and run: supabase db push"
  echo "[db:push] Fallback: run migration SQL files in Supabase SQL Editor."
  exit 0
fi

if supabase db push; then
  echo "[db:push] Migrations are up to date."
  exit 0
fi

echo "[db:push] supabase db push failed."
echo "[db:push] Continue with current schema. If tests fail with missing tables, run:"
echo "           supabase db push"
echo "           or apply migrations in Supabase SQL Editor."

if [[ "${DB_PUSH_STRICT:-0}" == "1" ]]; then
  exit 1
fi

exit 0
