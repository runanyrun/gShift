#!/usr/bin/env bash
set -Eeuo pipefail

CURRENT_STEP="initialization"

log() {
  printf "\n[%s] %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

on_error() {
  local exit_code=$?
  echo
  echo "FAILED at step: ${CURRENT_STEP}"
  echo "Exit code: ${exit_code}"
  exit "${exit_code}"
}

trap on_error ERR

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

run_test() {
  local test_name="$1"
  CURRENT_STEP="run ${test_name}"
  log "Running ${test_name}"
  npm run "${test_name}"
  log "${test_name} PASSED"
}

CURRENT_STEP="preflight checks"
require_cmd git
require_cmd npm

[[ "$(git rev-parse --abbrev-ref HEAD)" == "develop" ]] || fail "You must start from 'develop' branch."
git diff --quiet && git diff --cached --quiet || fail "Working tree is not clean."

CURRENT_STEP="sync develop"
log "Fetching and syncing develop"
git fetch origin --prune
git pull --ff-only origin develop

BRANCH_NAME="feature/post-merge-tests-fix"
CURRENT_STEP="create feature branch"
if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
  fail "Local branch '${BRANCH_NAME}' already exists. Delete it first or rename BRANCH_NAME."
fi
log "Creating ${BRANCH_NAME}"
git checkout -b "${BRANCH_NAME}"

CURRENT_STEP="load environment"
if [[ -f ".env.local" ]]; then
  log "Loading .env.local"
  set -a
  # shellcheck source=/dev/null
  source .env.local
  set +a
else
  log ".env.local not found. Continuing with current environment."
fi

log "Exporting required test credentials"
export EDGE_CASE_EMAIL="edge@example.com"
export EDGE_CASE_PASSWORD="EdgePass123"
export TENANT_A_EMAIL="tenantA@example.com"
export TENANT_A_PASSWORD="TenantAPass"
export TENANT_B_EMAIL="tenantB@example.com"
export TENANT_B_PASSWORD="TenantBPass"

CURRENT_STEP="validate required env values"
for key in \
  NEXT_PUBLIC_SUPABASE_URL \
  NEXT_PUBLIC_SUPABASE_ANON_KEY \
  EDGE_CASE_EMAIL \
  EDGE_CASE_PASSWORD \
  TENANT_A_EMAIL \
  TENANT_A_PASSWORD \
  TENANT_B_EMAIL \
  TENANT_B_PASSWORD; do
  [[ -n "${!key:-}" ]] || fail "Missing required environment variable: ${key}"
done

run_test "test:env"
run_test "test:ssr"
run_test "test:onboarding"
run_test "test:shift"

CURRENT_STEP="commit and push"
log "All tests passed. Preparing commit."
git add -A

if git diff --cached --quiet; then
  log "No file changes found. Creating an empty commit for traceability."
  git commit --allow-empty -m "chore: post-merge test pipeline validation"
else
  git commit -m "chore: post-merge test pipeline validation"
fi

git push -u origin "${BRANCH_NAME}"

PR_LINK="https://github.com/runanyrun/gShift/pull/new/${BRANCH_NAME}"
log "SUCCESS"
echo "Branch: ${BRANCH_NAME}"
echo "PR ready: ${PR_LINK}"
