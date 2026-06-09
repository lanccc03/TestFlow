# Case Table Step Summary Design

## Context

The framework case catalog at `apps/web/src/features/scripts/pages/ScriptListPage.tsx` currently renders every `test_steps` item directly in the table. Because the shared table cell style uses `whitespace-nowrap`, long step text and many steps make the table too wide and reduce scanability.

## Decision

Use the compact table summary approach. The `测试步骤` column shows only the first step by default. If a case has more than one step, the cell also shows the total step count and a lightweight `查看全部` button. Clicking it expands only that row and renders the complete ordered step list inside the same table cell. Clicking `收起` returns the row to the compact state.

## Behavior

- Empty `test_steps` keeps showing `暂无步骤说明`.
- One-step cases show that single step without a `查看全部` control.
- Multi-step cases show only step 1 by default and `共 N 步`.
- Expanding one case shows all steps for that case in an ordered list.
- The run action and existing search behavior stay unchanged.
- Step text should wrap inside the step cell instead of forcing horizontal table growth.

## Files

- Modify `apps/web/src/features/scripts/pages/ScriptListPage.tsx` to add row expansion state and compact step rendering.
- Update `apps/web/src/App.test.tsx` or `apps/web/src/features/scripts/ScriptRunNavigation.test.tsx` to assert compact default behavior and expandable full-step behavior.

## Verification

- Run the focused Web test for the case catalog behavior.
- Run `pnpm check:web`.
- Run `pnpm --filter @testflow/web test` if the UI test suite remains fast enough for local verification.
