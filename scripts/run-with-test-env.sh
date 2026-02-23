#!/usr/bin/env bash
set -euo pipefail

if [[ -f ".env.test.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.test.local
  set +a
fi

if [[ -z "${SUPABASE_URL:-}" && -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]]; then
  export SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
fi
if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" && -n "${SUPABASE_URL:-}" ]]; then
  export NEXT_PUBLIC_SUPABASE_URL="${SUPABASE_URL}"
fi

supabase_url="${SUPABASE_URL:-}"
if [[ -z "$supabase_url" ]]; then
  echo "SUPABASE_URL is not set"
  exit 1
fi

if [[ "$supabase_url" == *"YOURPROJECT.supabase.co"* || "$supabase_url" == *"your-project-id.supabase.co"* ]]; then
  echo "SUPABASE_URL is a placeholder or invalid. Set your real Supabase project URL."
  exit 1
fi

if [[ ! "$supabase_url" =~ ^https://[a-z0-9]+\.supabase\.co$ && ! "$supabase_url" =~ ^http://(localhost|127\.0\.0\.1):[0-9]+$ ]]; then
  echo "SUPABASE_URL is a placeholder or invalid. Set your real Supabase project URL (or local http://localhost:54321)."
  exit 1
fi

exec "$@"
