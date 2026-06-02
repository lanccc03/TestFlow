import type { CommandTemplate } from '@/lib/api'

export function filterCommandSuggestions(
  commands: CommandTemplate[],
  currentLine: string,
) {
  const query = currentLine.trim().toLowerCase()
  if (!query) {
    return []
  }

  return commands
    .filter(
      (command) =>
        command.command.toLowerCase().startsWith(query) ||
        command.name.toLowerCase().includes(query),
    )
    .slice(0, 6)
}
