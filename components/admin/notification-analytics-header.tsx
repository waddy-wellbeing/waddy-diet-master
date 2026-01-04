'use client'

import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import Link from 'next/link'

export function NotificationAnalyticsHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">Notification Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Monitor performance and engagement metrics
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" asChild>
          <Link href="/admin/notifications">
            Back to Notifications
          </Link>
        </Button>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    </div>
  )
}
