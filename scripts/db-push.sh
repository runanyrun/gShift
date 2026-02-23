#!/usr/bin/env bash
set -euo pipefail

echo "[db:push] Checking Supabase migrations..."

is_ci=false
if [[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]]; then
  is_ci=true
fi

print_instructions() {
  echo "[db:push] Required action:"
  echo "[db:push]   Option A: Install Supabase CLI and run: supabase db push"
  echo "[db:push]   Option B: Run migrations in Supabase SQL Editor (at least 0005 + 0006)"
  echo "[db:push] Notes:"
  echo "[db:push]   - Supabase CLI commands may require a linked project (supabase link)."
  echo "[db:push]   - CI setups typically use SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD."
}

if ! command -v supabase >/dev/null 2>&1; then
  echo "[db:push] Supabase CLI not found."
  print_instructions
  if [[ "$is_ci" == "true" ]]; then
    echo "[db:push] CI mode: failing because migrations cannot be verified automatically."
    exit 1
  fi
  echo "[db:push] Local mode: continuing without automatic migration apply."
  exit 0
fi

if supabase db push; then
  echo "[db:push] Migrations are up to date."
  exit 0
fi

echo "[db:push] supabase db push failed."
print_instructions
if [[ "$is_ci" == "true" || "${DB_PUSH_STRICT:-0}" == "1" ]]; then
  echo "[db:push] Strict mode: failing."
  exit 1
fi

echo "[db:push] Local mode: continuing with current schema."
exit 0
