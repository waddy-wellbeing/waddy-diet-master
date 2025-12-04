'use client'

/**
 * Analytics Context Provider
 * Manages session state and provides analytics tracking methods
 * All operations are non-blocking and errors are safely caught
 */

import { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react'
import {
  getOrCreateSessionId,
  clearSessionId,
  getCurrentPagePath,
  trackPageInSession,
  getTrackedPages,
  getTimeSinceSessionStart,
  buildPageViewEvent,
  buildErrorCapture,
} from '@/lib/utils/analytics'
import {
  trackSession,
  trackEvent,
  captureError,
  endSession as endSessionAction,
} from '@/lib/actions/analytics'
import { createClient } from '@/lib/supabase/client'
import type { AnalyticsContextValue, TrackEventInput, CaptureErrorInput } from '@/lib/types/analytics'

// Context
const AnalyticsContext = createContext<AnalyticsContextValue | undefined>(undefined)

/**
 * Hook to use analytics context
 */
export function useAnalytics(): AnalyticsContextValue {
  const context = useContext(AnalyticsContext)
  if (!context) {
    throw new Error('useAnalytics must be used within AnalyticsProvider')
  }
  return context
}

/**
 * Props for AnalyticsProvider
 */
interface AnalyticsProviderProps {
  children: React.ReactNode
}

/**
 * Analytics Provider Component
 * Manages session lifecycle and provides tracking methods
 * Key features:
 * - Non-blocking analytics (never throws or interrupts user)
 * - Automatic session initialization
 * - Graceful error handling
 * - Memory-efficient cleanup
 */
export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const [userId, setUserId] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const sessionIdRef = useRef<string>('')
  const sessionStartTimeRef = useRef<number>(0)
  const pendingEventsRef = useRef<Array<TrackEventInput & { timeSinceSessionStartMs?: number }>>([])
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pageTimeTrackerRef = useRef<{ page: string; startTime: number } | null>(null)

  /**
   * Get current user from Supabase on mount
   */
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        setUserId(user?.id || null)
      } catch (error) {
        // Silently fail - analytics should not break the app
        console.error('Failed to get user for analytics:', error)
        setUserId(null)
      }
    }
    initializeUser()
  }, [])

  /**
   * Safely execute analytics operations
   * Catches and logs errors without throwing
   */
  const safeAsyncOp = useCallback(async (operation: () => Promise<void>, context: string) => {
    try {
      await operation()
    } catch (error) {
      // Log to console in development, silently fail in production
      if (process.env.NODE_ENV === 'development') {
        console.error(`Analytics error in ${context}:`, error)
      }
      // Never throw - analytics should never break the app
    }
  }, [])

  /**
   * Flush pending events to server
   */
  const flushPendingEvents = useCallback(
    async (sessionId: string, userId: string | null) => {
      if (pendingEventsRef.current.length === 0) return

      const eventsToFlush = [...pendingEventsRef.current]
      pendingEventsRef.current = []

      await safeAsyncOp(async () => {
        const { batchTrackEvents } = await import('@/lib/actions/analytics')
        await batchTrackEvents(sessionId, userId, eventsToFlush)
      }, 'batchTrackEvents')
    },
    [safeAsyncOp]
  )

  /**
   * Schedule batch event flush
   */
  const scheduleBatchFlush = useCallback(
    (sessionId: string, userId: string | null) => {
      // Clear existing timer
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current)
      }

      // Set new timer - flush after 5 seconds or when we hit 10 events
      if (pendingEventsRef.current.length >= 10) {
        flushPendingEvents(sessionId, userId)
      } else {
        batchTimerRef.current = setTimeout(() => {
          flushPendingEvents(sessionId, userId)
        }, 5000)
      }
    },
    [flushPendingEvents]
  )

  /**
   * Initialize session on mount
   */
  useEffect(() => {
    // Skip if already initialized (check before any async operations)
    if (sessionIdRef.current) {
      return
    }

    const initializeSession = async () => {
      try {
        const sessionId = getOrCreateSessionId()
        // Set synchronously to prevent race conditions
        sessionIdRef.current = sessionId
        sessionStartTimeRef.current = Date.now()

        // Initialize session on server (non-blocking)
        await safeAsyncOp(async () => {
          const { detectDeviceType, getScreenResolution, getBrowserInfo, getUserAgent } =
            await import('@/lib/utils/analytics')

          const deviceType = detectDeviceType()
          const screenResolution = getScreenResolution()
          const { browser, os } = getBrowserInfo()
          const userAgent = getUserAgent()

          await trackSession({
            session_id: sessionId,
            user_id: userId || undefined,
            device_type: deviceType,
            browser,
            os,
            screen_resolution: screenResolution,
            user_agent: userAgent,
            landing_page: getCurrentPagePath(),
          })
        }, 'trackSession')

        // Track initial page view
        trackPageInSession(getCurrentPagePath())

        setInitialized(true)
      } catch (error) {
        // Silently fail and continue - app should work without analytics
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to initialize analytics session:', error)
        }
        setInitialized(true) // Mark as initialized anyway so app continues
      }
    }

    initializeSession()

    // Cleanup on unmount
    return () => {
      // Flush any pending events
      if (pendingEventsRef.current.length > 0 && sessionIdRef.current) {
        flushPendingEvents(sessionIdRef.current, userId || null)
      }

      // Clear timer
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current)
      }
    }
  }, [userId, safeAsyncOp, flushPendingEvents])

  /**
   * Track event with batching
   */
  const trackEventWithBatching = useCallback(
    async (eventData: TrackEventInput) => {
      const sessionId = sessionIdRef.current
      if (!sessionId) return

      const timeSinceSessionStart = getTimeSinceSessionStart()
      const eventWithTiming = { ...eventData, timeSinceSessionStartMs: timeSinceSessionStart }

      // Add to batch
      pendingEventsRef.current.push(eventWithTiming)

      // Schedule flush
      scheduleBatchFlush(sessionId, userId || null)
    },
    [userId, scheduleBatchFlush]
  )

  /**
   * Track event (exposed API)
   */
  const trackEventAsync = useCallback(
    async (eventData: TrackEventInput): Promise<void> => {
      // Non-blocking - always succeeds
      trackEventWithBatching(eventData)
    },
    [trackEventWithBatching]
  )

  /**
   * Capture error (exposed API)
   */
  const captureErrorAsync = useCallback(
    async (errorData: CaptureErrorInput): Promise<void> => {
      const sessionId = sessionIdRef.current

      // Non-blocking - fire and forget
      safeAsyncOp(async () => {
        await captureError(sessionId || null, userId || null, errorData)
      }, 'captureError')
    },
    [userId, safeAsyncOp]
  )

  /**
   * Context value
   */
  const contextValue: AnalyticsContextValue = {
    session_id: sessionIdRef.current,
    user_id: userId || null,
    initialized,
    trackEvent: trackEventAsync,
    captureError: captureErrorAsync,
  }

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  )
}

export { AnalyticsContext }
