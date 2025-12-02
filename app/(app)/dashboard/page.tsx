import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardContent } from './dashboard-content'
import { format, startOfWeek, endOfWeek, subDays } from 'date-fns'
import type { DailyPlan, DailyTotals, RecipeRecord } from '@/lib/types/nutri'

export const metadata: Metadata = {
  title: 'Dashboard | Waddy Diet Master',
  description: 'Your daily nutrition overview',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  
  // Fetch today's log
  const { data: dailyLog } = await supabase
    .from('daily_logs')
    .select('log, logged_totals')
    .eq('user_id', user.id)
    .eq('log_date', todayStr)
    .single()
  
  // Fetch today's plan
  const { data: dailyPlan } = await supabase
    .from('daily_plans')
    .select('plan, daily_totals')
    .eq('user_id', user.id)
    .eq('plan_date', todayStr)
    .single()
  
  // Fetch week logs for the week selector
  const weekStart = startOfWeek(today, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 })
  
  const { data: weekLogs } = await supabase
    .from('daily_logs')
    .select('log_date, logged_totals')
    .eq('user_id', user.id)
    .gte('log_date', format(weekStart, 'yyyy-MM-dd'))
    .lte('log_date', format(weekEnd, 'yyyy-MM-dd'))
  
  const weekData: Record<string, { consumed: number }> = {}
  if (weekLogs) {
    for (const log of weekLogs) {
      const totals = log.logged_totals as DailyTotals
      weekData[log.log_date] = { consumed: totals.calories || 0 }
    }
  }
  
  // Calculate streak (consecutive days of logging)
  let streak = 0
  let checkDate = subDays(today, 1) // Start from yesterday
  
  // First check if today has logs
  if (dailyLog?.log) {
    streak = 1
  }
  
  // Then check backwards
  for (let i = 0; i < 30; i++) { // Check up to 30 days back
    const { data: logData } = await supabase
      .from('daily_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('log_date', format(checkDate, 'yyyy-MM-dd'))
      .single()
    
    if (logData) {
      streak++
      checkDate = subDays(checkDate, 1)
    } else {
      break
    }
  }
  
  // Fetch recipes for today's plan
  const mealRecipes: Record<string, RecipeRecord | null> = {
    breakfast: null,
    lunch: null,
    dinner: null,
    snacks: null,
  }
  
  if (dailyPlan?.plan) {
    const plan = dailyPlan.plan as DailyPlan
    const recipeIds = [
      plan.breakfast?.recipe_id,
      plan.lunch?.recipe_id,
      plan.dinner?.recipe_id,
    ].filter(Boolean) as string[]
    
    if (recipeIds.length > 0) {
      const { data: recipes } = await supabase
        .from('recipes')
        .select('*')
        .in('id', recipeIds)
      
      if (recipes) {
        for (const recipe of recipes) {
          if (plan.breakfast?.recipe_id === recipe.id) mealRecipes.breakfast = recipe
          if (plan.lunch?.recipe_id === recipe.id) mealRecipes.lunch = recipe
          if (plan.dinner?.recipe_id === recipe.id) mealRecipes.dinner = recipe
        }
      }
    }
  }

  return (
    <DashboardContent 
      profile={profile}
      initialDailyLog={dailyLog}
      initialDailyPlan={dailyPlan}
      initialWeekLogs={weekData}
      initialStreak={streak}
      initialMealRecipes={mealRecipes}
    />
  )
}