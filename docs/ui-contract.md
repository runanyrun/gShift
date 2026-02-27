# UI Contract (v1)

This contract is the source of truth for protected product UI in gShift.

## Layout Contract

- Protected pages must render through `src/app/(protected)/layout.tsx`.
- Use `PageShell` for container width and global page padding.
- Every protected page starts with `PageHeader`:
  - `title`
  - one-line `description`
  - optional right-side `actions`
- Page body rhythm:
  - top summary strip (KPI cards when applicable)
  - one primary task block
  - details in progressive disclosure (`Tabs`, `Sheet`, `Dialog`)

## Page IA Contract

- Every page follows this order:
  - `PageHeader` (title + one-sentence description + right-side actions)
  - optional KPI strip (max 4 cards)
  - one primary task section (`Section` + one main card/table/form)
  - details in `Tabs`, `Sheet`, or `Accordion`
- Do not render two primary task surfaces at the same time.
  - If a page needs list + create, split them into tabs.
- Keep dense detail out of list pages.
  - use `Sheet` or dedicated detail route for heavy edit flows.
- Use English microcopy consistently across labels, helper text, empty states, and errors.

## Spacing Contract

- Page vertical rhythm: `space-y-6` by default.
- Section rhythm: use `Section` component (`space-y-3` + heading block).
- Card internals:
  - header/content spacing via shadcn card primitives.
- Table/dense content must include a toolbar row (`DataTableToolbar`) before rows.

## Typography Contract

- Page title: `text-3xl font-semibold tracking-tight`.
- Section title: `text-lg font-semibold`.
- Body copy: `text-sm`.
- Secondary/meta copy: `text-xs text-slate-500/600`.

## Components Contract

Prefer existing shadcn components and these shared wrappers:

- `EmptyState`: canonical empty screen copy + optional CTA.
- `Section`: section heading + description + right actions.
- `KpiCard`: summary metric card.
- `DataTableToolbar`: search/filters/actions row for list pages.
- `Skeleton`: loading placeholders.

## State Contract (Loading / Empty / Error)

- Loading:
  - use `Skeleton` blocks for cards/tables/forms.
- Empty:
  - use `EmptyState` with explicit next action when possible.
- Error:
  - use one inline error banner:
    - `rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700`

## Form Contract

- Default form layout is single-column (`space-y-*`), not two-column grids.
- Every input has label and, where needed, helper text.
- Primary CTA is one obvious button at the bottom/right.

## Navigation + Naming Contract

- Primary navigation labels:
  - Dashboard
  - Jobs (manager)
  - Find Jobs (worker)
  - Schedule
  - Reports
  - Employees
  - Settings
  - Setup
- Product microcopy should stay in English across protected/auth flows.
