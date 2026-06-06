import { ChevronRight } from 'lucide-react'
import { NavLink } from 'react-router'

import { appRoutes, navGroups } from '@/app/routes'
import { cn } from '@/lib/utils'

export function Sidebar() {
  return (
    <aside
      className="sticky top-0 flex h-screen flex-col gap-6 border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground max-lg:static max-lg:h-auto max-lg:gap-4"
      aria-label="主导航"
    >
      <div className="flex items-center gap-3 rounded-lg border border-sidebar-border/70 bg-white/35 px-2.5 py-2">
        <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_0.22)]">
          TF
        </div>
        <div>
          <strong className="block text-base font-semibold text-sidebar-foreground">
            TestFlow
          </strong>
          <span className="mt-0.5 block text-xs text-sidebar-foreground/60">
            自动化测试工作台
          </span>
        </div>
      </div>

      <nav className="grid gap-3 max-sm:grid-cols-1 max-lg:grid-cols-3">
        {navGroups.map((group) => (
          <div className="grid gap-1.5 border-t border-sidebar-border/75 pt-3" key={group.id}>
            <div className="flex items-center gap-2 px-2 pb-1 text-xs font-semibold text-sidebar-foreground/55">
              <group.icon aria-hidden="true" size={14} />
              {group.label}
            </div>
            {appRoutes
              .filter((route) => route.navGroup === group.id && !route.navHidden)
              .map((route) => (
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      'grid min-h-9 grid-cols-[18px_minmax(0,1fr)_14px] items-center gap-2.5 rounded-md border border-transparent px-2.5 text-sm text-sidebar-foreground/72 no-underline transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
                      isActive &&
                      'border-sidebar-border bg-white/55 text-sidebar-accent-foreground font-semibold shadow-[inset_3px_0_0_var(--sidebar-primary)]',
                    )
                  }
                  end
                  key={route.path}
                  to={route.path}
                >
                  <route.icon aria-hidden="true" size={17} />
                  <span>{route.label}</span>
                  <ChevronRight aria-hidden="true" size={14} />
                </NavLink>
              ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
