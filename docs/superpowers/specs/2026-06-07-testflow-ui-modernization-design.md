# TestFlow UI Modernization Design

Date: 2026-06-07

## Summary

Modernize the TestFlow web app with a restrained desktop-workbench visual system. The approved direction is:

- Global baseline: **Precision Lab**. Light, dense, exact, and calm enough for daily engineering work.
- Execution emphasis: **Control Room**. Dark, high-contrast panels for active task monitoring, live logs, and run-state feedback.

The redesign should improve perceived quality, hierarchy, and interaction polish without changing API contracts, routing behavior, or domain state management.

## Goals

- Make the application feel like a modern desktop automation workbench rather than a generic web admin page.
- Preserve efficiency and information density for test engineers.
- Give execution and logs a stronger product identity.
- Add motion where it clarifies state changes, not as decoration.
- Keep the implementation close to existing React, Tailwind v4, shadcn/ui, and feature-first project structure.

## Non-Goals

- No mobile layout redesign. This is a desktop app.
- No backend, Electron, or API behavior changes.
- No replacement of shadcn/ui primitives.
- No large routing, data-fetching, or feature architecture rewrite.
- No marketing landing page or illustrative hero treatment.

## Visual System

The global UI uses a light lab-like palette:

- Background: off-white and pale green-gray surfaces with subtle grid or paper texture.
- Foreground: deep graphite green for primary text and navigation emphasis.
- Accent: oxidized red for primary actions and critical command affordances.
- Secondary status color: soft mint/green for successful or connected states.
- Borders: fine, low-contrast lines with layered surface depth.

The design should avoid the current generic blue-gray dashboard feel. It should also avoid heavy purple/blue gradients, oversized cards, decorative blobs, or marketing-style composition.

Cards remain only for repeated items, modals, and framed tool surfaces. Page sections should read as work surfaces with clear internal structure rather than nested card stacks.

## Typography And Density

Keep the app compact. Page titles should be tighter and more editorial, but not hero-scale. Tables and lists should retain dense scan patterns:

- Page title and subtitle remain in `PageHeader`.
- Toolbar controls should align predictably with table/list content.
- Buttons use icons for familiar commands and short text only for primary actions.
- Text must not expand control height unexpectedly.

The existing font stack can remain for the first implementation pass. A font change is optional and should only happen if it does not add visual noise or slow initial load.

## Shell And Navigation

Update `AppShell` and `Sidebar` as the main system-level redesign points:

- Sidebar becomes a calmer lab rail with a clearer brand block, grouped navigation, and compact active states.
- Active navigation gets a motion-backed indicator or selected surface, but the layout must not shift.
- Main content background uses a subtle lab-grid/paper texture implemented with CSS gradients and theme tokens.
- Status bar should feel integrated with the lab system, with concise backend and WebSocket state indicators.

The current route grouping remains unchanged.

## Page Surfaces

Update shared layout primitives before page-specific polishing:

- `PagePanel`: keep a simple content grid with consistent max width and spacing.
- `PageHeader`: stronger title hierarchy, clearer action placement, and refined divider treatment.
- `ListToolbar`: precise surface styling that visually belongs with tables and lists.
- `Table`: refined row height, hover state, header treatment, and action alignment.
- `EmptyState`: quieter dashed/lab-note treatment.

These shared changes should lift script management, reports, tools, and configuration pages without duplicating page-specific styles.

## Execution Experience

Use the Control Room language only where it adds meaning:

- `TaskPage` current task panel can use stronger status framing.
- Live logs should become a dark terminal-like panel with clear scroll affordance and readable monospaced output.
- Recent tasks should support selected-row clarity and motion for changes.
- Stop/destructive controls should be visually clear without overwhelming the page.

The execution page should still sit inside the global Precision Lab shell. Only the monitoring/log surfaces become dark.

## Motion

Introduce Motion for React using the current package:

- Install package: `motion`.
- React imports: `motion/react`.

Use motion for:

- Page/content entrance with small opacity and vertical offset.
- Sidebar active indicator transitions.
- List/table row additions, removals, and selected state transitions.
- Live log append animations.
- Lightweight layout transitions where they reduce abrupt jumps.

Use `MotionConfig` with reduced motion set to user preference, and avoid transform-heavy animations when reduced motion is enabled. Do not animate large background elements continuously.

## Component Boundaries

Implementation should stay within existing ownership boundaries:

- Shared layout: `apps/web/src/components/layout/*`
- Shared primitives: `apps/web/src/components/ui/*`
- Execution UI: `apps/web/src/features/execution/*`
- Script list polish: `apps/web/src/features/scripts/pages/ScriptListPage.tsx` only if shared table changes are not enough

If motion wrappers are reused, add a small shared helper under layout or a focused local component. Avoid a broad animation abstraction until repeated usage justifies it.

## Data Flow And Behavior

No data flow changes are planned.

- React Query hooks continue owning server state.
- Existing feature hooks continue owning UI state and mutations.
- Components should receive the same props and invoke the same callbacks.
- Motion wrappers must not change accessible names, button semantics, table structure, or route links.

## Error Handling

Existing error surfaces stay behaviorally the same:

- API failures still render `Alert` content.
- Loading and empty states still render through existing shared components.
- Destructive actions keep existing confirmation behavior.

Visual changes should make errors easier to identify, not hide them inside decorative styling.

## Accessibility

- Preserve semantic HTML for navigation, main content, tables, buttons, and status text.
- Maintain visible focus styles through Tailwind ring tokens.
- Ensure dark log panels meet contrast requirements.
- Respect reduced motion using Motion's user preference support.
- Do not rely on color alone for backend/WebSocket/task status.

## Testing And Verification

For implementation, run:

- `pnpm check:web`
- `pnpm --filter @testflow/web test`

Because this is a visible UI change, verify the relevant routes in the browser:

- `/scripts`
- `/tasks`
- at least one secondary route such as `/history`, `/commands`, or `/ssh`

Browser verification should check that:

- The shell, sidebar, status bar, and page surfaces render correctly.
- Text does not overlap or overflow.
- Motion is subtle and does not shift layout.
- Dark execution/log panels are readable.
- Existing interactions still work.

## Acceptance Criteria

- The app has a consistent Precision Lab visual system across the shared shell and list/table surfaces.
- The execution page has a distinct Control Room treatment for monitoring and logs.
- Motion is present but scoped, purposeful, and reduced-motion aware.
- Existing tests pass.
- Browser verification shows no broken layout, unreadable text, or incoherent overlap on desktop.
