import * as React from 'react'

import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

export function ListToolbar({
  className,
  role = 'group',
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'grid gap-3 rounded-lg border bg-background/80 p-3 text-sm shadow-xs',
        className,
      )}
      role={role}
      {...props}
    />
  )
}

export function ListSurface({
  actions,
  children,
  className,
  description,
  title,
  ...props
}: Omit<React.ComponentProps<'section'>, 'title'> & {
  actions?: React.ReactNode
  description?: React.ReactNode
  title: React.ReactNode
}) {
  const titleId = React.useId()

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'overflow-hidden rounded-lg border bg-background text-foreground',
        className,
      )}
      {...props}
    >
      <div className="flex min-h-11 items-center justify-between gap-3 border-b bg-muted/30 px-3 py-2">
        <div className="grid gap-0.5">
          <h2 id={titleId} className="m-0 text-sm font-semibold">
            {title}
          </h2>
          {description ? (
            <p className="m-0 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

export function ListRow({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<'div'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'div'

  return (
    <Comp
      className={cn(
        'grid min-w-0 items-center gap-3 px-3 py-3 text-sm transition-colors hover:bg-muted/40 data-[selected=true]:bg-muted/50',
        className,
      )}
      {...props}
    />
  )
}
