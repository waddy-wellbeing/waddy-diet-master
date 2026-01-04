'use server'

import { createClient } from '@/lib/supabase/server'

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

/**
 * Get comprehensive notification analytics for admin dashboard
 */
export async function getNotificationAnalytics(): Promise<{
  data: NotificationStats | null
  error: string | null
}> {
  try {
    const supabase = await createClient()

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: 'Unauthorized' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return { data: null, error: 'Admin access required' }
    }

    // Parallel queries for efficiency
    const [
      totalNotifications,
      clickedNotifications,
      activeSubsCount,
      inactiveSubsCount,
      usersWithPushCount,
      last24HoursCount,
      last7DaysCount,
      notificationsByType,
      recentFailuresCount,
    ] = await Promise.all([
      // Total sent
      supabase
        .from('notifications_log')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent'),

      // Total clicked
      supabase
        .from('notifications_log')
        .select('*', { count: 'exact', head: true })
        .not('clicked_at', 'is', null),

      // Active subscriptions
      supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),

      // Inactive subscriptions
      supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', false),

      // Users with push enabled
      supabase
        .from('notification_settings')
        .select('*', { count: 'exact', head: true })
        .eq('push_enabled', true),

      // Last 24 hours
      supabase
        .from('notifications_log')
        .select('*', { count: 'exact', head: true })
        .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

      // Last 7 days
      supabase
        .from('notifications_log')
        .select('*', { count: 'exact', head: true })
        .gte('sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

      // By type (need actual data for aggregation)
      supabase
        .from('notifications_log')
        .select('notification_type, clicked_at')
        .order('sent_at', { ascending: false }),

      // Recent failures
      supabase
        .from('notifications_log')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ])

    // Calculate stats by type
    const typeStats: Record<string, { sent: number; clicked: number; clickRate: number }> = {}
    
    if (notificationsByType.data) {
      for (const notification of notificationsByType.data) {
        const type = notification.notification_type || 'other'
        
        if (!typeStats[type]) {
          typeStats[type] = { sent: 0, clicked: 0, clickRate: 0 }
        }
        
        typeStats[type].sent++
        if (notification.clicked_at) {
          typeStats[type].clicked++
        }
      }

      // Calculate click rates
      for (const type in typeStats) {
        const stats = typeStats[type]
        stats.clickRate = stats.sent > 0 ? (stats.clicked / stats.sent) * 100 : 0
      }
    }

    const totalSent = totalNotifications.count || 0
    const totalClicked = clickedNotifications.count || 0

    const stats: NotificationStats = {
      totalSent,
      totalClicked,
      clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
      activeSubscriptions: activeSubsCount.count || 0,
      inactiveSubscriptions: inactiveSubsCount.count || 0,
      usersWithPush: usersWithPushCount.count || 0,
      last24Hours: last24HoursCount.count || 0,
      last7Days: last7DaysCount.count || 0,
      byType: typeStats,
      recentFailures: recentFailuresCount.count || 0,
    }

    return { data: stats, error: null }
  } catch (error) {
    console.error('Error fetching notification analytics:', error)
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get detailed notification history with pagination
 */
export async function getNotificationHistory(
  page = 1,
  pageSize = 50,
  filters?: {
    type?: string
    status?: 'sent' | 'clicked' | 'failed'
    userId?: string
  }
): Promise<{
  data: Array<{
    id: string
    title: string
    body: string
    notification_type: string
    status: string
    sent_at: string
    clicked_at: string | null
    user_id: string
    is_broadcast: boolean
  }> | null
  count: number
  error: string | null
}> {
  try {
    const supabase = await createClient()

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, count: 0, error: 'Unauthorized' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return { data: null, count: 0, error: 'Admin access required' }
    }

    let query = supabase
      .from('notifications_log')
      .select('*', { count: 'exact' })

    // Apply filters
    if (filters?.type) {
      query = query.eq('notification_type', filters.type)
    }

    if (filters?.status === 'clicked') {
      query = query.not('clicked_at', 'is', null)
    } else if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId)
    }

    // Pagination
    const offset = (page - 1) * pageSize
    const { data, count, error } = await query
      .order('sent_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) {
      return { data: null, count: 0, error: error.message }
    }

    return { data: data || [], count: count || 0, error: null }
  } catch (error) {
    console.error('Error fetching notification history:', error)
    return {
      data: null,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Clean up inactive subscriptions older than specified days
 */
export async function cleanupInactiveSubscriptions(
  olderThanDays = 30
): Promise<{
  success: boolean
  deleted: number
  error: string | null
}> {
  try {
    const supabase = await createClient()

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, deleted: 0, error: 'Unauthorized' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return { success: false, deleted: 0, error: 'Admin access required' }
    }

    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)

    const { data, error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('is_active', false)
      .lt('updated_at', cutoffDate.toISOString())
      .select('id')

    if (error) {
      return { success: false, deleted: 0, error: error.message }
    }

    return { success: true, deleted: data?.length || 0, error: null }
  } catch (error) {
    console.error('Error cleaning up subscriptions:', error)
    return {
      success: false,
      deleted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
