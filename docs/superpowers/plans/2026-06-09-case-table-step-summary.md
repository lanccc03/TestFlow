# Case Table Step Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the framework case catalog table show only the first test step by default, with an inline expansion control for the full step list.

**Architecture:** Keep the behavior local to `ScriptListPage.tsx`. Add row-level expansion state keyed by case id, render a compact first-step summary by default, and expand the selected row inside the existing `测试步骤` table cell.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS v4, shadcn table/button primitives, Vitest, Testing Library.

---

## File Structure

- Modify `apps/web/src/features/scripts/pages/ScriptListPage.tsx`: add expansion state and replace the always-full step list with compact/expanded step rendering.
- Modify `apps/web/src/features/scripts/ScriptRunNavigation.test.tsx`: assert the case catalog defaults to first-step-only display and expands to show all steps.

---

### Task 1: Add Failing UI Coverage

**Files:**
- Modify: `apps/web/src/features/scripts/ScriptRunNavigation.test.tsx`

- [ ] **Step 1: Update the test fixture with a long second step**

Replace the existing `caseSummary.test_steps` with this exact array so the test catches hidden non-first steps:

```tsx
const caseSummary = {
  id: 'case.smoke_cockpit',
  name: '座舱冒烟测试',
  description: '基础稳定性巡检',
  tag: 'smoke',
  test_steps: [
    '启动系统',
    '确认首页加载并检查关键状态正常',
    '采集运行状态',
  ],
}
```

- [ ] **Step 2: Update the existing navigation test expectations**

In `navigates from framework case catalog run action to tasks with taskId`, keep the assertions for the case name, table, description, tag, and first step. Add assertions that the second step is hidden by default and the count is visible:

```tsx
expect(screen.getByText('启动系统')).toBeInTheDocument()
expect(screen.queryByText('确认首页加载并检查关键状态正常')).not.toBeInTheDocument()
expect(screen.getByText('共 3 步')).toBeInTheDocument()
expect(screen.getByRole('button', { name: '查看 座舱冒烟测试 的全部测试步骤' })).toBeInTheDocument()
```

Remove the old expectation that assumes all steps are visible by default if it conflicts with the new assertions.

- [ ] **Step 3: Add a focused expansion test**

Add this test below the navigation test:

```tsx
it('shows only the first test step until the row is expanded', async () => {
  renderWithQuery(<ScriptListPage />, ['/scripts'])

  expect(await screen.findByText('座舱冒烟测试')).toBeInTheDocument()
  expect(screen.getByText('启动系统')).toBeInTheDocument()
  expect(screen.queryByText('确认首页加载并检查关键状态正常')).not.toBeInTheDocument()
  expect(screen.queryByText('采集运行状态')).not.toBeInTheDocument()

  fireEvent.click(
    screen.getByRole('button', { name: '查看 座舱冒烟测试 的全部测试步骤' }),
  )

  expect(screen.getByText('确认首页加载并检查关键状态正常')).toBeInTheDocument()
  expect(screen.getByText('采集运行状态')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '收起 座舱冒烟测试 的测试步骤' })).toBeInTheDocument()
})
```

- [ ] **Step 4: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @testflow/web test -- ScriptRunNavigation.test.tsx
```

Expected: the new assertions fail because the second and third steps are still visible by default, and the new `查看...全部测试步骤` button does not exist.

---

### Task 2: Implement Compact Step Rendering

**Files:**
- Modify: `apps/web/src/features/scripts/pages/ScriptListPage.tsx`

- [ ] **Step 1: Import React state**

Add `useState` at the top:

```tsx
import { useState } from 'react'
```

Keep the existing `Play` import unchanged:

```tsx
import { Play } from 'lucide-react'
```

- [ ] **Step 2: Add expanded row state inside `ScriptListPage`**

Immediately after the `useScriptListPage()` destructuring, add:

```tsx
const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null)
```

- [ ] **Step 3: Replace the `测试步骤` table cell content**

Replace the current `TableCell` for `caseItem.test_steps` with this implementation:

```tsx
<TableCell className="max-w-[420px] whitespace-normal align-top">
  {caseItem.test_steps.length === 0 ? (
    <span className="text-sm text-muted-foreground">暂无步骤说明</span>
  ) : (
    <div className="grid min-w-0 gap-2">
      {expandedCaseId === caseItem.id ? (
        <ol className="m-0 grid gap-1 pl-5 text-sm leading-relaxed">
          {caseItem.test_steps.map((step, index) => (
            <li className="break-words" key={`${caseItem.id}-${index}`}>
              {step}
            </li>
          ))}
        </ol>
      ) : (
        <div className="min-w-0 text-sm leading-relaxed">
          <span className="font-medium text-muted-foreground">1. </span>
          <span className="break-words">{caseItem.test_steps[0]}</span>
        </div>
      )}
      {caseItem.test_steps.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>共 {caseItem.test_steps.length} 步</span>
          <Button
            aria-label={
              expandedCaseId === caseItem.id
                ? `收起 ${caseItem.name} 的测试步骤`
                : `查看 ${caseItem.name} 的全部测试步骤`
            }
            className="h-auto px-0 text-xs"
            onClick={() =>
              setExpandedCaseId((current) =>
                current === caseItem.id ? null : caseItem.id,
              )
            }
            type="button"
            variant="link"
          >
            {expandedCaseId === caseItem.id ? '收起' : '查看全部'}
          </Button>
        </div>
      ) : null}
    </div>
  )}
</TableCell>
```

This class intentionally overrides the shared table cell `whitespace-nowrap` with `whitespace-normal`, sets a bounded width, and uses `break-words` for long step text.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
pnpm --filter @testflow/web test -- ScriptRunNavigation.test.tsx
```

Expected: the focused test file passes.

---

### Task 3: Update App-Level Expectation

**Files:**
- Modify: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Adjust the case fixture if needed**

Keep the existing `test_steps` array as:

```tsx
test_steps: ['启动系统', '确认首页加载', '检查关键状态正常'],
```

- [ ] **Step 2: Update the catalog rendering assertion**

In `renders framework case catalog without script maintenance controls`, keep the assertion for the first step:

```tsx
expect(screen.getByText('启动系统')).toBeInTheDocument()
```

Add compact-summary assertions:

```tsx
expect(screen.queryByText('确认首页加载')).not.toBeInTheDocument()
expect(screen.getByText('共 3 步')).toBeInTheDocument()
```

- [ ] **Step 3: Run the app test file**

Run:

```bash
pnpm --filter @testflow/web test -- App.test.tsx
```

Expected: the app test file passes.

---

### Task 4: Final Verification

**Files:**
- Verify: `apps/web/src/features/scripts/pages/ScriptListPage.tsx`
- Verify: `apps/web/src/features/scripts/ScriptRunNavigation.test.tsx`
- Verify: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Run Web typecheck/build**

Run:

```bash
pnpm check:web
```

Expected: command exits successfully.

- [ ] **Step 2: Run Web Vitest**

Run:

```bash
pnpm --filter @testflow/web test
```

Expected: all Web tests pass.

- [ ] **Step 3: Inspect git diff**

Run:

```bash
git diff -- apps/web/src/features/scripts/pages/ScriptListPage.tsx apps/web/src/features/scripts/ScriptRunNavigation.test.tsx apps/web/src/App.test.tsx
```

Expected: diff is limited to compact test-step rendering and tests.

- [ ] **Step 4: Commit the implementation**

Run:

```bash
git add apps/web/src/features/scripts/pages/ScriptListPage.tsx apps/web/src/features/scripts/ScriptRunNavigation.test.tsx apps/web/src/App.test.tsx
git commit -m "Improve case step summary table"
```

Expected: commit succeeds with only the implementation files staged.
