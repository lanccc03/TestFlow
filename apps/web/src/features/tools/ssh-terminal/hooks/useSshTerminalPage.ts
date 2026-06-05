import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/app/backend'
import type { CommandTemplate } from '@/lib/api'

import { useSshTerminalStore } from '../store'
import { filterCommandSuggestions } from '../utils/commandSuggestions'
import { useXtermTerminal } from './useXtermTerminal'

export function useSshTerminalPage() {
  const currentLine = useSshTerminalStore((state) => state.currentLine)
  const errorMessage = useSshTerminalStore((state) => state.errorMessage)
  const form = useSshTerminalStore((state) => state.form)
  const status = useSshTerminalStore((state) => state.status)
  const applyStoredSuggestion = useSshTerminalStore(
    (state) => state.applySuggestion,
  )
  const attachTerminal = useSshTerminalStore((state) => state.attachTerminal)
  const connectSsh = useSshTerminalStore((state) => state.connect)
  const disconnectSsh = useSshTerminalStore((state) => state.disconnect)
  const sendInput = useSshTerminalStore((state) => state.sendInput)
  const sendResize = useSshTerminalStore((state) => state.sendResize)
  const updateForm = useSshTerminalStore((state) => state.updateForm)
  const { getTerminalSize, terminalContainerRef } = useXtermTerminal({
    attachTerminal,
    sendInput,
    sendResize,
  })

  const commandsQuery = useQuery({
    queryKey: ['commands', ''],
    queryFn: () => api.listCommands(''),
  })
  const suggestions = useMemo(
    () => filterCommandSuggestions(commandsQuery.data?.items ?? [], currentLine),
    [commandsQuery.data?.items, currentLine],
  )

  function connect() {
    connectSsh(getTerminalSize())
  }

  function disconnect() {
    disconnectSsh()
  }

  function applySuggestion(command: CommandTemplate) {
    applyStoredSuggestion(command.command)
  }

  return {
    applySuggestion,
    connect,
    disconnect,
    errorMessage,
    form,
    status,
    suggestions,
    terminalContainerRef,
    updateForm,
  }
}
