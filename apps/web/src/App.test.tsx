import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'

import App from './App'

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App', () => {
  it('renders the phase three application shell', () => {
    renderApp()

    expect(
      screen.getByRole('heading', { name: '脚本管理' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /脚本管理/ })).toBeInTheDocument()
    expect(screen.getAllByText('后端服务')).toHaveLength(2)
    expect(screen.getAllByText('WebSocket')).toHaveLength(2)
    expect(screen.getByRole('main')).toBeInTheDocument()
  })
})
