import { Metadata } from 'next'
import { getNotificationAnalytics } from '@/lib/actions/notification-analytics'
import { NotificationAnalytics } from '@/components/admin/notification-analytics'
import { NotificationAnalyticsHeader } from '@/components/admin/notification-analytics-header'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Notification Analytics | Admin',
  description: 'View notification performance and engagement metrics',
}

export const revalidate = 0 // Don't cache, always fetch fresh data

export default async function NotificationAnalyticsPage() {
  const { data: stats, error } = await getNotificationAnalytics()

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
              Failed to Load Analytics
            </h2>
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/admin/notifications">
                Back to Notifications
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-muted-foreground">No analytics data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <NotificationAnalyticsHeader />

      {/* Analytics Dashboard */}
      <NotificationAnalytics stats={stats} />
    </div>
  )
}
