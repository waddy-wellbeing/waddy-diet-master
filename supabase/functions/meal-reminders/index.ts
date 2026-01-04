// Supabase Edge Function: Meal Reminders
// Runs every 15 minutes to send meal reminders to users
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

interface MealTime {
  mealType: 'breakfast' | 'lunch' | 'dinner'
  label: string
  emoji: string
  defaultTime: string // HH:MM format
  reminderMinutesBefore: number
}

// Default meal times and reminder windows
const MEAL_TIMES: MealTime[] = [
  {
    mealType: 'breakfast',
    label: 'Breakfast',
    emoji: '🥞',
    defaultTime: '08:00',
    reminderMinutesBefore: 30,
  },
  {
    mealType: 'lunch',
    label: 'Lunch',
    emoji: '🍽️',
    defaultTime: '13:00',
    reminderMinutesBefore: 30,
  },
  {
    mealType: 'dinner',
    label: 'Dinner',
    emoji: '🌙',
    defaultTime: '19:00',
    reminderMinutesBefore: 30,
  },
]

/**
 * Check if current time matches a meal reminder window
 * Returns the meal to remind about, or null if not in any window
 */
function getCurrentMealReminder(): MealTime | null {
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  for (const meal of MEAL_TIMES) {
    const [hour, minute] = meal.defaultTime.split(':').map(Number)
    const mealTimeMinutes = hour * 60 + minute
    const reminderTimeMinutes = mealTimeMinutes - meal.reminderMinutesBefore

    // Check if we're within 15-minute window of reminder time
    // (since function runs every 15 minutes)
    const diff = Math.abs(currentMinutes - reminderTimeMinutes)
    if (diff <= 15) {
      return meal
    }
  }

  return null
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
    // Overnight quiet hours (e.g., 22:00 to 08:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  } else {
    // Same-day quiet hours (e.g., 13:00 to 14:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }
}

/**
 * Send meal reminder to a user
 */
async function sendMealReminder(
  subscription: any,
  meal: MealTime,
  recipeName?: string,
  notificationId?: string
): Promise<boolean> {
  try {
    const payload = {
      title: `${meal.emoji} Time for ${meal.label}!`,
      body: recipeName
        ? `Your ${recipeName} is ready to log`
        : `Don't forget to log your ${meal.label.toLowerCase()}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      url: '/dashboard',
      data: {
        notificationId,
        meal: meal.mealType,
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

    console.log('🔔 Meal reminders function started')

    // Check if we should send reminders now
    const mealToRemind = getCurrentMealReminder()
    
    if (!mealToRemind) {
      console.log('No meal reminders needed at this time')
      return new Response(
        JSON.stringify({ success: true, message: 'No reminders needed' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Sending reminders for ${mealToRemind.label}`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const today = new Date().toISOString().split('T')[0]

    // Get users who:
    // 1. Have meal_reminders enabled
    // 2. Have push_enabled
    // 3. Are not in quiet hours
    // 4. Have a plan for today with this meal
    const { data: settingsData, error: settingsError } = await supabase
      .from('notification_settings')
      .select('user_id, quiet_hours_start, quiet_hours_end')
      .eq('push_enabled', true)
      .eq('meal_reminders', true)

    if (settingsError) {
      console.error('Error fetching settings:', settingsError)
      throw settingsError
    }

    if (!settingsData || settingsData.length === 0) {
      console.log('No users have meal reminders enabled')
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

    // Get daily plans for these users for today
    const { data: plansData, error: plansError } = await supabase
      .from('daily_plans')
      .select('user_id, plan')
      .eq('plan_date', today)
      .in('user_id', activeUserIds)

    if (plansError) {
      console.error('Error fetching plans:', plansError)
      throw plansError
    }

    // Filter users who have this specific meal in their plan
    const usersWithMeal = plansData?.filter((plan) => {
      const dailyPlan = plan.plan as any
      return dailyPlan[mealToRemind.mealType] !== undefined
    }) || []

    if (usersWithMeal.length === 0) {
      console.log(`No users have ${mealToRemind.label} in their plan today`)
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No users with this meal' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const userIdsWithMeal = usersWithMeal.map((p) => p.user_id)

    // Get active subscriptions for these users
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('is_active', true)
      .in('user_id', userIdsWithMeal)

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

    // Get recipe names for meal descriptions
    const plansWithRecipes = await Promise.all(
      usersWithMeal.map(async (plan) => {
        const dailyPlan = plan.plan as any
        const mealSlot = dailyPlan[mealToRemind.mealType]
        
        if (mealSlot?.recipe_id) {
          const { data: recipe } = await supabase
            .from('recipes')
            .select('name')
            .eq('id', mealSlot.recipe_id)
            .single()
          
          return {
            user_id: plan.user_id,
            recipe_name: recipe?.name,
          }
        }
        
        return { user_id: plan.user_id, recipe_name: undefined }
      })
    )

    const recipeMap = new Map(
      plansWithRecipes.map((p) => [p.user_id, p.recipe_name])
    )

    // Send notifications
    let sent = 0
    let failed = 0

    for (const sub of subscriptions) {
      const recipeName = recipeMap.get(sub.user_id)
      
      // Log notification first
      const { data: logEntry } = await supabase
        .from('notifications_log')
        .insert({
          user_id: sub.user_id,
          title: `${mealToRemind.emoji} Time for ${mealToRemind.label}!`,
          body: recipeName
            ? `Your ${recipeName} is ready to log`
            : `Don't forget to log your ${mealToRemind.label.toLowerCase()}`,
          icon: '/icons/icon-192x192.png',
          url: '/dashboard',
          notification_type: 'meal_reminder',
          is_broadcast: false,
          status: 'sent',
        })
        .select('id')
        .single()

      const success = await sendMealReminder(
        sub,
        mealToRemind,
        recipeName,
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

    console.log(`Meal reminders sent: ${sent}, failed: ${failed}`)

    return new Response(
      JSON.stringify({
        success: true,
        meal: mealToRemind.label,
        sent,
        failed,
        total: subscriptions.length,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Meal reminders error:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
