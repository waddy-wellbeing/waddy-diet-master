'use client'

import { usePathname } from 'next/navigation'
import { FloatingWidget } from '@/components/floating-widget'

const HIDDEN_PATH_PREFIXES = ['/admin', '/onboarding', '/get-started/onboarding']

export function FloatingWidgetConditional() {
  const pathname = usePathname()

  const isHidden = HIDDEN_PATH_PREFIXES.some((prefix) =>
    pathname?.startsWith(prefix)
  )

  if (isHidden) return null

  return <FloatingWidget />
}
