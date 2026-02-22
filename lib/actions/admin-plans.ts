'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export interface AdminUserProfile {
  user_id: string
  name: string | null
  email: string | null
  basic_info: Record<string, any> | null
  created_at: string
  role: string
}

export interface AdminUserPlan {
  id: string
  plan_date: string
  plan: {
    breakfast?: { recipe_id: string; servings: number }
    lunch?: { recipe_id: string; servings: number }
    dinner?: { recipe_id: string; servings: number }
    snacks?: { recipe_id: string; servings: number }[]
  }
  fasting_plan?: {
    'pre-iftar'?: { recipe_id: string; servings: number }
    'iftar'?: { recipe_id: string; servings: number }
    'full-meal-taraweeh'?: { recipe_id: string; servings: number }
    'snack-taraweeh'?: { recipe_id: string; servings: number }
    'suhoor'?: { recipe_id: string; servings: number }
  }
  daily_totals: {
    calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
  } | null
}

export interface AdminRecipeInfo {
  id: string
  name: string
  image_url: string | null
  nutrition_per_serving: {
    calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
  } | null
}

/**
 * Fetch recent users for admin plans dashboard (light query)
 */
export async function getRecentUsers(limit = 20): Promise<{
  success: boolean
  data?: AdminUserProfile[]
  error?: string
}> {
  try {
    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, name, email, basic_info, created_at, role')
      .eq('role', 'client')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching users:', error)
      return { success: false, error: error.message }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('Fetched users:', data)
    }
    return { success: true, data: data as AdminUserProfile[] }
  } catch (error) {
    return { success: false, error: 'Failed to fetch users' }
  }
}

/**
 * Search users by name or email
 */
export async function searchUsers(query: string): Promise<{
  success: boolean
  data?: AdminUserProfile[]
  error?: string
}> {
  try {
    if (!query || query.trim().length < 2) {
      return { success: true, data: [] }
    }

    const supabase = createAdminClient()
    const searchTerm = `%${query.trim()}%`

    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, name, email, basic_info, created_at, role')
      .or(`name.ilike.${searchTerm},email.ilike.${searchTerm}`)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Error searching users:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as AdminUserProfile[] }
  } catch (error) {
    return { success: false, error: 'Failed to search users' }
  }
}

/**
 * Fetch user's meal plans (heavy query - only when user is selected)
 */
export async function getUserPlans(userId: string, daysBack = 30, daysForward = 30): Promise<{
  success: boolean
  data?: {
    plans: AdminUserPlan[]
    recipes: Record<string, AdminRecipeInfo>
    profile: AdminUserProfile | null
    isFastingMode: boolean
    fastingSelectedMeals: string[]
    dailyCalories: number
    fastingMealsPerDay?: number
    targets: any
  }
  error?: string
}> {
  try {
    const supabase = createAdminClient()

    // Get date range (past N days and future M days)
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - daysBack)
    
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + daysForward)
    
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    console.log(`Fetching plans for user ${userId} from ${startDateStr} to ${endDateStr}`)

    // Fetch user's plans
    const { data: plans, error: plansError } = await supabase
      .from('daily_plans')
      .select('id, plan_date, plan, fasting_plan, daily_totals')
      .eq('user_id', userId)
      .gte('plan_date', startDateStr)
      .lte('plan_date', endDateStr)
      .order('plan_date', { ascending: false })

    if (plansError) {
      console.error('Error fetching plans:', plansError)
      return { success: false, error: plansError.message }
    }

    console.log(`Fetched ${plans?.length || 0} plans for user ${userId}:`, plans)

    // Extract all unique recipe IDs from plans (both regular and fasting)
    const recipeIds = new Set<string>()
    for (const plan of plans || []) {
      // Regular plan recipes
      const p = plan.plan as AdminUserPlan['plan']
      if (p?.breakfast?.recipe_id) recipeIds.add(p.breakfast.recipe_id)
      if (p?.lunch?.recipe_id) recipeIds.add(p.lunch.recipe_id)
      if (p?.dinner?.recipe_id) recipeIds.add(p.dinner.recipe_id)
      if (p?.snacks) {
        for (const snack of p.snacks) {
          if (snack?.recipe_id) recipeIds.add(snack.recipe_id)
        }
      }
      
      // Fasting plan recipes
      const fp = plan.fasting_plan as AdminUserPlan['fasting_plan']
      if (fp) {
        if (fp['pre-iftar']?.recipe_id) recipeIds.add(fp['pre-iftar'].recipe_id)
        if (fp['iftar']?.recipe_id) recipeIds.add(fp['iftar'].recipe_id)
        if (fp['full-meal-taraweeh']?.recipe_id) recipeIds.add(fp['full-meal-taraweeh'].recipe_id)
        // snack-taraweeh is an array (like regular snacks)
        if (fp['snack-taraweeh']) {
          const snackData = fp['snack-taraweeh'] as any
          if (Array.isArray(snackData)) {
            for (const snack of snackData) {
              if (snack?.recipe_id) recipeIds.add(snack.recipe_id)
            }
          } else if (snackData?.recipe_id) {
            // Legacy format fallback
            recipeIds.add(snackData.recipe_id)
          }
        }
        if (fp['suhoor']?.recipe_id) recipeIds.add(fp['suhoor'].recipe_id)
      }
    }

    // Fetch recipe info for all recipe IDs
    const recipes: Record<string, AdminRecipeInfo> = {}
    if (recipeIds.size > 0) {
      console.log('Fetching recipes for IDs:', Array.from(recipeIds))
      const { data: recipeData, error: recipesError } = await supabase
        .from('recipes')
        .select('id, name, image_url, nutrition_per_serving')
        .in('id', Array.from(recipeIds))

      if (recipesError) {
        console.error('Error fetching recipes:', recipesError)
      } else if (recipeData) {
        console.log('Fetched recipes:', recipeData)
        for (const recipe of recipeData) {
          recipes[recipe.id] = recipe as AdminRecipeInfo
        }
      }
    }

    // Fetch user profile with preferences and targets
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id, name, email, basic_info, preferences, targets, created_at, role')
      .eq('user_id', userId)
      .single()

    console.log('User profile:', profile)

    // Extract fasting preferences and targets
    const preferences = (profile as any)?.preferences || {}
    const targets = (profile as any)?.targets || {}
    const isFastingMode = preferences.is_fasting || false
    const fastingSelectedMeals = preferences.fasting_selected_meals || []
    const dailyCalories = targets.daily_calories || 2000
    const fastingMealsPerDay = preferences.fasting_meals_per_day

    return {
      success: true,
      data: {
        plans: plans as AdminUserPlan[],
        recipes,
        profile: profile as AdminUserProfile | null,
        isFastingMode,
        fastingSelectedMeals,
        dailyCalories,
        fastingMealsPerDay,
        targets,
      },
    }
  } catch (error) {
    console.error('Error in getUserPlans:', error)
    return { success: false, error: 'Failed to fetch user plans' }
  }
}

/**
 * Update a user's meal plan for a specific date
 */
export async function updateUserPlan(
  userId: string,
  planDate: string,
  plan: AdminUserPlan['plan']
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('daily_plans')
      .upsert({
        user_id: userId,
        plan_date: planDate,
        plan,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,plan_date',
      })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to update plan' }
  }
}

/**
 * Fetch a single day's plan with recipes (for real-time updates)
 */
export async function getDayPlan(userId: string, planDate: string): Promise<{
  success: boolean
  data?: {
    plan: AdminUserPlan | null
    recipes: Record<string, AdminRecipeInfo>
  }
  error?: string
}> {
  try {
    const supabase = createAdminClient()

    // Fetch the specific day's plan (include fasting_plan)
    const { data: plan, error: planError } = await supabase
      .from('daily_plans')
      .select('id, plan_date, plan, fasting_plan, daily_totals')
      .eq('user_id', userId)
      .eq('plan_date', planDate)
      .single()

    if (planError && planError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" - that's OK, just no plan for this date
      console.error('Error fetching plan:', planError)
      return { success: false, error: planError.message }
    }

    // If no plan found, return empty
    if (!plan) {
      return { 
        success: true, 
        data: { 
          plan: null, 
          recipes: {} 
        } 
      }
    }

    // Extract recipe IDs from both regular and fasting plans
    const recipeIds = new Set<string>()
    const p = plan.plan as AdminUserPlan['plan']
    
    if (p?.breakfast?.recipe_id) recipeIds.add(p.breakfast.recipe_id)
    if (p?.lunch?.recipe_id) recipeIds.add(p.lunch.recipe_id)
    if (p?.dinner?.recipe_id) recipeIds.add(p.dinner.recipe_id)
    if (p?.snacks) {
      for (const snack of p.snacks) {
        if (snack?.recipe_id) recipeIds.add(snack.recipe_id)
      }
    }
    
    // Extract fasting plan recipe IDs
    const fp = plan.fasting_plan as AdminUserPlan['fasting_plan']
    if (fp) {
      if (fp['pre-iftar']?.recipe_id) recipeIds.add(fp['pre-iftar'].recipe_id)
      if (fp['iftar']?.recipe_id) recipeIds.add(fp['iftar'].recipe_id)
      if (fp['full-meal-taraweeh']?.recipe_id) recipeIds.add(fp['full-meal-taraweeh'].recipe_id)
      if (fp['snack-taraweeh']?.recipe_id) recipeIds.add(fp['snack-taraweeh'].recipe_id)
      if (fp['suhoor']?.recipe_id) recipeIds.add(fp['suhoor'].recipe_id)
    }

    // Fetch recipes
    const recipes: Record<string, AdminRecipeInfo> = {}
    if (recipeIds.size > 0) {
      const { data: recipeData, error: recipesError } = await supabase
        .from('recipes')
        .select('id, name, image_url, nutrition_per_serving')
        .in('id', Array.from(recipeIds))

      if (!recipesError && recipeData) {
        for (const recipe of recipeData) {
          recipes[recipe.id] = recipe as AdminRecipeInfo
        }
      }
    }

    return {
      success: true,
      data: {
        plan: plan as AdminUserPlan,
        recipes,
      },
    }
  } catch (error) {
    console.error('Error in getDayPlan:', error)
    return { success: false, error: 'Failed to fetch day plan' }
  }
}

/**
 * Update a specific meal in a user's plan (admin action)
 * Now includes proper calorie scaling based on meal targets
 */
export async function updateUserMeal({
  userId,
  planDate,
  mealType,
  recipeId,
  snackIndex,
  isFastingMode,
}: {
  userId: string
  planDate: string
  mealType: string
  recipeId: string
  snackIndex?: number | null
  isFastingMode?: boolean
}): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = createAdminClient()

    // Fetch user profile to get calorie targets
    const { data: profile } = await supabase
      .from('profiles')
      .select('targets, preferences')
      .eq('user_id', userId)
      .single()

    if (!profile) {
      return { success: false, error: 'User profile not found' }
    }

    const targets = (profile as any)?.targets || {}
    const preferences = (profile as any)?.preferences || {}
    const dailyCalories = targets.daily_calories || 2000
    const fastingMealsPerDay = preferences.fasting_meals_per_day

    // Get existing plan (both regular and fasting)
    const { data: existingPlan } = await supabase
      .from('daily_plans')
      .select('plan, fasting_plan, daily_totals')
      .eq('user_id', userId)
      .eq('plan_date', planDate)
      .maybeSingle()

    // Determine which column to update
    const columnName = isFastingMode ? 'fasting_plan' : 'plan'
    const otherColumnName = isFastingMode ? 'plan' : 'fasting_plan'
    
    const currentPlan = (existingPlan?.[columnName] as any) || {}
    const updatedPlan = { ...currentPlan }

    // Fetch recipe to get base calories for scaling
    const { data: recipe } = await supabase
      .from('recipes')
      .select('nutrition_per_serving')
      .eq('id', recipeId)
      .single()

    if (!recipe) {
      return { success: false, error: 'Recipe not found' }
    }

    const nutritionData = typeof recipe.nutrition_per_serving === 'string' 
      ? JSON.parse(recipe.nutrition_per_serving) 
      : recipe.nutrition_per_serving
    const baseCalories = nutritionData?.calories || 0

    // Calculate target calories for this meal slot
    let targetCalories = 0
    if (isFastingMode) {
      // Use normalized distribution based on selected meals (mirrors dashboard logic)
      const fastingSelectedMeals = preferences.fasting_selected_meals || []
      const fastingDistribution: Record<string, number> = {
        "pre-iftar": 0.1,
        iftar: 0.4,
        "full-meal-taraweeh": 0.3,
        "snack-taraweeh": 0.1,
        suhoor: 0.25,
      }

      const mealsToUse = fastingSelectedMeals.length > 0 
        ? fastingSelectedMeals 
        : Object.keys(fastingDistribution)

      // Validate mealsToUse contains only valid distribution keys
      const invalidMeals = mealsToUse.filter((m: string) => !(m in fastingDistribution))
      if (invalidMeals.length > 0) {
        console.error(`Invalid fasting meals: ${invalidMeals.join(', ')}`)
        return { success: false, error: `Invalid fasting meal types: ${invalidMeals.join(', ')}` }
      }

      // Calculate total percentage and normalize
      const totalPercentage = mealsToUse.reduce(
        (sum: number, meal: string) => sum + (fastingDistribution[meal] || 0),
        0
      )

      // Guard against divide-by-zero
      if (totalPercentage <= 0) {
        console.error('Total percentage is zero or negative', { mealsToUse, totalPercentage })
        return { success: false, error: 'Invalid fasting meal distribution' }
      }

      const normalizedPercentage = (fastingDistribution[mealType] || 0.2) / totalPercentage
      targetCalories = Math.round(dailyCalories * normalizedPercentage)
    } else {
      // Regular mode - use meal structure or defaults
      const mealStructure = targets.meal_structure || [
        { name: 'breakfast', percentage: 25 },
        { name: 'lunch', percentage: 35 },
        { name: 'dinner', percentage: 30 },
        { name: 'snacks', percentage: 10 },
      ]
      const mealSlot = mealStructure.find((m: any) => m.name === mealType)
      if (mealSlot) {
        targetCalories = Math.round(dailyCalories * (mealSlot.percentage / 100))
      }
    }

    // Calculate scale factor (servings) to hit target calories
    // Scale factor = targetCalories / baseCalories
    const scaleFactor = baseCalories > 0 ? targetCalories / baseCalories : 1
    const servings = Math.round(scaleFactor * 100) / 100 // Round to 2 decimals

    // Update the specific meal with calculated servings
    if (mealType === 'snacks' && snackIndex !== null && snackIndex !== undefined) {
      // Update specific snack in array (regular mode only)
      const snacks = Array.isArray(updatedPlan.snacks) ? [...updatedPlan.snacks] : []
      snacks[snackIndex] = { recipe_id: recipeId, servings }
      updatedPlan.snacks = snacks
    } else if (mealType === 'snack-taraweeh') {
      // snack-taraweeh is ALWAYS an array (matches user dashboard behavior)
      updatedPlan['snack-taraweeh'] = [{ recipe_id: recipeId, servings }]
    } else {
      // Update meal (breakfast/lunch/dinner or other fasting meals)
      updatedPlan[mealType] = { recipe_id: recipeId, servings }
    }

    console.log(`[Admin] Updated ${mealType} with recipe ${recipeId}, servings: ${servings} (target: ${targetCalories} cal, base: ${baseCalories} cal)`)

    // Preserve the other column (don't overwrite it)
    const otherColumnData = existingPlan?.[otherColumnName] || null

    // Save to database - include BOTH columns to preserve data
    const upsertData: any = {
      user_id: userId,
      plan_date: planDate,
      updated_at: new Date().toISOString(),
    }
    
    // Set both columns explicitly
    upsertData[columnName] = updatedPlan
    if (otherColumnData) {
      upsertData[otherColumnName] = otherColumnData
    }

    const { error } = await supabase
      .from('daily_plans')
      .upsert(upsertData, {
        onConflict: 'user_id,plan_date',
      })

    if (error) {
      console.error('Error updating meal:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error in updateUserMeal:', error)
    return { success: false, error: 'Failed to update meal' }
  }
}

/**
 * Create a full day plan for an unplanned day (admin action)
 */
export async function createDayPlan({
  userId,
  planDate,
  meals,
}: {
  userId: string
  planDate: string
  meals: {
    breakfast?: string
    lunch?: string
    dinner?: string
    snacks?: string[]
  }
}): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = createAdminClient()

    // Build the plan object
    const plan: AdminUserPlan['plan'] = {}
    
    if (meals.breakfast) {
      plan.breakfast = { recipe_id: meals.breakfast, servings: 1 }
    }
    
    if (meals.lunch) {
      plan.lunch = { recipe_id: meals.lunch, servings: 1 }
    }
    
    if (meals.dinner) {
      plan.dinner = { recipe_id: meals.dinner, servings: 1 }
    }
    
    if (meals.snacks && meals.snacks.length > 0) {
      plan.snacks = meals.snacks.map(recipeId => ({ recipe_id: recipeId, servings: 1 }))
    }

    // Insert new plan (should not exist for unplanned days)
    const { error } = await supabase
      .from('daily_plans')
      .insert({
        user_id: userId,
        plan_date: planDate,
        plan,
      })

    if (error) {
      console.error('Error creating day plan:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error in createDayPlan:', error)
    return { success: false, error: 'Failed to create day plan' }
  }
}

/**
 * Fetch all public recipes for admin recipe picker
 */
export async function getAllRecipes(): Promise<{
  success: boolean
  data?: any[]
  error?: string
}> {
  try {
    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('is_public', true)
      .not('nutrition_per_serving', 'is', null)
      .order('name')

    if (error) {
      console.error('Error fetching recipes:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Error in getAllRecipes:', error)
    return { success: false, error: 'Failed to fetch recipes' }
  }
}

/**
 * Get scaled recipes for a specific meal type (admin)
 * Applies same scaling logic as user dashboard
 */
export async function getScaledRecipesForMeal({
  userId,
  mealType,
  isFastingMode,
}: {
  userId: string
  mealType: string
  isFastingMode?: boolean
}): Promise<{
  success: boolean
  data?: Array<{
    id: string
    name: string
    image_url: string | null
    meal_type: string[] | null
    recommendation_group: string[] | null
    nutrition_per_serving: any
    scale_factor: number
    scaled_calories: number
    original_calories: number
    macro_similarity_score: number
  }>
  error?: string
}> {
  try {
    const supabase = createAdminClient()

    // Fetch user profile for targets
    const { data: profile } = await supabase
      .from('profiles')
      .select('targets, preferences')
      .eq('user_id', userId)
      .single()

    if (!profile) {
      return { success: false, error: 'User profile not found' }
    }

    const targets = (profile as any)?.targets || {}
    const preferences = (profile as any)?.preferences || {}
    const dailyCalories = targets.daily_calories || 2000
    const fastingMealsPerDay = preferences.fasting_meals_per_day
    const fastingSelectedMeals = preferences.fasting_selected_meals || []

    // Calculate target calories for this meal slot
    let targetCalories = 0
    if (isFastingMode) {
      // Use normalized distribution based on selected meals (mirrors dashboard logic)
      const fastingDistribution: Record<string, number> = {
        "pre-iftar": 0.1,
        iftar: 0.4,
        "full-meal-taraweeh": 0.3,
        "snack-taraweeh": 0.1,
        suhoor: 0.25,
      }

      const mealsToUse = fastingSelectedMeals.length > 0 
        ? fastingSelectedMeals 
        : Object.keys(fastingDistribution)

      // Validate mealsToUse contains only valid distribution keys
      const invalidMeals = mealsToUse.filter((m: string) => !(m in fastingDistribution))
      if (invalidMeals.length > 0) {
        console.error(`Invalid fasting meals: ${invalidMeals.join(', ')}`)
        return { success: false, error: `Invalid fasting meal types: ${invalidMeals.join(', ')}` }
      }

      // Calculate total percentage and normalize
      const totalPercentage = mealsToUse.reduce(
        (sum: number, meal: string) => sum + (fastingDistribution[meal] || 0),
        0
      )

      // Guard against divide-by-zero
      if (totalPercentage <= 0) {
        console.error('Total percentage is zero or negative', { mealsToUse, totalPercentage })
        return { success: false, error: 'Invalid fasting meal distribution' }
      }

      const normalizedPercentage = (fastingDistribution[mealType] || 0.2) / totalPercentage
      targetCalories = Math.round(dailyCalories * normalizedPercentage)

      if (!fastingDistribution[mealType] && !mealsToUse.includes(mealType)) {
        console.error(`Meal type "${mealType}" not in fasting distribution or selected meals`)
        console.error('Available meals:', mealsToUse)
        return { success: false, error: `Invalid fasting meal type: ${mealType}` }
      }
    } else {
      const mealStructure = targets.meal_structure || [
        { name: 'breakfast', percentage: 25 },
        { name: 'lunch', percentage: 35 },
        { name: 'dinner', percentage: 30 },
        { name: 'snacks', percentage: 10 },
      ]
      const mealSlot = mealStructure.find((m: any) => m.name === mealType)
      if (mealSlot) {
        targetCalories = Math.round(dailyCalories * (mealSlot.percentage / 100))
      } else {
        console.error(`Meal type "${mealType}" not found in regular meal structure`)
        console.error('Available meals:', mealStructure.map((m: any) => m.name))
      }
    }

    if (targetCalories === 0) {
      return { success: false, error: `Could not determine target calories for meal type "${mealType}"` }
    }

    // Fetch all recipes
    const { data: allRecipes, error: recipesError } = await supabase
      .from('recipes')
      .select('id, name, image_url, meal_type, recommendation_group, nutrition_per_serving')
      .eq('is_public', true)
      .not('nutrition_per_serving', 'is', null)

    if (recipesError) {
      return { success: false, error: recipesError.message }
    }

    if (!allRecipes || allRecipes.length === 0) {
      return { success: true, data: [] }
    }

    // Scale and score recipes
    const minScale = 0.5
    const maxScale = 2.0
    const targetMacroPercentages = {
      protein_pct: 30,
      carbs_pct: 40,
      fat_pct: 30,
    }

    const scaledRecipes = []

    for (const recipe of allRecipes) {
      const nutritionData = typeof recipe.nutrition_per_serving === 'string'
        ? JSON.parse(recipe.nutrition_per_serving)
        : recipe.nutrition_per_serving

      const baseCalories = nutritionData?.calories
      if (!baseCalories || baseCalories <= 0) continue

      // Calculate scale factor
      const scaleFactor = targetCalories / baseCalories

      // Check if within acceptable range
      const isWithinCalorieRange = scaleFactor >= minScale && scaleFactor <= maxScale

      // Calculate macro similarity score
      const recipeProtein = nutritionData?.protein_g || 0
      const recipeCarbs = nutritionData?.carbs_g || 0
      const recipeFat = nutritionData?.fat_g || 0

      const proteinPct = Math.round(((recipeProtein * 4) / baseCalories) * 100)
      const carbsPct = Math.round(((recipeCarbs * 4) / baseCalories) * 100)
      const fatPct = Math.round(((recipeFat * 9) / baseCalories) * 100)

      const proteinDiff = Math.abs(targetMacroPercentages.protein_pct - proteinPct)
      const carbsDiff = Math.abs(targetMacroPercentages.carbs_pct - carbsPct)
      const fatDiff = Math.abs(targetMacroPercentages.fat_pct - fatPct)

      const proteinScore = Math.max(0, 100 - proteinDiff * 1.5)
      const carbsScore = Math.max(0, 100 - carbsDiff * 1.5)
      const fatScore = Math.max(0, 100 - fatDiff * 1.5)

      const macroSimilarityScore = Math.round(
        proteinScore * 0.5 + carbsScore * 0.3 + fatScore * 0.2,
      )

      // Out-of-range recipes get lower score
      const finalScore = !isWithinCalorieRange ? -1 : macroSimilarityScore

      scaledRecipes.push({
        id: recipe.id,
        name: recipe.name,
        image_url: recipe.image_url,
        meal_type: recipe.meal_type,
        recommendation_group: recipe.recommendation_group,
        nutrition_per_serving: nutritionData,
        scale_factor: Math.round(scaleFactor * 100) / 100,
        scaled_calories: targetCalories,
        original_calories: baseCalories,
        macro_similarity_score: finalScore,
      })
    }

    // Sort recipes by:
    // 1) Ramadan recommendation (if fasting mode)
    // 2) Macro similarity score
    // 3) Scale factor closest to 1.0
    scaledRecipes.sort((a, b) => {
      if (isFastingMode) {
        const aRamadan = a.recommendation_group?.includes('ramadan') ? 1 : 0
        const bRamadan = b.recommendation_group?.includes('ramadan') ? 1 : 0
        if (bRamadan !== aRamadan) return bRamadan - aRamadan
      }

      const macroScoreDiff = b.macro_similarity_score - a.macro_similarity_score
      if (Math.abs(macroScoreDiff) > 5) return macroScoreDiff

      const aDistFromOne = Math.abs(a.scale_factor - 1)
      const bDistFromOne = Math.abs(b.scale_factor - 1)
      return aDistFromOne - bDistFromOne
    })

    return { success: true, data: scaledRecipes }
  } catch (error) {
    console.error('Error in getScaledRecipesForMeal:', error)
    return { success: false, error: 'Failed to fetch scaled recipes' }
  }
}
