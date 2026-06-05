# List Page Container Redesign

## Summary

TestFlow's web UI currently uses `Card` for page sections, list containers, and list rows. The result is a repeated `PagePanel -> Card -> Card item` structure that makes list-heavy pages feel visually fragmented. This redesign narrows the first visual polish pass to list pages and replaces nested cards with a desktop-tool container model: open page workspace, compact filter toolbar, structured list/table rows, and reserved card usage for genuinely independent content.

## Goals

- Reduce visible card nesting on list-heavy pages.
- Make TestFlow feel more like a desktop testing workbench than a generic web admin dashboard.
- Improve scanning density for scripts, task history, and reports.
- Keep the first implementation low risk by avoiding editor, terminal, and report viewer workflow rewrites.
- Preserve current behavior, route structure, data fetching hooks, and accessibility semantics.

## Scope

The first implementation should cover these pages:

- `apps/web/src/features/scripts/pages/ScriptListPage.tsx`
- `apps/web/src/features/execution/pages/HistoryPage.tsx`
- `apps/web/src/features/execution/pages/ReportListPage.tsx`

Shared components may be introduced under existing ownership boundaries when they reduce repeated layout code. Good candidates are layout-level primitives in `apps/web/src/components/layout/` or feature-local list row components when the semantics are domain-specific.

Out of scope for this pass:

- `ScriptEditorPage` split-pane redesign.
- `SshTerminalPage` terminal and connection layout redesign.
- `ReportDetailPage` report viewer structure.
- Backend API changes.
- New routing or state-management behavior.
- Global color theme replacement.

## Container Model

### Page Workspace

`PagePanel` should stop reading as a large card wrapping the entire page. It should become a quiet work surface with consistent page padding, spacing, and content flow. The page may still have a subtle background or boundary if needed, but it should not compete with inner content as another boxed layer.

Recommended direction:

- Remove or soften `rounded-lg border bg-card shadow-sm` from page-level layout.
- Keep page spacing and `PageHeader` composition stable.
- Use the app shell background and sidebar/status bar as the main chrome.

### Filter Toolbar

Filter controls on list pages should be presented as a compact toolbar below the page header, not as a standalone card.

Recommended direction:

- Keep labels and accessible names.
- Use a single row when width allows.
- Use subtle separators or grouped spacing instead of a surrounding card.
- Preserve existing filter behavior and controlled values.

### List Surface

The list itself should be one surface, not a card containing row cards.

Recommended direction:

- Use a container with one light border or background at most.
- Add a small header row when it improves scanning.
- Use `border-b`, hover background, selected background, and right-aligned actions for row hierarchy.
- Avoid per-row `Card` unless a row truly needs independent object framing.

### Rows

Rows should feel like dense desktop records.

Recommended direction:

- Main identity on the left: title/name, short description, status.
- Metadata in aligned columns where possible: group, tags, steps, revision, status, time.
- Actions grouped on the right with icon buttons.
- Use badges sparingly; metadata should not all become chips.
- Preserve keyboard and screen-reader behavior for row actions.

### Card Usage

`Card` remains available, but should be reserved for:

- Details or summaries that are visually independent.
- Confirmation or destructive states.
- Empty states when they need explicit framing.
- Viewer-like panels that need a clear frame.

`Card` should not be the default wrapper for every page section or repeated row.

## Page Designs

### Script List

Current issue: `PagePanel` contains filters, then a `Card` titled "脚本列表", then each `ScriptListItem` is another `Card`.

Target design:

- `PageHeader` remains at the top with "新建脚本".
- `ScriptFilters` becomes a toolbar-style block.
- The script list becomes a single list surface.
- Each script becomes a row:
  - Left: script name, status, description or ID.
  - Middle: group/tags and step/revision metadata in stable columns.
  - Right: run, edit, copy, delete actions.
- The existing delete confirmation behavior remains inline.

### History Page

Current issue: filter card and task record card create a heavy two-card stack, and each task record is also card-like.

Target design:

- Filter controls become a toolbar.
- Task records become a row list with status, script, timestamps, duration, and actions aligned for scanning.
- Selected state uses a row highlight rather than a nested-card ring style.

### Report List

Current issue: report list has an outer card and repeated inner cards for each report.

Target design:

- Report list becomes a single report surface.
- Each report row emphasizes title, status, generated time, source task/script, and open/download actions if present.
- Failed or incomplete reports use semantic color in status text/badge, not a full card treatment.

## Component Architecture

The implementation should avoid a large one-off rewrite inside each page. Introduce only small primitives that match existing patterns:

- `ListSurface`: optional shared wrapper for list/table surfaces.
- `ListToolbar`: optional shared wrapper for filter/action rows.
- Feature-specific row components remain in their feature folders when their content is domain-specific.

If a shared primitive only saves a few class names and obscures intent, keep the classes local instead.

## Accessibility

- Preserve current labels for inputs, selects, and buttons.
- Keep icon-only actions labeled with `aria-label`.
- Use semantic grouping for list rows, such as `ul/li`, `table`, or clearly labeled regions depending on the final markup.
- Maintain focus-visible states for interactive rows and actions.
- Do not make an entire row clickable if that competes with multiple inline action buttons, unless keyboard behavior is explicitly handled.

## Testing And Verification

Code verification:

- Run `pnpm check:web`.
- Run `pnpm --filter @testflow/web test`.

Visual verification:

- Start `pnpm dev:web`.
- Verify the affected desktop routes in the browser:
  - `/scripts`
  - `/history`
  - `/reports`
- Confirm there is no mobile layout requirement for this desktop app, per repository guidance.
- Check that rows do not clip long names, IDs, descriptions, or tags.
- Check empty, loading, and error states for each affected page.

## Acceptance Criteria

- The affected list pages no longer use the three-layer `PagePanel -> Card -> row Card` pattern.
- Filters read as toolbar controls rather than standalone cards.
- Rows are scannable and visually denser than the current card rows.
- Existing page behavior and route tests still pass.
- `Card` remains in the codebase but is no longer the default repeated-list container for these pages.
