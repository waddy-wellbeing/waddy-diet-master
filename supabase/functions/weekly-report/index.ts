// Supabase Edge Function: Weekly Report
// Runs every Sunday at 7 PM to send weekly progress summary to users
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

interface WeeklyData {
  totalDays: number
  daysLogged: number
  avgCalories: number
  avgProtein: number
  totalMealsLogged: number
  avgMealsPerDay: number
  streak: number
}

interface UserTargets {
  daily_calories?: number
  daily_protein_g?: number
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
 * Calculate weekly statistics from daily logs
 */
function calculateWeeklyStats(logs: any[]): WeeklyData {
  const totalDays = 7
  const daysLogged = logs.filter(l => (l.meals_logged || 0) > 0).length
  
  let totalCalories = 0
  let totalProtein = 0
  let totalMeals = 0
  
  for (const log of logs) {
    const totals = log.logged_totals as DailyTotals
    totalCalories += totals.calories || 0
    totalProtein += totals.protein_g || 0
    totalMeals += log.meals_logged || 0
  }
  
  const avgCalories = daysLogged > 0 ? Math.round(totalCalories / daysLogged) : 0
  const avgProtein = daysLogged > 0 ? Math.round(totalProtein / daysLogged) : 0
  const avgMealsPerDay = daysLogged > 0 ? Math.round((totalMeals / daysLogged) * 10) / 10 : 0
  
  // Calculate current streak (consecutive days logged)
  let streak = 0
  for (let i = logs.length - 1; i >= 0; i--) {
    if ((logs[i].meals_logged || 0) > 0) {
      streak++
    } else {
      break
    }
  }
  
  return {
    totalDays,
    daysLogged,
    avgCalories,
    avgProtein,
    totalMealsLogged: totalMeals,
    avgMealsPerDay,
    streak,
  }
}

/**
 * Generate achievement emoji based on performance
 */
function getWeeklyEmoji(weeklyData: WeeklyData, targets: UserTargets): string {
  const consistency = weeklyData.daysLogged / weeklyData.totalDays
  
  // Perfect week (7/7 days logged)
  if (weeklyData.daysLogged === 7) {
    return '🔥'
  }
  
  // Great week (5-6 days)
  if (weeklyData.daysLogged >= 5) {
    return '⭐'
  }
  
  // Good week (3-4 days)
  if (weeklyData.daysLogged >= 3) {
    return '📈'
  }
  
  // Needs improvement (1-2 days)
  if (weeklyData.daysLogged >= 1) {
    return '💪'
  }
  
  // No logging
  return '📊'
}

/**
 * Generate weekly summary message
 */
function generateWeeklySummary(
  weeklyData: WeeklyData,
  targets: UserTargets
): string {
  const { daysLogged, avgCalories, avgProtein, streak } = weeklyData
  const targetCals = targets.daily_calories || 0
  
  const parts: string[] = []
  
  // Streak achievement (most important)
  if (streak >= 7) {
    parts.push(`${streak}-day streak! 🔥`)
  } else if (streak >= 3) {
    parts.push(`${streak}-day streak`)
  }
  
  // Consistency
  if (daysLogged > 0) {
    parts.push(`${daysLogged}/7 days logged`)
  }
  
  // Calories & target progress
  if (avgCalories > 0 && targetCals > 0) {
    const percentage = Math.round((avgCalories / targetCals) * 100)
    parts.push(`${percentage}% on track`)
  } else if (avgCalories > 0) {
    parts.push(`${avgCalories} avg cal`)
  }
  
  // Protein
  if (avgProtein > 0) {
    parts.push(`${avgProtein}g protein`)
  }
  
  return parts.join(' • ') || 'Start tracking to see your progress!'
}

/**
 * Get motivational message based on performance
 */
function getMotivationalMessage(weeklyData: WeeklyData): string {
  const { daysLogged, streak } = weeklyData
  
  if (streak >= 7) {
    return "You're crushing it! Keep the momentum going! 💪"
  }
  
  if (daysLogged === 7) {
    return "Perfect week! You're building amazing habits! 🎯"
  }
  
  if (daysLogged >= 5) {
    return "Great consistency! You're so close to a perfect week! ⭐"
  }
  
  if (daysLogged >= 3) {
    return "Solid progress! Aim for more days next week! 📈"
  }
  
  if (daysLogged >= 1) {
    return "Good start! Try to log daily for best results! 💪"
  }
  
  return "Ready for a fresh start this week? Let's go! 🚀"
}

/**
 * Send weekly report to a user
 */
async function sendWeeklyReport(
  subscription: any,
  weeklyData: WeeklyData,
  targets: UserTargets,
  notificationId?: string
): Promise<boolean> {
  try {
    const emoji = getWeeklyEmoji(weeklyData, targets)
    const summary = generateWeeklySummary(weeklyData, targets)
    const motivation = getMotivationalMessage(weeklyData)
    
    const payload = {
      title: `${emoji} Your Week in Review`,
      body: summary,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      url: '/nutrition',
      data: {
        notificationId,
        type: 'weekly_report',
        motivation,
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

    console.log('📈 Weekly report function started')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Calculate date range for past 7 days
    const today = new Date()
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const todayStr = today.toISOString().split('T')[0]
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

    // Get users who:
    // 1. Have weekly_report enabled
    // 2. Have push_enabled
    // 3. Are not in quiet hours
    const { data: settingsData, error: settingsError } = await supabase
      .from('notification_settings')
      .select('user_id, quiet_hours_start, quiet_hours_end')
      .eq('push_enabled', true)
      .eq('weekly_report', true)

    if (settingsError) {
      console.error('Error fetching settings:', settingsError)
      throw settingsError
    }

    if (!settingsData || settingsData.length === 0) {
      console.log('No users have weekly report enabled')
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

    // Get daily logs for the past 7 days for these users
    const { data: logsData, error: logsError } = await supabase
      .from('daily_logs')
      .select('user_id, log_date, logged_totals, meals_logged')
      .gte('log_date', sevenDaysAgoStr)
      .lte('log_date', todayStr)
      .in('user_id', activeUserIds)
      .order('log_date', { ascending: true })

    if (logsError) {
      console.error('Error fetching logs:', logsError)
      throw logsError
    }

    // Group logs by user
    const logsByUser = new Map<string, any[]>()
    for (const log of logsData || []) {
      if (!logsByUser.has(log.user_id)) {
        logsByUser.set(log.user_id, [])
      }
      logsByUser.get(log.user_id)!.push(log)
    }

    // Filter users who have logged at least once this week
    const usersWithLogs = activeUserIds.filter(
      (userId) => {
        const logs = logsByUser.get(userId) || []
        return logs.some(l => (l.meals_logged || 0) > 0)
      }
    )

    if (usersWithLogs.length === 0) {
      console.log('No users logged food this week')
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No users logged this week' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get user targets from profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, targets')
      .in('user_id', usersWithLogs)

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
      .in('user_id', usersWithLogs)

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

    // Send notifications
    let sent = 0
    let failed = 0

    for (const sub of subscriptions) {
      const logs = logsByUser.get(sub.user_id) || []
      
      // Fill in missing days with empty logs for accurate streak calculation
      const allDays: any[] = []
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(sevenDaysAgo)
        checkDate.setDate(checkDate.getDate() + i)
        const dateStr = checkDate.toISOString().split('T')[0]
        
        const existingLog = logs.find(l => l.log_date === dateStr)
        allDays.push(existingLog || {
          log_date: dateStr,
          meals_logged: 0,
          logged_totals: {},
        })
      }
      
      const weeklyData = calculateWeeklyStats(allDays)
      const targets = targetsMap.get(sub.user_id) || {}
      
      const summary = generateWeeklySummary(weeklyData, targets)
      const emoji = getWeeklyEmoji(weeklyData, targets)
      
      // Log notification first
      const { data: logEntry } = await supabase
        .from('notifications_log')
        .insert({
          user_id: sub.user_id,
          title: `${emoji} Your Week in Review`,
          body: summary,
          icon: '/icons/icon-192x192.png',
          url: '/nutrition',
          notification_type: 'weekly_report',
          is_broadcast: false,
          status: 'sent',
        })
        .select('id')
        .single()

      const success = await sendWeeklyReport(
        sub,
        weeklyData,
        targets,
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

    console.log(`Weekly reports sent: ${sent}, failed: ${failed}`)

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
    console.error('Weekly report error:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
