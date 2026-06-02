# Web Module Split Design

## Goal

Split the Web app's oversized page files into clear feature modules without changing runtime behavior, routes, styling conventions, or public API contracts.

The current Web code already has feature folders, but several files still mix page composition, API mutations, WebSocket effects, form state, list rendering, and pure formatting logic:

- `apps/web/src/App.tsx`
- `apps/web/src/features/scripts/ScriptPages.tsx`
- `apps/web/src/features/tools/ToolPages.tsx`
- `apps/web/src/features/execution/TaskPage.tsx`

The split should make future changes easier to test and review while preserving the existing React Router, TanStack Query, shadcn/ui, Tailwind token, and path alias patterns.

## Recommended Architecture

Use feature-first organization. Each business area owns its pages, local components, hooks, constants, types, and pure utilities.

```txt
apps/web/src/
  app/
    routes.tsx
    config.ts
    providers.tsx

  components/
    layout/
      AppShell.tsx
      Sidebar.tsx
      TopStatusBar.tsx
      StatusPill.tsx
      page.tsx
    ui/

  features/
    scripts/
      pages/
        ScriptListPage.tsx
        ScriptEditorPage.tsx
      components/
        ScriptFilters.tsx
        ScriptListItem.tsx
        ScriptPreviewPanel.tsx
        ScriptStepEditor.tsx
        ParameterInput.tsx
      hooks/
        useScriptEditor.ts
        useScriptMutations.ts
        useScripts.ts
      utils/
        filters.ts
        keywords.ts
        validation.ts
      constants.ts
      types.ts
      index.ts

    execution/
      pages/
        TaskPage.tsx
      components/
        LiveLogPanel.tsx
        SelectedScriptSummary.tsx
        TaskControlPanel.tsx
        TaskDetail.tsx
        TaskSummaryItem.tsx
      hooks/
        useExecutionSocket.ts
        useExecutionTasks.ts
      utils/
        taskFormatters.ts
        taskGuards.ts
      constants.ts
      index.ts

    tools/
      command-library/
        pages/
          CommandLibraryPage.tsx
        components/
          CommandForm.tsx
          CommandList.tsx
          CommandListItem.tsx
        hooks/
          useCommandLibrary.ts
        constants.ts

      ssh-terminal/
        pages/
          SshTerminalPage.tsx
        components/
          CommandSuggestions.tsx
          SshConnectionForm.tsx
          SshTerminalView.tsx
        hooks/
          useSshTerminal.ts
        utils/
          commandSuggestions.ts
          sshStatus.ts
        store.ts
```

## Boundaries

Pages compose sections, read route params, and connect feature hooks to UI components. They should stay thin.

Components render UI from props. They should not create API clients or own cross-page side effects.

Hooks own React state, TanStack Query calls, mutations, subscriptions, and derived page state. They may depend on `lib/api`, `lib/websocket`, and feature utilities.

Utilities are pure functions. Filtering, validation, log formatting, guards, and label mapping belong here and should be easy to test without rendering React.

Constants contain empty form values, status label maps, API URLs, and WebSocket URLs. Shared app URLs should move to `app/config.ts` so `App.tsx`, feature hooks, and clients do not repeat literals.

## Feature Details

### App Shell

Move layout from `App.tsx` into `components/layout/AppShell.tsx`. Extract `Sidebar`, `TopStatusBar`, and `StatusPill`.

`App.tsx` should initialize backend and WebSocket status, then render:

```tsx
<AppShell backendStatus={backendStatus} websocketStatus={websocketStatus}>
  <Routes>...</Routes>
</AppShell>
```

This keeps route rendering in `App.tsx` while removing visual shell details.

### Scripts

Split `ScriptPages.tsx` into list and editor pages.

Move list-specific filtering UI into `ScriptFilters`. Move each row/card into `ScriptListItem`. Move editor step rendering into `ScriptStepEditor` and parameter rendering into `ParameterInput`.

Move `filterScripts`, `uniqueValues`, `groupKeywords`, `validateScript`, `matchesType`, `formatIssue`, and validation issue normalization into `utils/`.

Keep exported route components available through `features/scripts/index.ts` so `app/routes.tsx` can import from the feature root.

### Execution

Keep `TaskPage` as the route page, but extract task controls, selected script summary, task details, recent task item, and live logs into components.

Move execution WebSocket subscription into `useExecutionSocket`. Move task creation, cancellation, script selection, and recent task query handling into `useExecutionTasks`.

Move `formatLogEntry`, `formatEventLog`, `isExecutionEventMessage`, `shouldRefreshTasks`, `canCancelTask`, `statusVariant`, and `taskStatusLabel` into utility files.

### Tools

Split `ToolPages.tsx` into two nested feature areas: `command-library` and `ssh-terminal`.

The command library should own command form state, save/delete mutations, search, and command list rendering.

The SSH terminal should own xterm setup, connection state, suggestions, and terminal interaction. Existing SSH store logic should move from `sshTerminalStore.ts` to `ssh-terminal/store.ts`, with import paths updated.

## Testing

This change should preserve behavior, so tests can mostly move with the files they cover.

Run after implementation:

- `pnpm check:web`
- `pnpm --filter @testflow/web test`

For visible UI changes caused by the refactor, verify the affected routes in the browser:

- `/scripts`
- `/scripts/new`
- `/tasks`
- `/commands`
- `/ssh`

If utilities are moved, add or preserve focused tests for filtering, validation, execution status labels, and command suggestions where practical.

## Implementation Order

1. Extract app shell layout from `App.tsx`.
2. Split scripts feature, starting with pure utilities and then page components.
3. Split execution feature, starting with task utilities and WebSocket hook.
4. Split tools into command library and SSH terminal subfeatures.
5. Update route imports and existing tests.
6. Run Web checks and browser verification.

## Non-Goals

This refactor should not redesign the UI, change routes, change backend API behavior, replace TanStack Query, introduce new state management libraries, or rewrite shadcn/ui components.

