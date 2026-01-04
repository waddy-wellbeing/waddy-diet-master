/**
 * Daily Logs Server Actions
 * Handles achievement detection after meal logging
 */

'use server'

import { detectAchievements } from '@/lib/utils/achievement-detector'
import { sendAchievementNotification } from './notifications'

/**
 * Check for achievements after a meal is logged
 * This should be called after updating daily_logs table
 */
export async function checkAndNotifyAchievements(
  userId: string,
  logDate: string
): Promise<{ success: true; achievements?: number } | { success: false; error: string }> {
  try {
    // Detect all achievements for this user/date
    const achievements = await detectAchievements(userId, logDate)

    console.log(`Found ${achievements.length} achievement(s) for user ${userId} on ${logDate}`)

    // Send notification for each achievement
    for (const achievement of achievements) {
      await sendAchievementNotification(userId, achievement)
    }

    return { 
      success: true, 
      achievements: achievements.length 
    }
  } catch (error) {
    console.error('Error checking achievements:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
