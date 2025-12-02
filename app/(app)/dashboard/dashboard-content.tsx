'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { Settings, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  WeekSelector,
  MealCard,
  QuickStats,
} from '@/components/dashboard/dashboard-components'
import { createClient } from '@/lib/supabase/client'
import type { Profile, DailyLog, DailyPlan, DailyTotals, RecipeRecord } from '@/lib/types/nutri'

type MealName = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

// Scaled recipe includes scale_factor and scaled_calories
interface ScaledRecipe extends RecipeRecord {
  scale_factor: number
  scaled_calories: number
  original_calories: number
}

interface DashboardContentProps {
  profile: Profile
  initialDailyLog: { log: DailyLog; logged_totals: DailyTotals } | null
  initialDailyPlan: { plan: DailyPlan; daily_totals: DailyTotals } | null
  initialWeekLogs: Record<string, { consumed: number }>
  initialStreak: number
  recipesByMealType: Record<string, ScaledRecipe[]>
  initialSelectedIndices: Record<string, number>
  mealTargets: Record<string, number>
}

export function DashboardContent({ 
  profile,
  initialDailyLog,
  initialDailyPlan,
  initialWeekLogs,
  initialStreak,
  recipesByMealType,
  initialSelectedIndices,
  mealTargets,
}: DashboardContentProps) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [dailyLog, setDailyLog] = useState(initialDailyLog)
  const [dailyPlan, setDailyPlan] = useState(initialDailyPlan)
  const [weekData, setWeekData] = useState(initialWeekLogs)
  const [streak, setStreak] = useState(initialStreak)
  
  // Track current recipe index for each meal type (for swiping)
  const [selectedIndices, setSelectedIndices] = useState<Record<MealName, number>>({
    breakfast: initialSelectedIndices.breakfast || 0,
    lunch: initialSelectedIndices.lunch || 0,
    dinner: initialSelectedIndices.dinner || 0,
    snacks: initialSelectedIndices.snacks || 0,
  })
  
  // Get targets from profile
  const targets = profile.targets
  const dailyCalories = targets.daily_calories || 2000

  // Get logged totals (defaults to 0 if no log exists)
  const loggedTotals = dailyLog?.logged_totals || {}
  const todayConsumed = loggedTotals.calories || 0

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
    
    // If there's a plan, update selected indices to match the plan
    if (planData?.plan) {
      const plan = planData.plan as DailyPlan
      const newIndices = { ...selectedIndices }
      
      if (plan.breakfast?.recipe_id) {
        const idx = recipesByMealType.breakfast.findIndex(r => r.id === plan.breakfast?.recipe_id)
        if (idx >= 0) newIndices.breakfast = idx
      }
      if (plan.lunch?.recipe_id) {
        const idx = recipesByMealType.lunch.findIndex(r => r.id === plan.lunch?.recipe_id)
        if (idx >= 0) newIndices.lunch = idx
      }
      if (plan.dinner?.recipe_id) {
        const idx = recipesByMealType.dinner.findIndex(r => r.id === plan.dinner?.recipe_id)
        if (idx >= 0) newIndices.dinner = idx
      }
      
      setSelectedIndices(newIndices)
    }
  }, [profile.user_id, recipesByMealType, selectedIndices])

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

  // Get current recipe for each meal type based on selected index
  const getCurrentRecipe = (mealType: MealName): ScaledRecipe | null => {
    const recipes = recipesByMealType[mealType] || []
    const index = selectedIndices[mealType] || 0
    return recipes[index] || null
  }
  
  // Get recipe count for each meal type
  const getRecipeCount = (mealType: MealName): number => {
    return (recipesByMealType[mealType] || []).length
  }

  // Build meal data using mealTargets for proper calorie allocation
  const plan = dailyPlan?.plan as DailyPlan | undefined
  const log = dailyLog?.log as DailyLog | undefined
  
  const meals = [
    {
      name: 'breakfast' as const,
      label: 'Breakfast',
      targetCalories: mealTargets.breakfast,
      consumedCalories: log?.breakfast?.items?.length ? 
        log.breakfast.items.reduce((sum, item) => sum + (item.servings || 1) * 100, 0) : 0,
      isLogged: !!log?.breakfast?.items?.length,
      recipe: getCurrentRecipe('breakfast'),
      recipeCount: getRecipeCount('breakfast'),
      currentIndex: selectedIndices.breakfast,
      planSlot: plan?.breakfast,
    },
    {
      name: 'lunch' as const,
      label: 'Lunch',
      targetCalories: mealTargets.lunch,
      consumedCalories: log?.lunch?.items?.length ?
        log.lunch.items.reduce((sum, item) => sum + (item.servings || 1) * 100, 0) : 0,
      isLogged: !!log?.lunch?.items?.length,
      recipe: getCurrentRecipe('lunch'),
      recipeCount: getRecipeCount('lunch'),
      currentIndex: selectedIndices.lunch,
      planSlot: plan?.lunch,
    },
    {
      name: 'dinner' as const,
      label: 'Dinner',
      targetCalories: mealTargets.dinner,
      consumedCalories: log?.dinner?.items?.length ?
        log.dinner.items.reduce((sum, item) => sum + (item.servings || 1) * 100, 0) : 0,
      isLogged: !!log?.dinner?.items?.length,
      recipe: getCurrentRecipe('dinner'),
      recipeCount: getRecipeCount('dinner'),
      currentIndex: selectedIndices.dinner,
      planSlot: plan?.dinner,
    },
    {
      name: 'snacks' as const,
      label: 'Snacks',
      targetCalories: mealTargets.snacks,
      consumedCalories: log?.snacks?.items?.length ?
        log.snacks.items.reduce((sum, item) => sum + (item.servings || 1) * 100, 0) : 0,
      isLogged: !!log?.snacks?.items?.length,
      recipe: getCurrentRecipe('snacks'),
      recipeCount: getRecipeCount('snacks'),
      currentIndex: selectedIndices.snacks,
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
  
  // Handler for unlogging a meal
  const handleUnlogMeal = async (mealName: string) => {
    const supabase = createClient()
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    
    // Get current daily log
    const { data: existingLog } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', profile.user_id)
      .eq('log_date', dateStr)
      .single()
    
    if (!existingLog) return
    
    const currentLog = (existingLog.log || {}) as DailyLog
    const currentTotals = (existingLog.logged_totals || {}) as DailyTotals
    
    // Get the meal log to remove
    const mealLog = currentLog[mealName as keyof DailyLog]
    if (!mealLog?.items?.length) return
    
    // Calculate calories to subtract (from the last logged item)
    const meal = meals.find(m => m.name === mealName)
    const recipeCalories = meal?.recipe?.nutrition_per_serving?.calories || 0
    const recipeProtein = meal?.recipe?.nutrition_per_serving?.protein_g || 0
    const recipeCarbs = meal?.recipe?.nutrition_per_serving?.carbs_g || 0
    const recipeFat = meal?.recipe?.nutrition_per_serving?.fat_g || 0
    const servings = meal?.planSlot?.servings || 1
    
    // Remove the meal from log
    const updatedLog = {
      ...currentLog,
      [mealName]: { logged_at: null, items: [] },
    }
    
    // Update totals (subtract the calories)
    const updatedTotals = {
      calories: Math.max(0, (currentTotals.calories || 0) - recipeCalories * servings),
      protein_g: Math.max(0, (currentTotals.protein_g || 0) - recipeProtein * servings),
      carbs_g: Math.max(0, (currentTotals.carbs_g || 0) - recipeCarbs * servings),
      fat_g: Math.max(0, (currentTotals.fat_g || 0) - recipeFat * servings),
    }
    
    await supabase
      .from('daily_logs')
      .update({
        log: updatedLog,
        logged_totals: updatedTotals,
        meals_logged: Object.keys(updatedLog).filter(k => {
          const ml = updatedLog[k as keyof DailyLog]
          return ml?.items && ml.items.length > 0
        }).length,
      })
      .eq('id', existingLog.id)
    
    // Refresh the data
    fetchDayData(selectedDate)
    fetchWeekData(selectedDate)
  }
  
  // Handler for swapping a meal - navigates to next/previous recipe
  const handleSwapMeal = (mealName: string, direction: 'left' | 'right') => {
    const mealType = mealName as MealName
    const recipes = recipesByMealType[mealType] || []
    if (recipes.length <= 1) return // Nothing to swap to
    
    const currentIdx = selectedIndices[mealType]
    let newIdx: number
    
    if (direction === 'right') {
      // Next recipe (wrap around)
      newIdx = (currentIdx + 1) % recipes.length
    } else {
      // Previous recipe (wrap around)
      newIdx = currentIdx === 0 ? recipes.length - 1 : currentIdx - 1
    }
    
    setSelectedIndices(prev => ({
      ...prev,
      [mealType]: newIdx,
    }))
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
        {/* Week Selector with inline progress bar */}
        <WeekSelector
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          weekData={weekData}
          dailyTarget={dailyCalories}
          showDayProgress={true}
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
                onUnlogMeal={handleUnlogMeal}
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
