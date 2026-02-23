#!/usr/bin/env bash
set -euo pipefail

mkdir -p docs/verification

{
  echo "# QSFT-9 Verification"
  echo
  echo "- Timestamp (UTC): $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "- Branch: $(git branch --show-current)"
  echo
  echo "## Commands"
  echo
  echo "1. npm run db:push"
  npm run db:push
  echo
  echo "2. npm run typecheck"
  npm run typecheck
  echo
  echo "3. npm run test:employees"
  npm run test:employees
  echo
  echo "4. npm run test:all"
  npm run test:all
  echo
  echo "## Result"
  echo
  echo "PASS"
} | tee docs/verification/QSFT-9.md
