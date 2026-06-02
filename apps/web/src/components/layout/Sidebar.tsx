import { ChevronRight } from 'lucide-react'
import { NavLink } from 'react-router'

import { appRoutes, navGroups } from '@/app/routes'
import { cn } from '@/lib/utils'

export function Sidebar() {
  return (
    <aside
      className="flex flex-col gap-7 border-r border-sidebar-border bg-sidebar px-3.5 py-5 text-sidebar-foreground max-lg:gap-4"
      aria-label="主导航"
    >
      <div className="flex items-center gap-3 px-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
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

      <nav className="grid gap-2 max-sm:grid-cols-1 max-lg:grid-cols-3">
        {navGroups.map((group) => (
          <div className="grid gap-2 border-t border-sidebar-border pt-4" key={group.id}>
            <div className="flex items-center gap-2 px-2 text-xs font-semibold text-sidebar-foreground/60">
              <group.icon aria-hidden="true" size={14} />
              {group.label}
            </div>
            {appRoutes
              .filter((route) => route.navGroup === group.id && !route.navHidden)
              .map((route) => (
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      'grid min-h-9 grid-cols-[18px_minmax(0,1fr)_14px] items-center gap-2.5 rounded-lg px-2.5 text-sm text-sidebar-foreground/75 no-underline transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      isActive &&
                      'bg-sidebar-accent text-sidebar-accent-foreground font-semibold',
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
