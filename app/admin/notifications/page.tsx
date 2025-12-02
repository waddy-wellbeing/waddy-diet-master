import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { NotificationsPanel } from '@/components/admin/notifications-panel'
import { getNotificationStats, getUsersWithSubscriptions, getRecentNotifications } from '@/lib/actions/notifications'

export const metadata = {
  title: 'Notifications | BiteRight Admin',
  description: 'Send push notifications and manage notification settings',
}

async function NotificationsContent() {
  const [statsResult, usersResult, logsResult] = await Promise.all([
    getNotificationStats(),
    getUsersWithSubscriptions(),
    getRecentNotifications(10),
  ])

  return (
    <NotificationsPanel
      stats={statsResult.success ? statsResult.data : null}
      users={usersResult.success ? (usersResult.data || []) : []}
      recentLogs={logsResult.success ? (logsResult.data || []) : []}
    />
  )
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Send notification skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>

      {/* Recent logs skeleton */}
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

export default function AdminNotificationsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Push Notifications</h1>
        <p className="text-muted-foreground">
          Send push notifications to users and view notification logs
        </p>
      </div>

      {/* Notifications Panel */}
      <Suspense fallback={<NotificationsSkeleton />}>
        <NotificationsContent />
      </Suspense>
    </div>
  )
}
