#!/usr/bin/env bash
set -euo pipefail

print_start_hints() {
  echo "[supabase:ensure] Common fixes:"
  echo "[supabase:ensure]   - Check port conflicts: lsof -i :54321 && lsof -i :54322"
  echo "[supabase:ensure]   - Inspect containers: docker ps -a | grep supabase"
}

# Supabase CLI status output format changes between versions.
# We treat the stack as healthy if we can see:
# - an HTTP project/api URL line
# - a PostgreSQL connection URL
parse_status_health() {
  local output="$1"
  local project_url
  local db_url

  project_url="$(printf '%s\n' "$output" | awk -F': ' '/Project URL|API URL/ {print $2; exit}')"
  db_url="$(printf '%s\n' "$output" | awk '/postgresql:\/\// {print $0; exit}')"

  if [[ -n "$project_url" && -n "$db_url" ]]; then
    echo "$project_url|$db_url"
    return 0
  fi

  return 1
}

if ! command -v docker >/dev/null 2>&1; then
  echo "[supabase:ensure] Docker is not installed. Install Docker Desktop first."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "[supabase:ensure] Docker is not running. Open Docker Desktop."
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "[supabase:ensure] Supabase CLI not installed. Run: brew install supabase/tap/supabase"
  exit 1
fi

if ! supabase --version >/dev/null 2>&1; then
  echo "[supabase:ensure] Supabase CLI not installed. Run: brew install supabase/tap/supabase"
  exit 1
fi

status_output=""
if ! status_output="$(supabase status 2>&1)"; then
  echo "[supabase:ensure] Supabase local status is unhealthy. Attempting self-heal..."
  supabase stop --no-backup >/dev/null 2>&1 || true

  container_ids="$(docker ps -aq --filter "name=supabase" || true)"
  if [[ -n "$container_ids" ]]; then
    # shellcheck disable=SC2086
    docker rm -f $container_ids >/dev/null 2>&1 || true
  fi

  if ! start_output="$(supabase start 2>&1)"; then
    echo "[supabase:ensure] Failed to start Supabase local stack."
    echo "$start_output"
    print_start_hints
    exit 1
  fi
  status_output="$(supabase status 2>&1 || true)"
fi

if ! parsed="$(parse_status_health "$status_output")"; then
  echo "[supabase:ensure] Supabase started but status output is incomplete."
  printf '%s\n' "$status_output"
  print_start_hints
  exit 1
fi

api_url="${parsed%%|*}"
db_url="${parsed#*|}"

echo "[supabase:ensure] Supabase local is healthy."
echo "[supabase:ensure] API URL: $api_url"
echo "[supabase:ensure] DB URL: $db_url"
