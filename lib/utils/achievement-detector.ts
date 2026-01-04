/**
 * Achievement Detection Utility
 * 
 * Detects user achievements based on their logging activity and nutrition goals.
 * Used to trigger real-time achievement notifications.
 */

import { createClient } from '@/lib/supabase/server'
import type { DailyTotals } from '@/lib/types/nutri'

export interface AchievementResult {
  type: 'streak' | 'first_week' | 'target_hit' | 'consistency'
  title: string
  message: string
  emoji: string
  metadata?: Record<string, any>
}

/**
 * Check all possible achievements for a user after logging a meal
 * Returns achievements that should trigger notifications
 */
export async function detectAchievements(
  userId: string,
  logDate: string
): Promise<AchievementResult[]> {
  const achievements: AchievementResult[] = []
  
  // Check streak achievements
  const streakAchievement = await checkStreakAchievement(userId, logDate)
  if (streakAchievement) {
    achievements.push(streakAchievement)
  }
  
  // Check first week achievement
  const firstWeekAchievement = await checkFirstWeekAchievement(userId, logDate)
  if (firstWeekAchievement) {
    achievements.push(firstWeekAchievement)
  }
  
  // Check daily target achievement
  const targetAchievement = await checkDailyTargetAchievement(userId, logDate)
  if (targetAchievement) {
    achievements.push(targetAchievement)
  }
  
  return achievements
}

/**
 * Check if user just achieved a streak milestone (3, 7, 14, 30 days)
 */
async function checkStreakAchievement(
  userId: string,
  logDate: string
): Promise<AchievementResult | null> {
  const supabase = await createClient()
  
  // Get all logs for the past 30 days to calculate streak
  const thirtyDaysAgo = new Date(logDate)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const { data: logs } = await supabase
    .from('daily_logs')
    .select('log_date, meals_logged')
    .eq('user_id', userId)
    .gte('log_date', thirtyDaysAgo.toISOString().split('T')[0])
    .lte('log_date', logDate)
    .order('log_date', { ascending: false })
  
  if (!logs || logs.length === 0) {
    return null
  }
  
  // Calculate current streak (consecutive days from today backwards)
  let streak = 0
  const today = new Date(logDate)
  
  for (let i = 0; i < logs.length; i++) {
    const expectedDate = new Date(today)
    expectedDate.setDate(today.getDate() - i)
    const expectedDateStr = expectedDate.toISOString().split('T')[0]
    
    const log = logs.find(l => l.log_date === expectedDateStr)
    if (log && log.meals_logged > 0) {
      streak++
    } else {
      break // Streak broken
    }
  }
  
  // Check if just hit a milestone AND haven't notified before
  const milestones = [
    { days: 3, emoji: '🌟', title: '3-Day Streak!', message: 'You\'re on fire! Keep going!' },
    { days: 7, emoji: '🔥', title: '7-Day Streak!', message: 'A whole week of consistency! Amazing!' },
    { days: 14, emoji: '💪', title: '2-Week Streak!', message: 'Two weeks strong! You\'re unstoppable!' },
    { days: 30, emoji: '🏆', title: '30-Day Streak!', message: 'One month of dedication! You\'re a champion!' },
  ]
  
  for (const milestone of milestones) {
    if (streak === milestone.days) {
      // Check if we already sent this achievement
      const alreadySent = await hasAchievementBeenSent(
        userId,
        'streak',
        milestone.days
      )
      
      if (!alreadySent) {
        return {
          type: 'streak',
          title: milestone.title,
          message: milestone.message,
          emoji: milestone.emoji,
          metadata: { streak_days: milestone.days },
        }
      }
    }
  }
  
  return null
}

/**
 * Check if user completed their first week (7 days of logging, not necessarily consecutive)
 */
async function checkFirstWeekAchievement(
  userId: string,
  logDate: string
): Promise<AchievementResult | null> {
  const supabase = await createClient()
  
  // Count total days logged ever
  const { count } = await supabase
    .from('daily_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gt('meals_logged', 0)
  
  // If exactly 7 days, it's their first week!
  if (count === 7) {
    const alreadySent = await hasAchievementBeenSent(userId, 'first_week', 7)
    
    if (!alreadySent) {
      return {
        type: 'first_week',
        title: 'First Week Complete! 🎉',
        message: 'You\'ve logged 7 days of meals! You\'re building great habits!',
        emoji: '🎉',
        metadata: { total_days: 7 },
      }
    }
  }
  
  return null
}

/**
 * Check if user hit their daily nutrition targets (calories ±10%, protein ≥target)
 */
async function checkDailyTargetAchievement(
  userId: string,
  logDate: string
): Promise<AchievementResult | null> {
  const supabase = await createClient()
  
  // Get today's log and totals
  const { data: log } = await supabase
    .from('daily_logs')
    .select('logged_totals, meals_logged')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .single()
  
  if (!log || log.meals_logged < 3) {
    // Only award target achievement if at least 3 meals logged
    return null
  }
  
  // Get user's targets
  const { data: profile } = await supabase
    .from('profiles')
    .select('targets')
    .eq('user_id', userId)
    .single()
  
  if (!profile?.targets) {
    return null
  }
  
  const targets = profile.targets as { calories?: number; protein?: number }
  const totals = log.logged_totals as DailyTotals
  
  if (!targets.calories || !targets.protein || !totals.calories || !totals.protein_g) {
    return null
  }
  
  // Check if within ±10% of calorie target and met protein target
  const caloriesDiff = Math.abs(totals.calories - targets.calories)
  const caloriesWithinRange = caloriesDiff <= targets.calories * 0.1
  const proteinMet = totals.protein_g >= targets.protein
  
  if (caloriesWithinRange && proteinMet) {
    // Check if already sent today (only one per day)
    const alreadySent = await hasAchievementBeenSent(
      userId,
      'target_hit',
      undefined,
      logDate
    )
    
    if (!alreadySent) {
      return {
        type: 'target_hit',
        title: 'Daily Target Achieved! 🎯',
        message: `Perfect day! You hit ${Math.round(totals.calories)} cal and ${Math.round(totals.protein_g)}g protein!`,
        emoji: '🎯',
        metadata: {
          calories: Math.round(totals.calories),
          protein: Math.round(totals.protein_g),
        },
      }
    }
  }
  
  return null
}

/**
 * Check if an achievement notification has already been sent
 * Uses notifications_log to prevent duplicates
 */
async function hasAchievementBeenSent(
  userId: string,
  achievementType: string,
  milestoneValue?: number,
  date?: string
): Promise<boolean> {
  const supabase = await createClient()
  
  // Build the query
  let query = supabase
    .from('notifications_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('notification_type', 'achievement')
  
  // For streaks and first_week, check by milestone value in title
  if (milestoneValue) {
    const titlePattern = `%${milestoneValue}%`
    query = query.ilike('title', titlePattern)
  }
  
  // For daily targets, only check today's date
  if (date) {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)
    
    query = query
      .gte('sent_at', startOfDay.toISOString())
      .lte('sent_at', endOfDay.toISOString())
  }
  
  const { count } = await query
  
  return (count ?? 0) > 0
}

/**
 * Helper to check if user is in their first week (useful for extra encouragement)
 */
export async function isUserInFirstWeek(userId: string): Promise<boolean> {
  const supabase = await createClient()
  
  const { count } = await supabase
    .from('daily_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gt('meals_logged', 0)
  
  return (count ?? 0) <= 7
}
