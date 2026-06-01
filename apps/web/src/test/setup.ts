import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: vi.fn(() => null),
})

// jsdom polyfill for Radix Select scrollIntoView
Element.prototype.scrollIntoView = vi.fn()
