/**
 * Meal Planning Utilities
 * 
 * Helper functions for calendar indicators, date validation, and plan state management
 */

import { format, isAfter, isBefore, isToday, startOfDay, addDays } from 'date-fns'
import type { DailyPlan, DailyLog } from '@/lib/types/nutri'

/** Visual states for calendar day indicators */
export type DayPlanState = 'none' | 'planned' | 'logged' | 'both'

/** Maximum days ahead that can be planned */
export const MAX_PLAN_DAYS_AHEAD = 14

/**
 * Determine the visual state of a calendar day based on plan and log data
 */
export function getDayPlanState(
  date: Date,
  plans: Record<string, DailyPlan>,
  logs: Record<string, DailyLog>
): DayPlanState {
  const dateKey = format(date, 'yyyy-MM-dd')
  const hasPlan = !!plans[dateKey] && hasPlanContent(plans[dateKey])
  const hasLog = !!logs[dateKey] && hasLogContent(logs[dateKey])

  if (hasPlan && hasLog) return 'both'
  if (hasLog) return 'logged'
  if (hasPlan) return 'planned'
  return 'none'
}

/**
 * Check if a plan has any meal content
 */
function hasPlanContent(plan: DailyPlan): boolean {
  return !!(
    plan.breakfast?.recipe_id ||
    plan.lunch?.recipe_id ||
    plan.dinner?.recipe_id ||
    (plan.snacks && plan.snacks.length > 0 && plan.snacks[0]?.recipe_id)
  )
}

/**
 * Check if a log has any meal content
 */
function hasLogContent(log: DailyLog): boolean {
  return !!(
    (log.breakfast?.items && log.breakfast.items.length > 0) ||
    (log.lunch?.items && log.lunch.items.length > 0) ||
    (log.dinner?.items && log.dinner.items.length > 0) ||
    (log.snacks?.items && log.snacks.items.length > 0)
  )
}

/**
 * Check if a date can be planned (today or future, within max range)
 */
export function canPlanDate(date: Date): boolean {
  const today = startOfDay(new Date())
  const targetDate = startOfDay(date)
  const maxDate = addDays(today, MAX_PLAN_DAYS_AHEAD)

  // Can plan: today <= date <= today + MAX_PLAN_DAYS_AHEAD
  return !isBefore(targetDate, today) && !isAfter(targetDate, maxDate)
}

/**
 * Get user-friendly error message for unplannable dates
 */
export function getDatePlanError(date: Date): string | null {
  const today = startOfDay(new Date())
  const targetDate = startOfDay(date)
  const maxDate = addDays(today, MAX_PLAN_DAYS_AHEAD)

  if (isBefore(targetDate, today)) {
    return 'Cannot plan meals for past dates'
  }

  if (isAfter(targetDate, maxDate)) {
    return `Can only plan ${MAX_PLAN_DAYS_AHEAD} days ahead`
  }

  return null
}

/**
 * Format date for plan sheet header
 * Examples: "Today", "Tomorrow", "Monday, Jan 6"
 */
export function formatPlanDateHeader(date: Date): string {
  const today = startOfDay(new Date())
  const targetDate = startOfDay(date)
  const tomorrow = addDays(today, 1)

  if (targetDate.getTime() === today.getTime()) {
    return 'Today'
  }

  if (targetDate.getTime() === tomorrow.getTime()) {
    return 'Tomorrow'
  }

  return format(date, 'EEEE, MMM d')
}

/**
 * Check if a meal type has content in a plan
 */
export function hasMealInPlan(
  plan: DailyPlan | null | undefined,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks'
): boolean {
  if (!plan) return false

  if (mealType === 'snacks') {
    return !!(plan.snacks && plan.snacks.length > 0 && plan.snacks[0]?.recipe_id)
  }

  return !!plan[mealType]?.recipe_id
}

/**
 * Count total recipes in a plan
 */
export function countPlanRecipes(plan: DailyPlan | null | undefined): number {
  if (!plan) return 0

  let count = 0
  if (plan.breakfast?.recipe_id) count++
  if (plan.lunch?.recipe_id) count++
  if (plan.dinner?.recipe_id) count++
  if (plan.snacks && plan.snacks.length > 0 && plan.snacks[0]?.recipe_id) count++

  return count
}

/**
 * Get indicator color classes based on state
 */
export function getPlanIndicatorClasses(state: DayPlanState): string {
  switch (state) {
    case 'planned':
      return 'border-2 border-blue-500' // 🔵 Blue border for future plans
    case 'logged':
      return 'bg-green-500' // 🟢 Green fill for logged meals
    case 'both':
      return 'bg-gradient-to-br from-green-500 to-blue-500' // 🟡 Gradient for both
    default:
      return ''
  }
}

/**
 * Get accessible label for indicator state
 */
export function getPlanIndicatorLabel(state: DayPlanState): string {
  switch (state) {
    case 'planned':
      return 'Meal planned'
    case 'logged':
      return 'Meal logged'
    case 'both':
      return 'Planned and logged'
    default:
      return ''
  }
}
