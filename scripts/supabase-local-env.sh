#!/usr/bin/env bash
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "[env:local] Supabase CLI not found. Install it first: https://supabase.com/docs/guides/cli"
  exit 1
fi

status_output="$(supabase status 2>/dev/null || true)"
if [[ -z "$status_output" ]]; then
  echo "[env:local] Supabase local stack is not running."
  echo "[env:local] Run: npm run supabase:start"
  exit 1
fi

api_url="$(printf '%s\n' "$status_output" | awk -F': ' '/API URL/ {print $2; exit}')"
anon_key="$(printf '%s\n' "$status_output" | awk -F': ' '/anon key/ {print $2; exit}')"

if [[ -z "$api_url" || -z "$anon_key" ]]; then
  echo "[env:local] Could not parse API URL / anon key from 'supabase status'."
  echo "[env:local] Output was:"
  printf '%s\n' "$status_output"
  exit 1
fi

if [[ "$api_url" == "http://127.0.0.1:54321" ]]; then
  api_url="http://localhost:54321"
fi

upsert_env_kv() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp
  tmp="$(mktemp)"

  if [[ -f "$file" ]]; then
    grep -v "^${key}=" "$file" > "$tmp" || true
  fi
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$file"
}

write_env_file() {
  local file="$1"
  touch "$file"
  upsert_env_kv "$file" "SUPABASE_URL" "$api_url"
  upsert_env_kv "$file" "NEXT_PUBLIC_SUPABASE_URL" "$api_url"
  upsert_env_kv "$file" "SUPABASE_ANON_KEY" "$anon_key"
  upsert_env_kv "$file" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$anon_key"
}

write_env_file ".env.local"
write_env_file ".env.test.local"

echo "[env:local] Updated .env.local and .env.test.local with local Supabase credentials."
echo "[env:local] API URL: $api_url"

