# Development Workflow (Local-First)

## Prerequisites

- Docker Desktop for macOS
- Supabase CLI (`supabase`)

## First-Time Setup

1. Start local Supabase:
```bash
npm run supabase:start
```
2. Generate local env files from running stack:
```bash
npm run env:local
```
3. Run deterministic verification:
```bash
npm run verify:local
```

`verify:local` runs local DB reset + migrations + typecheck + full test workflow.

## Day-to-Day Commands

- Local app:
```bash
npm run dev:local
```
- Full local tests:
```bash
npm run test:all:local
```
- Full local verification:
```bash
npm run verify:local
```

## Optional Live Supabase Mode

You can still run against live Supabase by setting:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
```

Use this mode carefully due to live/free-plan limits.

## If Supabase Local Is Broken

In most cases, one command is enough:

```bash
npm run verify:local
```

It runs a self-healing wrapper that checks Docker + Supabase CLI, repairs broken local containers, and restarts the stack when needed.

Manual recovery (only if needed):

```bash
supabase stop --no-backup
docker ps -a | grep supabase
docker rm -f <stale-supabase-container-id>
supabase start
```
