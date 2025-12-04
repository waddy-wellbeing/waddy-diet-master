'use client'

/**
 * Route Change Tracker
 * Tracks page navigation and updates analytics
 * Non-blocking and safe operation
 */

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAnalytics } from '@/components/analytics/analytics-provider'
import { buildPageViewEvent } from '@/lib/utils/analytics'

/**
 * Hook to track page navigation
 * Call this once in root layout to track all page changes
 */
export function useRouteTracker() {
  const pathname = usePathname()
  const { trackEvent } = useAnalytics()
  const previousPathnameRef = useRef<string>('')

  useEffect(() => {
    // Only track if pathname actually changed
    if (previousPathnameRef.current && previousPathnameRef.current !== pathname) {
      // Track page view event
      const pageViewEvent = buildPageViewEvent(pathname, previousPathnameRef.current)
      trackEvent(pageViewEvent)
    }

    // Update previous pathname
    previousPathnameRef.current = pathname
  }, [pathname, trackEvent])
}

/**
 * Component wrapper for route tracking
 * Use this in root layout if you prefer component-based tracking
 */
export function RouteTrackerComponent() {
  useRouteTracker()
  return null
}
