import type { LucideIcon } from 'lucide-react'
import { AlertCircle, LoaderCircle } from 'lucide-react'
import type React from 'react'

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'danger' | 'neutral' | 'success' | 'warning'
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Button({
  children,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'ghost' | 'primary' | 'secondary'
}) {
  return (
    <button className={`button button-${variant}`} type="button" {...props}>
      {children}
    </button>
  )
}

export function EmptyState({
  description,
  icon: Icon,
  title,
}: {
  description: string
  icon: LucideIcon
  title: string
}) {
  return (
    <div className="state-box">
      <Icon aria-hidden="true" size={28} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}

export function ErrorState({
  message,
  title = '加载失败',
}: {
  message: string
  title?: string
}) {
  return (
    <div className="state-box state-box-error" role="alert">
      <AlertCircle aria-hidden="true" size={28} />
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  )
}

export function LoadingState({ label = '加载中' }: { label?: string }) {
  return (
    <div className="loading-row" role="status">
      <LoaderCircle aria-hidden="true" className="spinner" size={18} />
      <span>{label}</span>
    </div>
  )
}
