import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ListRow, ListSurface, ListToolbar } from './list'

describe('list layout primitives', () => {
  afterEach(() => {
    cleanup()
  })
  it('renders a labeled toolbar, list surface, and row content', () => {
    render(
      <>
        <ListToolbar aria-label="脚本筛选">
          <label>
            搜索脚本
            <input aria-label="搜索脚本" />
          </label>
        </ListToolbar>

        <ListSurface
          description="共 1 条"
          title="脚本列表"
        >
          <ListRow>
            <span>座舱冒烟测试</span>
          </ListRow>
        </ListSurface>
      </>,
    )

    expect(screen.getByRole('group', { name: '脚本筛选' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '脚本列表' })).toBeInTheDocument()
    expect(screen.getByText('共 1 条')).toBeInTheDocument()
    expect(screen.getByText('座舱冒烟测试')).toBeInTheDocument()
  })

  it('renders actions slot on ListSurface when provided', () => {
    render(
      <ListSurface
        actions={<button type="button">新增</button>}
        title="脚本列表"
      >
        <ListRow><span>内容</span></ListRow>
      </ListSurface>,
    )

    expect(screen.getByRole('button', { name: '新增' })).toBeInTheDocument()
  })

  it('does NOT render description when omitted from ListSurface', () => {
    render(
      <ListSurface title="脚本列表">
        <ListRow><span>内容</span></ListRow>
      </ListSurface>,
    )

    expect(screen.queryByText('共 1 条')).not.toBeInTheDocument()
  })

  it('renders ListRow with asChild forwarding via Slot', () => {
    render(
      <ListSurface title="脚本列表">
        <ListRow asChild>
          <a href="/test">链接行</a>
        </ListRow>
      </ListSurface>,
    )

    const link = screen.getByRole('link', { name: '链接行' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/test')
  })

  it('passes additional section props through ListSurface', () => {
    render(
      <ListSurface
        aria-label="custom-label"
        data-testid="surface"
        title="脚本列表"
      >
        <ListRow><span>内容</span></ListRow>
      </ListSurface>,
    )

    expect(screen.getByTestId('surface')).toHaveAttribute(
      'aria-label',
      'custom-label',
    )
  })

  it('renders ListRow as plain div when asChild is false', () => {
    render(
      <ListSurface title="脚本列表">
        <ListRow data-testid="row">
          <span>内容</span>
        </ListRow>
      </ListSurface>,
    )

    const row = screen.getByTestId('row')
    expect(row.tagName).toBe('DIV')
  })
})
