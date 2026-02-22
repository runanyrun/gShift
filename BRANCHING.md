# Branch Strategy

## Branches

- `main`
  - Production branch
  - No direct pushes
  - Merge by Pull Request only
  - Stable code only

- `develop`
  - Integration branch
  - Feature branches merge here
  - No direct pushes
  - Pull Request required

- `feature/*`
  - Each new task uses a separate branch
  - Must be created from `develop`
  - Merged back to `develop` via Pull Request

## Setup Steps

1. If `main` does not exist, create it from `develop` and push:

```bash
git checkout develop
git checkout -b main
git push -u origin main
git checkout develop
```

2. In GitHub repository settings, add branch protection for both `main` and `develop`:
   - Require a pull request before merging
   - Require at least 1 approval
   - Restrict direct pushes

## Ongoing Rules

- Do not push directly to `develop` or `main`
- All development must go through `feature/*` branches

## Workflow

### Start new task

```bash
git checkout develop
git pull
git checkout -b feature/<task-name>
```

### Finish task

- Open Pull Request: `feature/<task-name>` -> `develop`

### Release

- Open Pull Request: `develop` -> `main`
