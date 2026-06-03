import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export function StatusPill({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: LucideIcon
  label: string
  tone: 'success' | 'warning'
  value: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 whitespace-nowrap px-2 text-[11px] leading-none text-sidebar-foreground/75',
      )}
    >
      <Icon aria-hidden="true" className="text-sidebar-foreground/50" size={13} />
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          tone === 'success' ? 'bg-emerald-400' : 'bg-amber-400',
        )}
      />
      <span className="text-sidebar-foreground/55 max-sm:hidden">{label}</span>
      <strong className="font-medium text-sidebar-foreground">{value}</strong>
    </span>
  )
}
