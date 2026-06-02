import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
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
    <Badge
      className={cn(
        'min-h-8 gap-1.5 rounded-lg px-2.5 font-medium',
        tone === 'success'
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground',
      )}
      variant={tone === 'success' ? 'default' : 'secondary'}
    >
      <Icon aria-hidden="true" size={14} />
      <span className="text-current/70">{label}</span>
      <strong className="font-semibold">{value}</strong>
    </Badge>
  )
}
