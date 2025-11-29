'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html>
      <body className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <AlertTriangle className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Something went wrong!
            </h1>
            <p className="text-muted-foreground">
              We apologize for the inconvenience. An unexpected error has occurred.
            </p>
          </div>

          {/* Error digest */}
          {error.digest && (
            <p className="text-xs text-muted-foreground">
              Error ID: <code className="bg-muted px-1.5 py-0.5 rounded">{error.digest}</code>
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Home className="h-4 w-4" />
              Go home
            </a>
          </div>

          {/* Help text */}
          <p className="text-sm text-muted-foreground">
            If this problem persists, please try refreshing the page or contact support.
          </p>
        </div>
      </body>
    </html>
  )
}
