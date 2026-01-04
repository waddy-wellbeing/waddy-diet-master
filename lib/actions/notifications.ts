'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import webpush from 'web-push'
import type { 
  NotificationSettings, 
  PushSubscription,
  PushNotificationPayload 
} from '@/lib/types/nutri'
import { checkRateLimit, RATE_LIMITS, BatchNotificationProcessor } from '@/lib/utils/rate-limiting'

// Configure web-push with VAPID keys
// Generate these once with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@waddyclub.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string }

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if current time is within user's quiet hours
 * @param quietStart - Start time in HH:MM format
 * @param quietEnd - End time in HH:MM format
 * @returns true if in quiet hours, false otherwise
 */
function isInQuietHours(quietStart?: string, quietEnd?: string): boolean {
  if (!quietStart || !quietEnd) return false

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  // Parse quiet hours
  const [startHour, startMin] = quietStart.split(':').map(Number)
  const [endHour, endMin] = quietEnd.split(':').map(Number)
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  // Handle cases where quiet hours span midnight
  if (startMinutes > endMinutes) {
    // e.g., 22:00 to 08:00 (overnight)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  } else {
    // e.g., 13:00 to 14:00 (same day)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }
}

// =============================================================================
// SUBSCRIPTION MANAGEMENT
// =============================================================================

export async function saveSubscription(
  subscription: PushSubscriptionJSON,
  deviceInfo?: { type?: string; name?: string }
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { endpoint, keys } = subscription
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return { success: false, error: 'Invalid subscription data' }
    }

    // Upsert subscription (update if endpoint exists)
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        device_type: deviceInfo?.type || 'web',
        device_name: deviceInfo?.name || 'Unknown Device',
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'endpoint',
      })

    if (error) {
      console.error('Error saving subscription:', error)
      return { success: false, error: 'Failed to save subscription' }
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected error saving subscription:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function removeSubscription(endpoint: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)

    if (error) {
      console.error('Error removing subscription:', error)
      return { success: false, error: 'Failed to remove subscription' }
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected error removing subscription:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function getMySubscriptions(): Promise<ActionResult<PushSubscription[]>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching subscriptions:', error)
      return { success: false, error: 'Failed to fetch subscriptions' }
    }

    return { success: true, data: data as PushSubscription[] }
  } catch (error) {
    console.error('Unexpected error fetching subscriptions:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// =============================================================================
// NOTIFICATION SETTINGS
// =============================================================================

export async function getNotificationSettings(): Promise<ActionResult<NotificationSettings | null>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching settings:', error)
      return { success: false, error: 'Failed to fetch settings' }
    }

    return { success: true, data: data as NotificationSettings | null }
  } catch (error) {
    console.error('Unexpected error fetching settings:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateNotificationSettings(
  settings: Partial<Omit<NotificationSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Upsert settings
    const { error } = await supabase
      .from('notification_settings')
      .upsert({
        user_id: user.id,
        ...settings,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (error) {
      console.error('Error updating settings:', error)
      return { success: false, error: 'Failed to update settings' }
    }

    revalidatePath('/profile')
    return { success: true }
  } catch (error) {
    console.error('Unexpected error updating settings:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// =============================================================================
// SENDING NOTIFICATIONS (Admin)
// =============================================================================

export async function sendNotificationToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<ActionResult<{ sent: number; failed: number }>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'moderator')) {
      return { success: false, error: 'Unauthorized' }
    }

    // Rate limiting check
    const rateLimitResult = checkRateLimit({
      identifier: `admin-send:${user.id}`,
      ...RATE_LIMITS.ADMIN_SEND,
    })

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`,
      }
    }

    // Get user's active subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (subError) {
      console.error('Error fetching subscriptions:', subError)
      return { success: false, error: 'Failed to fetch subscriptions' }
    }

    if (!subscriptions || subscriptions.length === 0) {
      return { success: false, error: 'User has no active subscriptions' }
    }

    // Check user's notification settings
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('push_enabled, quiet_hours_start, quiet_hours_end')
      .eq('user_id', userId)
      .single()

    if (settings && !settings.push_enabled) {
      return { success: false, error: 'User has disabled push notifications' }
    }

    // Check if user is in quiet hours
    if (settings && isInQuietHours(settings.quiet_hours_start, settings.quiet_hours_end)) {
      return { success: false, error: 'User is in quiet hours' }
    }

    // Log the notification first to get the ID
    const { data: logEntry, error: logError } = await supabase
      .from('notifications_log')
      .insert({
        user_id: userId,
        title: payload.title,
        body: payload.body,
        icon: payload.icon,
        url: payload.url,
        notification_type: 'admin',
        is_broadcast: false,
        status: 'sent',
      })
      .select('id')
      .single()

    if (logError || !logEntry) {
      console.error('Error creating notification log:', logError)
      return { success: false, error: 'Failed to log notification' }
    }

    // Add notification ID to payload for click tracking
    const payloadWithId = {
      ...payload,
      data: {
        ...payload.data,
        notificationId: logEntry.id,
      },
    }

    // Send to all devices
    let sent = 0
    let failed = 0

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payloadWithId)
        )
        sent++
      } catch (error: unknown) {
        console.error('Error sending to subscription:', error)
        failed++

        // If subscription is invalid, mark as inactive
        const webPushError = error as { statusCode?: number }
        if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('id', sub.id)
        }
      }
    }

    // Update log status if all failed
    if (sent === 0 && failed > 0) {
      await supabase
        .from('notifications_log')
        .update({ status: 'failed' })
        .eq('id', logEntry.id)
    }

    return { success: true, data: { sent, failed } }
  } catch (error) {
    console.error('Unexpected error sending notification:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function sendBroadcastNotification(
  payload: PushNotificationPayload
): Promise<ActionResult<{ sent: number; failed: number; total: number }>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Only admins can send broadcast notifications' }
    }

    // Rate limiting check for broadcasts (stricter)
    const rateLimitResult = checkRateLimit({
      identifier: `broadcast:${user.id}`,
      ...RATE_LIMITS.BROADCAST,
    })

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: `Broadcast rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`,
      }
    }

    // Get all users with push enabled and their quiet hours
    const { data: enabledUsers } = await supabase
      .from('notification_settings')
      .select('user_id, quiet_hours_start, quiet_hours_end')
      .eq('push_enabled', true)

    // Filter out users in quiet hours
    const activeUsers = enabledUsers?.filter(u => 
      !isInQuietHours(u.quiet_hours_start, u.quiet_hours_end)
    ) || []

    const activeUserIds = activeUsers.map(u => u.user_id)

    // If no users are available (all in quiet hours), return early
    if (activeUserIds.length === 0) {
      return { success: false, error: 'All users are in quiet hours or have disabled notifications' }
    }

    // Get all active subscriptions for those users
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('is_active', true)
      .in('user_id', activeUserIds)

    if (subError) {
      console.error('Error fetching subscriptions:', subError)
      return { success: false, error: 'Failed to fetch subscriptions' }
    }

    if (!subscriptions || subscriptions.length === 0) {
      return { success: false, error: 'No active subscriptions found' }
    }

    // Log the broadcast notification first to get ID
    const { data: logEntry, error: logError } = await supabase
      .from('notifications_log')
      .insert({
        user_id: user.id,
        title: payload.title,
        body: payload.body,
        icon: payload.icon,
        url: payload.url,
        notification_type: 'admin',
        is_broadcast: true,
        status: 'sent',
      })
      .select('id')
      .single()

    if (logError || !logEntry) {
      console.error('Error creating broadcast log:', logError)
      return { success: false, error: 'Failed to log notification' }
    }

    // Add notification ID to payload for click tracking
    const payloadWithId = {
      ...payload,
      data: {
        ...payload.data,
        notificationId: logEntry.id,
      },
    }

    // Use batch processor for efficient sending
    const processor = new BatchNotificationProcessor<typeof subscriptions[0]>({
      batchSize: 50, // Send 50 at a time
      delayBetweenBatches: 1000, // 1 second between batches
    })

    const result = await processor.process(
      subscriptions,
      async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            JSON.stringify(payloadWithId)
          )
          return true // Success
        } catch (error: unknown) {
          console.error('Error sending to subscription:', error)

          const webPushError = error as { statusCode?: number }
          if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
            await supabase
              .from('push_subscriptions')
              .update({ is_active: false })
              .eq('id', sub.id)
          }

          return false // Failed
        }
      }
    )

    const { successful: sent, failed } = result

    // Update log status if all failed
    if (sent === 0 && failed > 0) {
      await supabase
        .from('notifications_log')
        .update({ status: 'failed' })
        .eq('id', logEntry.id)
    }

    return { success: true, data: { sent, failed, total: subscriptions.length } }
  } catch (error) {
    console.error('Unexpected error sending broadcast:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// =============================================================================
// ADMIN HELPERS
// =============================================================================

export async function getNotificationStats(): Promise<ActionResult<{
  totalSubscriptions: number
  activeSubscriptions: number
  usersWithPushEnabled: number
  recentNotifications: number
}>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'moderator')) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get stats
    const [
      { count: totalSubscriptions },
      { count: activeSubscriptions },
      { count: usersWithPushEnabled },
      { count: recentNotifications },
    ] = await Promise.all([
      supabase.from('push_subscriptions').select('*', { count: 'exact', head: true }),
      supabase.from('push_subscriptions').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('notification_settings').select('*', { count: 'exact', head: true }).eq('push_enabled', true),
      supabase.from('notifications_log').select('*', { count: 'exact', head: true }).gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ])

    return {
      success: true,
      data: {
        totalSubscriptions: totalSubscriptions || 0,
        activeSubscriptions: activeSubscriptions || 0,
        usersWithPushEnabled: usersWithPushEnabled || 0,
        recentNotifications: recentNotifications || 0,
      },
    }
  } catch (error) {
    console.error('Unexpected error fetching stats:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function getUsersWithSubscriptions(): Promise<ActionResult<Array<{
  user_id: string
  name: string | null
  email: string | null
  subscription_count: number
}>>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'moderator')) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get all active subscriptions grouped by user
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('user_id')
      .eq('is_active', true)

    if (subError) {
      console.error('Error fetching subscriptions:', subError)
      return { success: false, error: 'Failed to fetch subscriptions' }
    }

    // Count subscriptions per user
    const userSubCounts = (subscriptions || []).reduce((acc, sub) => {
      acc[sub.user_id] = (acc[sub.user_id] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const userIds = Object.keys(userSubCounts)
    if (userIds.length === 0) {
      return { success: true, data: [] }
    }

    // Get profile info for users with subscriptions
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, name, email')
      .in('user_id', userIds)

    if (profileError) {
      console.error('Error fetching profiles:', profileError)
      return { success: false, error: 'Failed to fetch profiles' }
    }

    const users = (profiles || []).map(p => ({
      user_id: p.user_id,
      name: p.name,
      email: p.email,
      subscription_count: userSubCounts[p.user_id] || 0,
    }))

    return { success: true, data: users }
  } catch (error) {
    console.error('Unexpected error fetching users:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function getRecentNotifications(limit = 10): Promise<ActionResult<Array<{
  id: string
  title: string
  body: string
  is_broadcast: boolean
  status: string
  sent_at: string
  user_id: string
}>>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'moderator')) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data, error } = await supabase
      .from('notifications_log')
      .select('id, title, body, is_broadcast, status, sent_at, user_id')
      .order('sent_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching notifications:', error)
      return { success: false, error: 'Failed to fetch notifications' }
    }

    return { success: true, data: data || [] }
  } catch (error) {
    console.error('Unexpected error fetching notifications:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// =============================================================================
// ACHIEVEMENT NOTIFICATIONS
// =============================================================================

/**
 * Send an achievement notification to a user
 * Used for real-time milestone celebrations (streaks, targets, etc.)
 */
export async function sendAchievementNotification(
  userId: string,
  achievement: {
    title: string
    message: string
    emoji: string
    metadata?: Record<string, any>
  }
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Check if user has achievement notifications enabled
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('push_enabled, goal_achievements, quiet_hours_start, quiet_hours_end')
      .eq('user_id', userId)
      .single()

    if (!settings?.push_enabled || !settings?.goal_achievements) {
      console.log('Achievement notifications disabled for user:', userId)
      return { success: true } // Not an error, just skipped
    }

    // Check quiet hours
    if (isInQuietHours(settings.quiet_hours_start, settings.quiet_hours_end)) {
      console.log('User in quiet hours, skipping achievement notification')
      return { success: true }
    }

    // Get user's active subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No active subscriptions for user:', userId)
      return { success: true }
    }

    // Prepare notification payload
    const payload: PushNotificationPayload = {
      title: `${achievement.emoji} ${achievement.title}`,
      body: achievement.message,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      url: '/dashboard',
      data: {
        type: 'achievement',
        ...achievement.metadata,
      },
    }

    // Send to all devices
    let sentCount = 0
    let failedCount = 0

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payload)
        )
        sentCount++
      } catch (error: any) {
        console.error('Failed to send achievement notification:', error)
        failedCount++

        // If subscription is invalid, deactivate it
        if (error.statusCode === 410 || error.statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('endpoint', sub.endpoint)
        }
      }
    }

    // Log the notification
    await supabase
      .from('notifications_log')
      .insert({
        user_id: userId,
        title: payload.title,
        body: payload.body,
        icon: payload.icon,
        url: payload.url,
        notification_type: 'achievement',
        is_broadcast: false,
        status: sentCount > 0 ? 'sent' : 'failed',
        error_message: failedCount > 0 ? `Failed to send to ${failedCount} device(s)` : null,
      })

    console.log(`Achievement notification sent to ${sentCount}/${subscriptions.length} devices`)

    return { success: true }
  } catch (error) {
    console.error('Unexpected error sending achievement notification:', error)
    return { success: false, error: 'Failed to send achievement notification' }
  }
}

// =============================================================================
// PLAN UPDATE NOTIFICATIONS
// =============================================================================

/**
 * Send notification when admin assigns or updates a user's meal plan
 */
export async function sendPlanUpdateNotification(
  userId: string,
  planDate: string,
  isNewAssignment = false
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Check if user has plan update notifications enabled
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('push_enabled, plan_updates, quiet_hours_start, quiet_hours_end')
      .eq('user_id', userId)
      .single()

    if (!settings?.push_enabled || !settings?.plan_updates) {
      console.log('Plan update notifications disabled for user:', userId)
      return { success: true }
    }

    // Check quiet hours
    if (isInQuietHours(settings.quiet_hours_start, settings.quiet_hours_end)) {
      console.log('User in quiet hours, skipping plan update notification')
      return { success: true }
    }

    // Get user's active subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No active subscriptions for user:', userId)
      return { success: true }
    }

    // Format the date nicely
    const date = new Date(planDate)
    const dateStr = date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    })

    // Prepare notification payload
    const title = isNewAssignment 
      ? '🎉 New Meal Plan Assigned!' 
      : '📝 Meal Plan Updated'
    
    const body = isNewAssignment
      ? `Your personalized meal plan for ${dateStr} is ready!`
      : `Your meal plan for ${dateStr} has been updated.`

    const payload: PushNotificationPayload = {
      title,
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      url: '/plans',
      data: {
        type: 'plan_update',
        plan_date: planDate,
        is_new: isNewAssignment,
      },
    }

    // Send to all devices
    let sentCount = 0
    let failedCount = 0

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payload)
        )
        sentCount++
      } catch (error: any) {
        console.error('Failed to send plan update notification:', error)
        failedCount++

        // If subscription is invalid, deactivate it
        if (error.statusCode === 410 || error.statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('endpoint', sub.endpoint)
        }
      }
    }

    // Log the notification
    await supabase
      .from('notifications_log')
      .insert({
        user_id: userId,
        title: payload.title,
        body: payload.body,
        icon: payload.icon,
        url: payload.url,
        notification_type: 'plan_update',
        is_broadcast: false,
        status: sentCount > 0 ? 'sent' : 'failed',
        error_message: failedCount > 0 ? `Failed to send to ${failedCount} device(s)` : null,
      })

    console.log(`Plan update notification sent to ${sentCount}/${subscriptions.length} devices`)

    return { success: true }
  } catch (error) {
    console.error('Unexpected error sending plan update notification:', error)
    return { success: false, error: 'Failed to send plan update notification' }
  }
}
