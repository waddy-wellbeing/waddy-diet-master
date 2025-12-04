'use client'

/**
 * Analytics Error Boundary
 * Catches React errors and logs them safely without breaking the app
 * All errors are logged asynchronously and never thrown
 */

import React, { ReactNode } from 'react'
import { buildReactError } from '@/lib/utils/analytics'
import { getOrCreateSessionId } from '@/lib/utils/analytics'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error) => ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class AnalyticsErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error asynchronously without blocking
    this.logErrorAsync(error, errorInfo)
  }

  private async logErrorAsync(error: Error, errorInfo: React.ErrorInfo) {
    try {
      const { captureError } = await import('@/lib/actions/analytics')
      const sessionId = getOrCreateSessionId()

      // Get user ID if available
      let userId: string | null = null
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        userId = user?.id || null
      } catch {
        // If user fetch fails, proceed without user ID
      }

      // Capture the error safely (handle null componentStack)
      const errorCapture = buildReactError(error, {
        componentStack: errorInfo.componentStack || undefined
      })

      await captureError(sessionId, userId, errorCapture)
    } catch (logError) {
      // Silently fail - even error logging shouldn't break the app
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to log React error:', logError)
      }
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error)
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full text-center">
            <div className="mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10">
                <svg
                  className="w-6 h-6 text-destructive"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-2">
              Oops, something went wrong
            </h1>

            <p className="text-muted-foreground mb-6">
              We've logged this error and our team will look into it. Please try refreshing the page.
            </p>

            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Refresh Page
            </button>

            {process.env.NODE_ENV === 'development' && (
              <details className="mt-6 text-left bg-muted p-3 rounded-lg">
                <summary className="cursor-pointer font-mono text-sm text-muted-foreground">
                  Error details (dev only)
                </summary>
                <pre className="mt-2 text-xs overflow-auto max-h-64 text-destructive">
                  {this.state.error.toString()}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
