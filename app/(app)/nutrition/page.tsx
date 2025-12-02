import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NutritionContent } from './nutrition-content'
import { format, subDays } from 'date-fns'
import type { DailyTotals } from '@/lib/types/nutri'

export const metadata: Metadata = {
  title: 'Nutrition | Waddy Diet Master',
  description: 'Track your nutrition progress and insights',
}

export interface DayLog {
  date: string
  calories: number
  protein: number
  carbs: number
  fat: number
  mealsLogged: number
  adherenceScore: number | null
}

export interface NutritionStats {
  // Targets
  targets: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  // Today's data
  today: DayLog
  // Weekly data (last 7 days)
  weeklyLogs: DayLog[]
  weeklyAverages: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  // Monthly trends
  monthlyLogs: DayLog[]
  // Streaks and achievements
  currentStreak: number
  longestStreak: number
  totalDaysLogged: number
  perfectDays: number // Days within ±5% of calorie target
}

export default async function NutritionPage() {
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
  
  // Get targets from profile
  const targets = {
    calories: profile.targets?.daily_calories || 2000,
    protein: profile.targets?.protein_g || 150,
    carbs: profile.targets?.carbs_g || 250,
    fat: profile.targets?.fat_g || 65,
  }

  // Fetch last 30 days of logs for trends
  const thirtyDaysAgo = format(subDays(today, 30), 'yyyy-MM-dd')
  
  const { data: monthlyData } = await supabase
    .from('daily_logs')
    .select('log_date, logged_totals, meals_logged, adherence_score')
    .eq('user_id', user.id)
    .gte('log_date', thirtyDaysAgo)
    .lte('log_date', todayStr)
    .order('log_date', { ascending: true })

  // Process monthly logs
  const monthlyLogs: DayLog[] = (monthlyData || []).map(log => {
    const totals = log.logged_totals as DailyTotals
    return {
      date: log.log_date,
      calories: totals?.calories || 0,
      protein: totals?.protein_g || 0,
      carbs: totals?.carbs_g || 0,
      fat: totals?.fat_g || 0,
      mealsLogged: log.meals_logged || 0,
      adherenceScore: log.adherence_score,
    }
  })

  // Get today's log
  const todayLog = monthlyLogs.find(l => l.date === todayStr) || {
    date: todayStr,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    mealsLogged: 0,
    adherenceScore: null,
  }

  // Get last 7 days for weekly view
  const sevenDaysAgo = format(subDays(today, 6), 'yyyy-MM-dd')
  const weeklyLogs = monthlyLogs.filter(l => l.date >= sevenDaysAgo)

  // Calculate weekly averages (only for days with logs)
  const daysWithLogs = weeklyLogs.filter(l => l.calories > 0)
  const weeklyAverages = {
    calories: daysWithLogs.length > 0 
      ? Math.round(daysWithLogs.reduce((sum, l) => sum + l.calories, 0) / daysWithLogs.length)
      : 0,
    protein: daysWithLogs.length > 0
      ? Math.round(daysWithLogs.reduce((sum, l) => sum + l.protein, 0) / daysWithLogs.length)
      : 0,
    carbs: daysWithLogs.length > 0
      ? Math.round(daysWithLogs.reduce((sum, l) => sum + l.carbs, 0) / daysWithLogs.length)
      : 0,
    fat: daysWithLogs.length > 0
      ? Math.round(daysWithLogs.reduce((sum, l) => sum + l.fat, 0) / daysWithLogs.length)
      : 0,
  }

  // Calculate streaks
  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0
  let perfectDays = 0
  
  // Check from today backwards
  for (let i = 0; i <= 30; i++) {
    const checkDate = format(subDays(today, i), 'yyyy-MM-dd')
    const dayLog = monthlyLogs.find(l => l.date === checkDate)
    
    if (dayLog && dayLog.mealsLogged > 0) {
      tempStreak++
      
      // Check if perfect day (within ±10% of calorie target)
      const deviation = Math.abs(dayLog.calories - targets.calories) / targets.calories
      if (deviation <= 0.1) {
        perfectDays++
      }
      
      if (i === 0 || currentStreak > 0) {
        currentStreak = tempStreak
      }
    } else {
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak
      }
      if (i === 0) {
        currentStreak = 0
      }
      tempStreak = 0
    }
  }
  
  if (tempStreak > longestStreak) {
    longestStreak = tempStreak
  }

  const stats: NutritionStats = {
    targets,
    today: todayLog,
    weeklyLogs,
    weeklyAverages,
    monthlyLogs,
    currentStreak,
    longestStreak,
    totalDaysLogged: monthlyLogs.filter(l => l.mealsLogged > 0).length,
    perfectDays,
  }

  return <NutritionContent stats={stats} userName={profile.basic_info?.name || 'there'} />
}
