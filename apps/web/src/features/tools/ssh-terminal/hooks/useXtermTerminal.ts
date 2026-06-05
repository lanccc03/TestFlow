import type { FitAddon as XtermFitAddon } from '@xterm/addon-fit'
import type { Terminal as XtermTerminal } from '@xterm/xterm'
import { useEffect, useRef } from 'react'

type TerminalSize = {
  cols: number
  rows: number
}

type UseXtermTerminalOptions = {
  attachTerminal: (writer: (data: string) => void) => () => void
  sendInput: (data: string) => void
  sendResize: (options: TerminalSize) => void
}

export function useXtermTerminal({
  attachTerminal,
  sendInput,
  sendResize,
}: UseXtermTerminalOptions) {
  const terminalContainerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<XtermTerminal | null>(null)
  const fitAddonRef = useRef<XtermFitAddon | null>(null)

  useEffect(() => {
    if (!terminalContainerRef.current) {
      return
    }

    let isDisposed = false
    function sendTerminalSize() {
      if (!terminalRef.current) {
        return
      }

      sendResize({
        cols: terminalRef.current.cols,
        rows: terminalRef.current.rows,
      })
    }

    function handleResize() {
      fitAddonRef.current?.fit()
      sendTerminalSize()
    }

    let detachTerminal: (() => void) | undefined
    void Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
    ]).then(([xtermModule, fitModule]) => {
      if (isDisposed || !terminalContainerRef.current) {
        return
      }

      const terminal = new xtermModule.Terminal({
        cursorBlink: true,
        fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
        fontSize: 13,
        theme: {
          background: '#0b171b',
          foreground: '#dce8eb',
        },
      })
      const fitAddon = new fitModule.FitAddon()
      terminal.loadAddon(fitAddon)
      terminal.open(terminalContainerRef.current)
      fitAddon.fit()
      terminal.onData((data) => {
        sendInput(data)
      })
      detachTerminal = attachTerminal((data) => terminal.write(data))
      terminalRef.current = terminal
      fitAddonRef.current = fitAddon
    })

    window.addEventListener('resize', handleResize)

    return () => {
      isDisposed = true
      window.removeEventListener('resize', handleResize)
      detachTerminal?.()
      terminalRef.current?.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [attachTerminal, sendInput, sendResize])

  function getTerminalSize() {
    return {
      cols: terminalRef.current?.cols ?? 80,
      rows: terminalRef.current?.rows ?? 24,
    }
  }

  return {
    getTerminalSize,
    terminalContainerRef,
  }
}
