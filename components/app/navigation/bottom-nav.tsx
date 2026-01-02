'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { Home, UtensilsCrossed, ShoppingCart, User, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: Home,
  },
  {
    href: '/meal-builder',
    label: 'Meals',
    icon: UtensilsCrossed,
  },
  {
    href: '/shopping-list',
    label: 'Shopping',
    icon: ShoppingCart,
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: User,
  },
]

export function BottomNav() {
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              onClick={() => startTransition(() => {})}
              className={cn(
                'relative flex flex-col items-center justify-center flex-1 h-full gap-1',
                'active:scale-95 active:opacity-70 transition-all duration-75 touch-manipulation',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              {isPending && isActive ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5px]')} />
              )}
              <span className={cn(
                'text-xs font-medium',
                isActive && 'font-semibold'
              )}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 bg-primary rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
