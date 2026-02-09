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
        if (fp['snack-taraweeh']?.recipe_id) recipeIds.add(fp['snack-taraweeh'].recipe_id)
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

    // Fetch user profile with preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id, name, email, basic_info, preferences, created_at, role')
      .eq('user_id', userId)
      .single()

    console.log('User profile:', profile)

    // Extract fasting preferences
    const preferences = (profile as any)?.preferences || {}
    const isFastingMode = preferences.is_fasting || false
    const fastingSelectedMeals = preferences.fasting_selected_meals || []

    return {
      success: true,
      data: {
        plans: plans as AdminUserPlan[],
        recipes,
        profile: profile as AdminUserProfile | null,
        isFastingMode,
        fastingSelectedMeals,
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

    // Update the specific meal
    if (mealType === 'snacks' && snackIndex !== null && snackIndex !== undefined) {
      // Update specific snack in array (regular mode only)
      const snacks = Array.isArray(updatedPlan.snacks) ? [...updatedPlan.snacks] : []
      snacks[snackIndex] = { recipe_id: recipeId, servings: 1 }
      updatedPlan.snacks = snacks
    } else {
      // Update meal (breakfast/lunch/dinner or fasting meals)
      updatedPlan[mealType] = { recipe_id: recipeId, servings: 1 }
    }

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
