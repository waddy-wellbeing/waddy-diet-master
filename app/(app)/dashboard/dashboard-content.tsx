'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'
import { Settings, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  WeekSelector,
  DaySummary,
  MealCard,
  QuickStats,
} from '@/components/dashboard/dashboard-components'
import { createClient } from '@/lib/supabase/client'
import type { Profile, DailyLog, DailyPlan, DailyTotals, RecipeRecord } from '@/lib/types/nutri'

interface DashboardContentProps {
  profile: Profile
  initialDailyLog: { log: DailyLog; logged_totals: DailyTotals } | null
  initialDailyPlan: { plan: DailyPlan; daily_totals: DailyTotals } | null
  initialWeekLogs: Record<string, { consumed: number }>
  initialStreak: number
  initialMealRecipes: Record<string, RecipeRecord | null>
}

export function DashboardContent({ 
  profile,
  initialDailyLog,
  initialDailyPlan,
  initialWeekLogs,
  initialStreak,
  initialMealRecipes,
}: DashboardContentProps) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [dailyLog, setDailyLog] = useState(initialDailyLog)
  const [dailyPlan, setDailyPlan] = useState(initialDailyPlan)
  const [weekData, setWeekData] = useState(initialWeekLogs)
  const [streak, setStreak] = useState(initialStreak)
  const [mealRecipes, setMealRecipes] = useState(initialMealRecipes)
  
  // Get targets from profile
  const targets = profile.targets
  const dailyCalories = targets.daily_calories || 2000
  const proteinTarget = targets.protein_g || 150
  const carbsTarget = targets.carbs_g || 200
  const fatTarget = targets.fat_g || 65

  // Get logged totals (defaults to 0 if no log exists)
  const loggedTotals = dailyLog?.logged_totals || {}
  const todayConsumed = loggedTotals.calories || 0
  const currentProtein = loggedTotals.protein_g || 0
  const currentCarbs = loggedTotals.carbs_g || 0
  const currentFat = loggedTotals.fat_g || 0

  // Fetch data when selected date changes
  const fetchDayData = useCallback(async (date: Date) => {
    const supabase = createClient()
    const dateStr = format(date, 'yyyy-MM-dd')
    
    // Fetch daily log
    const { data: logData } = await supabase
      .from('daily_logs')
      .select('log, logged_totals')
      .eq('user_id', profile.user_id)
      .eq('log_date', dateStr)
      .single()
    
    // Fetch daily plan
    const { data: planData } = await supabase
      .from('daily_plans')
      .select('plan, daily_totals')
      .eq('user_id', profile.user_id)
      .eq('plan_date', dateStr)
      .single()

    setDailyLog(logData)
    setDailyPlan(planData)

    // If there's a plan, fetch the recipes
    if (planData?.plan) {
      const plan = planData.plan as DailyPlan
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
        
        const recipeMap: Record<string, RecipeRecord | null> = {
          breakfast: null,
          lunch: null,
          dinner: null,
          snacks: null,
        }
        
        if (recipes) {
          for (const recipe of recipes) {
            if (plan.breakfast?.recipe_id === recipe.id) recipeMap.breakfast = recipe
            if (plan.lunch?.recipe_id === recipe.id) recipeMap.lunch = recipe
            if (plan.dinner?.recipe_id === recipe.id) recipeMap.dinner = recipe
          }
        }
        
        setMealRecipes(recipeMap)
      }
    } else {
      setMealRecipes({ breakfast: null, lunch: null, dinner: null, snacks: null })
    }
  }, [profile.user_id])

  // Fetch week data when week changes
  const fetchWeekData = useCallback(async (date: Date) => {
    const supabase = createClient()
    const weekStart = startOfWeek(date, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(date, { weekStartsOn: 0 })
    
    const { data: weekLogs } = await supabase
      .from('daily_logs')
      .select('log_date, logged_totals')
      .eq('user_id', profile.user_id)
      .gte('log_date', format(weekStart, 'yyyy-MM-dd'))
      .lte('log_date', format(weekEnd, 'yyyy-MM-dd'))
    
    const weekRecord: Record<string, { consumed: number }> = {}
    if (weekLogs) {
      for (const log of weekLogs) {
        const totals = log.logged_totals as DailyTotals
        weekRecord[log.log_date] = { consumed: totals.calories || 0 }
      }
    }
    setWeekData(weekRecord)
  }, [profile.user_id])

  useEffect(() => {
    if (format(selectedDate, 'yyyy-MM-dd') !== format(new Date(), 'yyyy-MM-dd')) {
      fetchDayData(selectedDate)
      fetchWeekData(selectedDate)
    }
  }, [selectedDate, fetchDayData, fetchWeekData])

  // Build meal data from plan
  const plan = dailyPlan?.plan as DailyPlan | undefined
  const log = dailyLog?.log as DailyLog | undefined
  
  const meals = [
    {
      name: 'breakfast' as const,
      label: 'Breakfast',
      targetCalories: Math.round(dailyCalories * 0.25),
      consumedCalories: log?.breakfast?.items?.length ? 
        log.breakfast.items.reduce((sum, item) => sum + (item.servings || 1) * 100, 0) : 0,
      isLogged: !!log?.breakfast?.items?.length,
      recipe: mealRecipes.breakfast,
      planSlot: plan?.breakfast,
    },
    {
      name: 'lunch' as const,
      label: 'Lunch',
      targetCalories: Math.round(dailyCalories * 0.35),
      consumedCalories: log?.lunch?.items?.length ?
        log.lunch.items.reduce((sum, item) => sum + (item.servings || 1) * 100, 0) : 0,
      isLogged: !!log?.lunch?.items?.length,
      recipe: mealRecipes.lunch,
      planSlot: plan?.lunch,
    },
    {
      name: 'dinner' as const,
      label: 'Dinner',
      targetCalories: Math.round(dailyCalories * 0.30),
      consumedCalories: log?.dinner?.items?.length ?
        log.dinner.items.reduce((sum, item) => sum + (item.servings || 1) * 100, 0) : 0,
      isLogged: !!log?.dinner?.items?.length,
      recipe: mealRecipes.dinner,
      planSlot: plan?.dinner,
    },
    {
      name: 'snacks' as const,
      label: 'Snacks',
      targetCalories: Math.round(dailyCalories * 0.10),
      consumedCalories: log?.snacks?.items?.length ?
        log.snacks.items.reduce((sum, item) => sum + (item.servings || 1) * 100, 0) : 0,
      isLogged: !!log?.snacks?.items?.length,
      recipe: mealRecipes.snacks,
      planSlot: null,
    },
  ]

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const firstName = profile.basic_info?.name?.split(' ')[0] || 'there'

  // Handler for logging a meal
  const handleLogMeal = async (mealName: string) => {
    const supabase = createClient()
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    
    // Find the meal and its recipe
    const meal = meals.find(m => m.name === mealName)
    if (!meal?.recipe) return
    
    const logEntry = {
      type: 'recipe' as const,
      recipe_id: meal.recipe.id,
      servings: meal.planSlot?.servings || 1,
      from_plan: true,
    }
    
    // Get or create daily log
    const { data: existingLog } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', profile.user_id)
      .eq('log_date', dateStr)
      .single()
    
    const currentLog = (existingLog?.log || {}) as DailyLog
    const currentTotals = (existingLog?.logged_totals || {}) as DailyTotals
    
    // Add to the appropriate meal
    const mealLog = currentLog[mealName as keyof DailyLog] || { items: [] }
    const updatedMealLog = {
      logged_at: new Date().toISOString(),
      items: [...(mealLog.items || []), logEntry],
    }
    
    const updatedLog = {
      ...currentLog,
      [mealName]: updatedMealLog,
    }
    
    // Update totals
    const recipeCalories = meal.recipe.nutrition_per_serving?.calories || 0
    const recipeProtein = meal.recipe.nutrition_per_serving?.protein_g || 0
    const recipeCarbs = meal.recipe.nutrition_per_serving?.carbs_g || 0
    const recipeFat = meal.recipe.nutrition_per_serving?.fat_g || 0
    const servings = meal.planSlot?.servings || 1
    
    const updatedTotals = {
      calories: (currentTotals.calories || 0) + recipeCalories * servings,
      protein_g: (currentTotals.protein_g || 0) + recipeProtein * servings,
      carbs_g: (currentTotals.carbs_g || 0) + recipeCarbs * servings,
      fat_g: (currentTotals.fat_g || 0) + recipeFat * servings,
    }
    
    if (existingLog) {
      await supabase
        .from('daily_logs')
        .update({
          log: updatedLog,
          logged_totals: updatedTotals,
          meals_logged: Object.keys(updatedLog).filter(k => {
            const mealLog = updatedLog[k as keyof DailyLog]
            return mealLog?.items && mealLog.items.length > 0
          }).length,
        })
        .eq('id', existingLog.id)
    } else {
      await supabase
        .from('daily_logs')
        .insert({
          user_id: profile.user_id,
          log_date: dateStr,
          log: updatedLog,
          logged_totals: updatedTotals,
          meals_logged: 1,
        })
    }
    
    // Refresh the data
    fetchDayData(selectedDate)
    fetchWeekData(selectedDate)
  }
  
  // Handler for swapping a meal
  const handleSwapMeal = (mealName: string, direction: 'left' | 'right') => {
    // TODO: Implement meal swap - this would typically open a modal to select a new recipe
    console.log('Swap', mealName, direction)
  }

  // Calculate weekly average from weekData
  const weekDaysWithData = Object.values(weekData).filter(d => d.consumed > 0)
  const weeklyAverage = weekDaysWithData.length > 0
    ? Math.round(weekDaysWithData.reduce((sum, d) => sum + d.consumed, 0) / weekDaysWithData.length)
    : 0

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/50 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{greeting()}, {firstName}! 👋</h1>
            <p className="text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href="/profile">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        {/* Week Selector */}
        <WeekSelector
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          weekData={weekData}
          dailyTarget={dailyCalories}
        />

        {/* Day Summary */}
        <DaySummary
          consumed={todayConsumed}
          target={dailyCalories}
          protein={{ current: currentProtein, target: proteinTarget }}
          carbs={{ current: currentCarbs, target: carbsTarget }}
          fat={{ current: currentFat, target: currentFat }}
        />

        {/* Meals Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Today's Meals</h2>
            <Button variant="ghost" size="sm" className="text-primary" asChild>
              <Link href="/plans">View Plan</Link>
            </Button>
          </div>
          
          <div className="space-y-3">
            {meals.map((meal) => (
              <MealCard
                key={meal.name}
                meal={meal}
                onLogMeal={handleLogMeal}
                onSwapMeal={handleSwapMeal}
                onAddFood={() => {
                  // Navigate to meal builder or open add food modal
                  console.log('Add food to', meal.name)
                }}
              />
            ))}
          </div>
        </section>

        {/* Quick Stats */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Weekly Overview</h2>
          <QuickStats
            streak={streak}
            weeklyAverage={weeklyAverage}
            weeklyTarget={dailyCalories}
          />
        </section>

        {/* Admin link if applicable */}
        {(profile.role === 'admin' || profile.role === 'moderator') && (
          <div className="pt-4 border-t border-border">
            <Button variant="outline" className="w-full" asChild>
              <Link href="/admin">
                Go to Admin Panel
              </Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
