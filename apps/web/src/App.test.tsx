import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'

import App from './App'

describe('App', () => {
  it('renders the phase three application shell', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: '脚本管理' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /脚本管理/ })).toBeInTheDocument()
    expect(screen.getAllByText('后端服务')).toHaveLength(2)
    expect(screen.getAllByText('WebSocket')).toHaveLength(2)
    expect(screen.getByRole('main')).toBeInTheDocument()
  })
})
