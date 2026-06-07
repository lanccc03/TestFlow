import type React from 'react'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { cn } from '@/lib/utils'

export function PagePanel({
  className,
  ...props
}: React.ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'grid min-h-[360px] content-start gap-5 text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function PageHeader({
  actions,
  subtitle,
  title,
}: {
  actions?: React.ReactNode
  subtitle?: React.ReactNode
  title: React.ReactNode
}) {
  return (
    <div className="flex min-h-14 items-start justify-between gap-4 border-b border-border/70 pb-4 max-sm:flex-col">
      <div className="grid gap-1.5">
        <h1 className="m-0 text-[1.55rem] font-bold leading-tight tracking-normal text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <p className="m-0 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-0.5">
          {actions}
        </div>
      ) : null}
    </div>
  )
}

export function EmptyState({
  className,
  description,
  icon,
  title,
}: {
  className?: string
  description?: React.ReactNode
  icon?: React.ReactNode
  title: React.ReactNode
}) {
  return (
    <Empty className={cn('min-h-18 rounded-md border border-dashed border-border/80 bg-muted/20', className)}>
      <EmptyHeader>
        {icon ? <EmptyMedia variant="icon">{icon}</EmptyMedia> : null}
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
    </Empty>
  )
}
