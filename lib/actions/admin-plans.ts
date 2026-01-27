'use server'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Calculate daily totals from a plan (admin version using admin client)
 */
async function calculateDailyTotals(plan: AdminUserPlan['plan']): Promise<{
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}> {
  const supabase = createAdminClient()
  
  let totalCalories = 0
  let totalProtein = 0
  let totalCarbs = 0
  let totalFat = 0

  // Collect all recipe IDs
  const recipeIds: string[] = []
  
  if (plan.breakfast?.recipe_id) recipeIds.push(plan.breakfast.recipe_id)
  if (plan.lunch?.recipe_id) recipeIds.push(plan.lunch.recipe_id)
  if (plan.dinner?.recipe_id) recipeIds.push(plan.dinner.recipe_id)
  if (plan.snacks) {
    for (const snack of plan.snacks) {
      if (snack?.recipe_id) recipeIds.push(snack.recipe_id)
    }
  }

  if (recipeIds.length === 0) {
    return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  }

  // Fetch all recipes in one query
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, nutrition_per_serving')
    .in('id', recipeIds)

  if (!recipes) {
    return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  }

  // Create lookup map
  const nutritionMap: Record<string, { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number }> = {}
  for (const recipe of recipes) {
    nutritionMap[recipe.id] = recipe.nutrition_per_serving || {}
  }

  // Calculate totals for breakfast, lunch, dinner
  for (const mealType of ['breakfast', 'lunch', 'dinner'] as const) {
    const meal = plan[mealType]
    if (meal?.recipe_id && nutritionMap[meal.recipe_id]) {
      const nutrition = nutritionMap[meal.recipe_id]
      const servings = meal.servings || 1
      totalCalories += Math.round((nutrition.calories || 0) * servings)
      totalProtein += Math.round((nutrition.protein_g || 0) * servings)
      totalCarbs += Math.round((nutrition.carbs_g || 0) * servings)
      totalFat += Math.round((nutrition.fat_g || 0) * servings)
    }
  }

  // Calculate totals for snacks
  if (plan.snacks && Array.isArray(plan.snacks)) {
    for (const snack of plan.snacks) {
      if (snack?.recipe_id && nutritionMap[snack.recipe_id]) {
        const nutrition = nutritionMap[snack.recipe_id]
        const servings = snack.servings || 1
        totalCalories += Math.round((nutrition.calories || 0) * servings)
        totalProtein += Math.round((nutrition.protein_g || 0) * servings)
        totalCarbs += Math.round((nutrition.carbs_g || 0) * servings)
        totalFat += Math.round((nutrition.fat_g || 0) * servings)
      }
    }
  }

  return {
    calories: totalCalories,
    protein_g: totalProtein,
    carbs_g: totalCarbs,
    fat_g: totalFat,
  }
}

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

    // Fetch user's plans
    const { data: plans, error: plansError } = await supabase
      .from('daily_plans')
      .select('id, plan_date, plan, daily_totals')
      .eq('user_id', userId)
      .gte('plan_date', startDateStr)
      .lte('plan_date', endDateStr)
      .order('plan_date', { ascending: false })

    if (plansError) {
      console.error('Error fetching plans:', plansError)
      return { success: false, error: plansError.message }
    }

    // Extract all unique recipe IDs from plans
    const recipeIds = new Set<string>()
    for (const plan of plans || []) {
      const p = plan.plan as AdminUserPlan['plan']
      if (p?.breakfast?.recipe_id) recipeIds.add(p.breakfast.recipe_id)
      if (p?.lunch?.recipe_id) recipeIds.add(p.lunch.recipe_id)
      if (p?.dinner?.recipe_id) recipeIds.add(p.dinner.recipe_id)
      if (p?.snacks) {
        for (const snack of p.snacks) {
          if (snack?.recipe_id) recipeIds.add(snack.recipe_id)
        }
      }
    }

    // Fetch recipe info for all recipe IDs
    const recipes: Record<string, AdminRecipeInfo> = {}
    if (recipeIds.size > 0) {
      const { data: recipeData, error: recipesError } = await supabase
        .from('recipes')
        .select('id, name, image_url, nutrition_per_serving')
        .in('id', Array.from(recipeIds))

      if (recipesError) {
        console.error('Error fetching recipes:', recipesError)
      } else if (recipeData) {
        for (const recipe of recipeData) {
          recipes[recipe.id] = recipe as AdminRecipeInfo
        }
      }
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id, name, email, basic_info, created_at, role')
      .eq('user_id', userId)
      .single()

    return {
      success: true,
      data: {
        plans: plans as AdminUserPlan[],
        recipes,
        profile: profile as AdminUserProfile | null,
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

    // Fetch the specific day's plan
    const { data: plan, error: planError } = await supabase
      .from('daily_plans')
      .select('id, plan_date, plan, daily_totals')
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

    // Extract recipe IDs
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
 */
export async function updateUserMeal({
  userId,
  planDate,
  mealType,
  recipeId,
  snackIndex,
}: {
  userId: string
  planDate: string
  mealType: string
  recipeId: string
  snackIndex?: number | null
}): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = createAdminClient()

    // Get existing plan
    const { data: existingPlan } = await supabase
      .from('daily_plans')
      .select('plan, daily_totals')
      .eq('user_id', userId)
      .eq('plan_date', planDate)
      .maybeSingle()

    // Build updated plan
    const currentPlan = (existingPlan?.plan as any) || {}
    const updatedPlan = { ...currentPlan }

    // Update the specific meal
    if (mealType === 'snacks' && snackIndex !== null && snackIndex !== undefined) {
      // Update specific snack in array
      const snacks = Array.isArray(updatedPlan.snacks) ? [...updatedPlan.snacks] : []
      snacks[snackIndex] = { recipe_id: recipeId, servings: 1 }
      updatedPlan.snacks = snacks
    } else {
      // Update breakfast/lunch/dinner
      updatedPlan[mealType] = { recipe_id: recipeId, servings: 1 }
    }

    // Calculate daily totals
    const dailyTotals = await calculateDailyTotals(updatedPlan)

    // Save to database with conflict resolution on user_id + plan_date
    const { error } = await supabase
      .from('daily_plans')
      .upsert(
        {
          user_id: userId,
          plan_date: planDate,
          plan: updatedPlan,
          daily_totals: dailyTotals,
        },
        {
          onConflict: 'user_id,plan_date', // Specify unique constraint columns
        }
      )

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

    // Calculate daily totals
    const dailyTotals = await calculateDailyTotals(plan)

    // Insert new plan (should not exist for unplanned days)
    const { error } = await supabase
      .from('daily_plans')
      .insert({
        user_id: userId,
        plan_date: planDate,
        plan,
        daily_totals: dailyTotals,
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
