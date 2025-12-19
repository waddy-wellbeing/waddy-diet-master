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
  const weekStart = startOfWeek(today, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 })
  const thirtyDaysAgo = format(subDays(today, 30), 'yyyy-MM-dd')
  
  // Run ALL queries in parallel for maximum speed
  const [
    { data: dailyLog },
    { data: dailyPlan },
    { data: weekLogs },
    { data: streakLogs },
    { data: allRecipes },
  ] = await Promise.all([
    // Today's log
    supabase
      .from('daily_logs')
      .select('log, logged_totals')
      .eq('user_id', user.id)
      .eq('log_date', todayStr)
      .maybeSingle(),
    
    // Today's plan
    supabase
      .from('daily_plans')
      .select('plan, daily_totals')
      .eq('user_id', user.id)
      .eq('plan_date', todayStr)
      .maybeSingle(),
    
    // Week logs for the week selector
    supabase
      .from('daily_logs')
      .select('log_date, logged_totals')
      .eq('user_id', user.id)
      .gte('log_date', format(weekStart, 'yyyy-MM-dd'))
      .lte('log_date', format(weekEnd, 'yyyy-MM-dd')),
    
    // Last 30 days for streak calculation (single query instead of 30!)
    supabase
      .from('daily_logs')
      .select('log_date')
      .eq('user_id', user.id)
      .gte('log_date', thirtyDaysAgo)
      .lte('log_date', todayStr)
      .order('log_date', { ascending: false }),
    
    // All public recipes
    supabase
      .from('recipes')
      .select('*')
      .eq('is_public', true)
      .not('nutrition_per_serving', 'is', null)
      .order('name'),
  ])
  
  // Process week data
  const weekData: Record<string, { consumed: number }> = {}
  if (weekLogs) {
    for (const log of weekLogs) {
      const totals = log.logged_totals as DailyTotals
      weekData[log.log_date] = { consumed: totals.calories || 0 }
    }
  }
  
  // Calculate streak from the fetched logs (no more loop queries!)
  let streak = 0
  if (streakLogs && streakLogs.length > 0) {
    const logDates = new Set(streakLogs.map(l => l.log_date))
    let checkDate = today
    
    // Count consecutive days from today backwards
    for (let i = 0; i < 30; i++) {
      const dateStr = format(checkDate, 'yyyy-MM-dd')
      if (logDates.has(dateStr)) {
        streak++
        checkDate = subDays(checkDate, 1)
      } else {
        break
      }
    }
  }
  
  // Get user's daily calorie target and calculate meal targets
  const dailyCalories = profile.targets?.daily_calories || 2000
  const mealTargets = {
    breakfast: Math.round(dailyCalories * 0.25),
    lunch: Math.round(dailyCalories * 0.35),
    dinner: Math.round(dailyCalories * 0.30),
    snacks: Math.round(dailyCalories * 0.10),
  }
  
  // Meal type mapping (same as test console)
  // Database meal_types: breakfast, lunch, dinner, snacks & sweetes, snack, smoothies, one pot, side dishes
  const mealTypeMapping: Record<string, string[]> = {
    breakfast: ['breakfast', 'smoothies'],
    lunch: ['lunch', 'one pot', 'dinner', 'side dishes'],  // Lunch includes one pot, dinner recipes, and sides
    dinner: ['dinner', 'lunch', 'one pot', 'side dishes', 'breakfast'],  // Dinner uses dinner recipes first, then lunch/one pot
    snacks: ['snack', 'snacks & sweetes', 'smoothies'],  // Include both singular and plural forms
  }
  
  // Get scaling limits from system settings or use defaults
  const minScale = 0.5
  const maxScale = 2.0
  
  // Process recipes for each meal type with scaling
  interface ScaledRecipe extends RecipeRecord {
    scale_factor: number
    scaled_calories: number
    original_calories: number
  }
  
  const recipesByMealType: Record<string, ScaledRecipe[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
  }
  
  if (allRecipes) {
    for (const mealSlot of ['breakfast', 'lunch', 'dinner', 'snacks'] as const) {
      const targetCalories = mealTargets[mealSlot]
      const acceptedMealTypes = mealTypeMapping[mealSlot]
      const primaryMealType = acceptedMealTypes[0]
      
      const suitableRecipes: ScaledRecipe[] = []
      
      for (const recipe of allRecipes) {
        const recipeMealTypes = recipe.meal_type || []
        const matchesMealType = acceptedMealTypes.some(t => 
          recipeMealTypes.some((rmt: string) => rmt.toLowerCase() === t.toLowerCase())
        )
        
        if (!matchesMealType) continue
        
        const baseCalories = recipe.nutrition_per_serving?.calories
        if (!baseCalories || baseCalories <= 0) continue
        
        // Calculate scale factor to hit exact target calories
        const scaleFactor = targetCalories / baseCalories
        
        // Check if scaling is within acceptable limits
        if (scaleFactor < minScale || scaleFactor > maxScale) continue
        
        suitableRecipes.push({
          ...(recipe as RecipeRecord),
          scale_factor: Math.round(scaleFactor * 100) / 100,
          scaled_calories: targetCalories, // Always equals target after scaling
          original_calories: baseCalories,
        })
      }
      
      // Sort by: 1) Primary meal type first, 2) Scale factor closest to 1.0
      suitableRecipes.sort((a, b) => {
        const aPrimary = a.meal_type?.some(t => t.toLowerCase() === primaryMealType) ? 1 : 0
        const bPrimary = b.meal_type?.some(t => t.toLowerCase() === primaryMealType) ? 1 : 0
        if (bPrimary !== aPrimary) return bPrimary - aPrimary
        
        const aDistFromOne = Math.abs(a.scale_factor - 1)
        const bDistFromOne = Math.abs(b.scale_factor - 1)
        return aDistFromOne - bDistFromOne
      })
      
      recipesByMealType[mealSlot] = suitableRecipes
    }
  }
  
  // If there's a daily plan, get the currently selected recipe indices
  const plan = dailyPlan?.plan as DailyPlan | undefined
  const selectedRecipeIndices: Record<string, number> = {
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    snacks: 0,
  }
  
  // If plan exists, find the index of the planned recipe in the available recipes
  if (plan) {
    if (plan.breakfast?.recipe_id) {
      const idx = recipesByMealType.breakfast.findIndex(r => r.id === plan.breakfast?.recipe_id)
      if (idx >= 0) selectedRecipeIndices.breakfast = idx
    }
    if (plan.lunch?.recipe_id) {
      const idx = recipesByMealType.lunch.findIndex(r => r.id === plan.lunch?.recipe_id)
      if (idx >= 0) selectedRecipeIndices.lunch = idx
    }
    if (plan.dinner?.recipe_id) {
      const idx = recipesByMealType.dinner.findIndex(r => r.id === plan.dinner?.recipe_id)
      if (idx >= 0) selectedRecipeIndices.dinner = idx
    }
  }

  return (
    <DashboardContent 
      profile={profile}
      initialDailyLog={dailyLog}
      initialDailyPlan={dailyPlan}
      initialWeekLogs={weekData}
      initialStreak={streak}
      recipesByMealType={recipesByMealType}
      initialSelectedIndices={selectedRecipeIndices}
      mealTargets={mealTargets}
    />
  )
}