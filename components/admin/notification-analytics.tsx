'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, Send, MousePointer, Users, TrendingUp, AlertCircle } from 'lucide-react'

interface NotificationStats {
  totalSent: number
  totalClicked: number
  clickRate: number
  activeSubscriptions: number
  inactiveSubscriptions: number
  usersWithPush: number
  last24Hours: number
  last7Days: number
  byType: Record<string, { sent: number; clicked: number; clickRate: number }>
  recentFailures: number
}

interface AnalyticsProps {
  stats: NotificationStats
}

export function NotificationAnalytics({ stats }: AnalyticsProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const overallClickRate = stats.totalSent > 0 
    ? ((stats.totalClicked / stats.totalSent) * 100).toFixed(1)
    : '0.0'

  const subscriptionHealth = stats.activeSubscriptions + stats.inactiveSubscriptions > 0
    ? ((stats.activeSubscriptions / (stats.activeSubscriptions + stats.inactiveSubscriptions)) * 100).toFixed(0)
    : '0'

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.last24Hours} in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallClickRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalClicked.toLocaleString()} total clicks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              {subscriptionHealth}% health rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users with Push</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.usersWithPush}</div>
            <p className="text-xs text-muted-foreground">
              Notifications enabled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Type</CardTitle>
          <CardDescription>
            Engagement metrics for each notification type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(stats.byType).map(([type, data]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium capitalize">
                      {type.replace(/_/g, ' ')}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {data.sent} sent
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{data.clicked} clicks</span>
                    <span>•</span>
                    <span className={
                      data.clickRate >= 20 ? 'text-green-600 font-medium' :
                      data.clickRate >= 10 ? 'text-yellow-600' :
                      'text-muted-foreground'
                    }>
                      {data.clickRate.toFixed(1)}% rate
                    </span>
                  </div>
                </div>
                <div className="w-32 ml-4">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        data.clickRate >= 20 ? 'bg-green-500' :
                        data.clickRate >= 10 ? 'bg-yellow-500' :
                        'bg-primary'
                      }`}
                      style={{ width: `${Math.min(data.clickRate * 5, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Subscription Health */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Health</CardTitle>
            <CardDescription>
              Active vs inactive push subscriptions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Active</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.activeSubscriptions}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{
                      width: `${
                        (stats.activeSubscriptions / (stats.activeSubscriptions + stats.inactiveSubscriptions)) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Inactive</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.inactiveSubscriptions}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all"
                    style={{
                      width: `${
                        (stats.inactiveSubscriptions / (stats.activeSubscriptions + stats.inactiveSubscriptions)) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Notifications sent in recent periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Last 24 Hours</span>
                </div>
                <span className="text-2xl font-bold">{stats.last24Hours}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Last 7 Days</span>
                </div>
                <span className="text-2xl font-bold">{stats.last7Days}</span>
              </div>
              {stats.recentFailures > 0 && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-600">Recent Failures</span>
                  </div>
                  <span className="text-2xl font-bold text-red-600">{stats.recentFailures}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Insights & Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {parseFloat(overallClickRate) < 10 && (
              <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Low Click Rate
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Your overall click rate is below 10%. Consider reviewing notification content and timing.
                  </p>
                </div>
              </div>
            )}
            
            {stats.inactiveSubscriptions > stats.activeSubscriptions * 0.2 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    High Inactive Subscription Rate
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Over 20% of subscriptions are inactive. Clean up inactive subscriptions regularly.
                  </p>
                </div>
              </div>
            )}

            {stats.recentFailures > 10 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Multiple Delivery Failures
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {stats.recentFailures} notifications failed recently. Check VAPID keys and subscription validity.
                  </p>
                </div>
              </div>
            )}

            {parseFloat(overallClickRate) >= 20 && stats.inactiveSubscriptions < stats.activeSubscriptions * 0.1 && (
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Excellent Performance
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Great click rate and subscription health! Your notifications are engaging users effectively.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
