import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const httpGet = vi.hoisted(() => vi.fn())
const httpPut = vi.hoisted(() => vi.fn())

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: httpGet,
      put: httpPut,
    }),
    isAxiosError: (error: unknown) =>
      Boolean(
        error &&
          typeof error === 'object' &&
          'isAxiosError' in error &&
          error.isAxiosError,
      ),
  },
}))

import { FrameworkConfigPage } from '@/features/scripts'

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

describe('FrameworkConfigPage', () => {
  beforeEach(() => {
    httpGet.mockResolvedValue({
      data: {
        environment: { name: 'dev', base_url: 'http://127.0.0.1' },
        devices: [{ name: 'bench-1', host: '192.168.1.10' }],
        variables: { retries: 2, dry_run: false },
      },
    })
    httpPut.mockResolvedValue({
      data: {
        environment: { name: 'dev', base_url: 'http://127.0.0.1' },
        devices: [{ name: 'bench-1', host: '192.168.1.10' }],
        variables: { retries: 3, dry_run: false },
      },
    })
  })

  afterEach(() => {
    cleanup()
    httpGet.mockReset()
    httpPut.mockReset()
  })

  it('loads, edits, and saves framework config JSON', async () => {
    renderWithQuery(<FrameworkConfigPage />)

    const editor = await screen.findByLabelText('配置 JSON')
    expect(editor).toHaveValue()
    expect((editor as HTMLTextAreaElement).value).toContain('"environment": {')

    fireEvent.change(editor, {
      target: {
        value: JSON.stringify(
          {
            environment: { name: 'dev', base_url: 'http://127.0.0.1' },
            devices: [{ name: 'bench-1', host: '192.168.1.10' }],
            variables: { retries: 3, dry_run: false },
          },
          null,
          2,
        ),
      },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }))

    await waitFor(() =>
      expect(httpPut).toHaveBeenCalledWith('/api/framework/config', {
        environment: { name: 'dev', base_url: 'http://127.0.0.1' },
        devices: [{ name: 'bench-1', host: '192.168.1.10' }],
        variables: { retries: 3, dry_run: false },
      }),
    )
    expect(await screen.findByText('配置已保存')).toBeInTheDocument()
  })

  it('shows a validation error and does not save invalid JSON', async () => {
    renderWithQuery(<FrameworkConfigPage />)

    const editor = await screen.findByLabelText('配置 JSON')
    fireEvent.change(editor, { target: { value: '{"environment":' } })
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }))

    expect(await screen.findByText('JSON 格式无效')).toBeInTheDocument()
    expect(httpPut).not.toHaveBeenCalled()
  })
})
