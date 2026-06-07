import { ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { NavLink } from 'react-router'

import { appRoutes, navGroups } from '@/app/routes'
import { cn } from '@/lib/utils'

export function Sidebar() {
  return (
    <aside
      className="sticky top-0 flex h-screen flex-col gap-5 border-r border-sidebar-border bg-sidebar/95 px-3 py-4 text-sidebar-foreground shadow-[inset_-1px_0_0_rgb(255_255_255_/_0.38)] max-lg:static max-lg:h-auto max-lg:gap-4"
      aria-label="主导航"
    >
      <nav className="grid gap-4 max-sm:grid-cols-1 max-lg:grid-cols-3">
        {navGroups.map((group) => (
          <div className="grid gap-1.5" key={group.id}>
            <div className="flex items-center gap-2 px-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-sidebar-foreground/48">
              <group.icon aria-hidden="true" size={13} />
              {group.label}
            </div>
            {appRoutes
              .filter((route) => route.navGroup === group.id && !route.navHidden)
              .map((route) => (
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      'relative grid min-h-9 grid-cols-[18px_minmax(0,1fr)_14px] items-center gap-2.5 overflow-hidden rounded-md border border-transparent px-2.5 text-sm text-sidebar-foreground/70 no-underline transition-colors hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground',
                      isActive &&
                      'border-sidebar-border/70 text-sidebar-primary-foreground shadow-[0_10px_24px_rgb(31_65_56_/_0.14)]',
                    )
                  }
                  end
                  key={route.path}
                  to={route.path}
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? (
                        <motion.span
                          aria-hidden="true"
                          className="absolute inset-0 rounded-md bg-sidebar-primary"
                          layoutId="sidebar-active-route"
                          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        />
                      ) : null}
                      <route.icon aria-hidden="true" className="relative z-10" size={17} />
                      <span className="relative z-10 truncate">{route.label}</span>
                      <ChevronRight aria-hidden="true" className="relative z-10" size={14} />
                    </>
                  )}
                </NavLink>
              ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
