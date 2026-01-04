// Supabase Edge Function: Daily Summary
// Runs once daily at 8 PM to send nutrition summary to users
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.6'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@waddyclub.com'

// Configure web-push
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

interface DailyTotals {
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
}

interface UserTargets {
  daily_calories?: number
  daily_protein_g?: number
  daily_carbs_g?: number
  daily_fat_g?: number
}

/**
 * Check if user is in quiet hours
 */
function isInQuietHours(
  quietStart?: string,
  quietEnd?: string
): boolean {
  if (!quietStart || !quietEnd) return false

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const [startHour, startMin] = quietStart.split(':').map(Number)
  const [endHour, endMin] = quietEnd.split(':').map(Number)
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  } else {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }
}

/**
 * Generate summary message body
 */
function generateSummaryMessage(
  totals: DailyTotals,
  targets: UserTargets,
  mealsLogged: number
): string {
  const cals = Math.round(totals.calories || 0)
  const protein = Math.round(totals.protein_g || 0)
  const targetCals = Math.round(targets.daily_calories || 0)
  
  const parts: string[] = []
  
  // Calories
  if (cals > 0) {
    parts.push(`${cals} cal`)
    if (targetCals > 0) {
      const percentage = Math.round((cals / targetCals) * 100)
      parts.push(`(${percentage}% of goal)`)
    }
  }
  
  // Protein
  if (protein > 0) {
    parts.push(`${protein}g protein`)
  }
  
  // Meals logged
  if (mealsLogged > 0) {
    parts.push(`${mealsLogged} ${mealsLogged === 1 ? 'meal' : 'meals'} logged`)
  }
  
  return parts.join(' • ') || 'No meals logged today'
}

/**
 * Get achievement badge based on performance
 */
function getAchievementEmoji(
  totals: DailyTotals,
  targets: UserTargets,
  mealsLogged: number
): string {
  const targetCals = targets.daily_calories || 0
  const actualCals = totals.calories || 0
  
  if (mealsLogged === 0) return '📝'
  if (mealsLogged >= 3) {
    // Check if within target range (±10%)
    if (targetCals > 0) {
      const percentage = (actualCals / targetCals) * 100
      if (percentage >= 90 && percentage <= 110) {
        return '🎯' // Perfect day!
      }
    }
    return '⭐' // Great job logging all meals
  }
  return '📊' // Standard summary
}

/**
 * Send daily summary to a user
 */
async function sendDailySummary(
  subscription: any,
  totals: DailyTotals,
  targets: UserTargets,
  mealsLogged: number,
  notificationId?: string
): Promise<boolean> {
  try {
    const emoji = getAchievementEmoji(totals, targets, mealsLogged)
    const body = generateSummaryMessage(totals, targets, mealsLogged)
    
    const payload = {
      title: `${emoji} Your Day in Review`,
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      url: '/nutrition',
      data: {
        notificationId,
        type: 'daily_summary',
      },
    }

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload)
    )

    return true
  } catch (error) {
    console.error('Error sending notification:', error)
    
    // Mark subscription as inactive if it's no longer valid
    const webPushError = error as { statusCode?: number }
    if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('id', subscription.id)
    }

    return false
  }
}

serve(async (req) => {
  try {
    // Only allow POST requests (for cron triggers)
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    console.log('📊 Daily summary function started')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const today = new Date().toISOString().split('T')[0]

    // Get users who:
    // 1. Have daily_summary enabled
    // 2. Have push_enabled
    // 3. Are not in quiet hours
    const { data: settingsData, error: settingsError } = await supabase
      .from('notification_settings')
      .select('user_id, quiet_hours_start, quiet_hours_end')
      .eq('push_enabled', true)
      .eq('daily_summary', true)

    if (settingsError) {
      console.error('Error fetching settings:', settingsError)
      throw settingsError
    }

    if (!settingsData || settingsData.length === 0) {
      console.log('No users have daily summary enabled')
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No eligible users' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Filter out users in quiet hours
    const activeUsers = settingsData.filter(
      (user) => !isInQuietHours(user.quiet_hours_start, user.quiet_hours_end)
    )

    if (activeUsers.length === 0) {
      console.log('All users are in quiet hours')
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'All users in quiet hours' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const activeUserIds = activeUsers.map((u) => u.user_id)

    // Get daily logs for these users for today
    const { data: logsData, error: logsError } = await supabase
      .from('daily_logs')
      .select('user_id, logged_totals, meals_logged')
      .eq('log_date', today)
      .in('user_id', activeUserIds)

    if (logsError) {
      console.error('Error fetching logs:', logsError)
      throw logsError
    }

    // Filter users who actually logged food today
    const usersWithLogs = logsData?.filter((log) => {
      return (log.meals_logged || 0) > 0
    }) || []

    if (usersWithLogs.length === 0) {
      console.log('No users logged food today')
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No users logged food' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const userIdsWithLogs = usersWithLogs.map((l) => l.user_id)

    // Get user targets from profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, targets')
      .in('user_id', userIdsWithLogs)

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      throw profilesError
    }

    const targetsMap = new Map(
      profilesData?.map((p) => [p.user_id, p.targets as UserTargets]) || []
    )

    // Get active subscriptions for these users
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('is_active', true)
      .in('user_id', userIdsWithLogs)

    if (subError) {
      console.error('Error fetching subscriptions:', subError)
      throw subError
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No active subscriptions for eligible users')
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No active subscriptions' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create a map of user data
    const logsMap = new Map(
      usersWithLogs.map((l) => [
        l.user_id,
        {
          totals: l.logged_totals as DailyTotals,
          mealsLogged: l.meals_logged || 0,
        },
      ])
    )

    // Send notifications
    let sent = 0
    let failed = 0

    for (const sub of subscriptions) {
      const logData = logsMap.get(sub.user_id)
      const targets = targetsMap.get(sub.user_id) || {}
      
      if (!logData) continue
      
      const body = generateSummaryMessage(
        logData.totals,
        targets,
        logData.mealsLogged
      )
      const emoji = getAchievementEmoji(
        logData.totals,
        targets,
        logData.mealsLogged
      )
      
      // Log notification first
      const { data: logEntry } = await supabase
        .from('notifications_log')
        .insert({
          user_id: sub.user_id,
          title: `${emoji} Your Day in Review`,
          body,
          icon: '/icons/icon-192x192.png',
          url: '/nutrition',
          notification_type: 'daily_summary',
          is_broadcast: false,
          status: 'sent',
        })
        .select('id')
        .single()

      const success = await sendDailySummary(
        sub,
        logData.totals,
        targets,
        logData.mealsLogged,
        logEntry?.id
      )

      if (success) {
        sent++
      } else {
        failed++
        // Update log status
        if (logEntry?.id) {
          await supabase
            .from('notifications_log')
            .update({ status: 'failed' })
            .eq('id', logEntry.id)
        }
      }
    }

    console.log(`Daily summaries sent: ${sent}, failed: ${failed}`)

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        total: subscriptions.length,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Daily summary error:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
