'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw, Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function RecipesError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to console in development
    console.error('Recipes page error:', error)
    
    // In production, you could send this to an error tracking service
    // or to your audit log API endpoint
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">Something went wrong</CardTitle>
          <CardDescription className="text-base mt-2">
            We encountered an error while loading the recipes page. This might be a temporary issue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error details (only show digest in production for debugging) */}
          {error.digest && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Error ID: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{error.digest}</code>
              </p>
            </div>
          )}

          {/* Development-only error message */}
          {process.env.NODE_ENV === 'development' && error.message && (
            <div className="p-3 rounded-md bg-destructive/5 border border-destructive/20">
              <p className="text-sm text-destructive font-mono break-all">
                {error.message}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button 
              onClick={reset} 
              className="flex-1 gap-2"
              variant="default"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 gap-2"
              asChild
            >
              <Link href="/admin">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>

          {/* Help text */}
          <p className="text-center text-sm text-muted-foreground pt-2">
            If this problem persists, please contact support.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
