/**
 * Meal Planning Server Actions
 * 
 * CRUD operations for daily meal plans integrated with dashboard calendar
 */

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { DailyPlan, DailyTotals, PlanMealSlot, PlanSnackItem } from '@/lib/types/nutri'

type ActionResult<T = void> = 
  | { success: true; data: T }
  | { success: false; error: string }

interface SavePlanMealParams {
  date: string // YYYY-MM-DD format
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'pre-iftar' | 'iftar' | 'full-meal-taraweeh' | 'snack-taraweeh' | 'suhoor'
  recipeId: string
  isFastingMode?: boolean // NEW: Indicates if this is a fasting plan
}

interface RemovePlanMealParams {
  date: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'pre-iftar' | 'iftar' | 'full-meal-taraweeh' | 'snack-taraweeh' | 'suhoor'
  isFastingMode?: boolean // NEW: Indicates if this is a fasting plan
}

/**
 * Save a meal to a daily plan (create or update)
 * Fixed 1 serving per meal slot as per design decision
 */
export async function savePlanMeal(params: SavePlanMealParams): Promise<ActionResult> {
  try {
    console.log('[savePlanMeal] Starting with params:', params)
    
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[savePlanMeal] Auth error:', authError)
      return { success: false, error: 'Not authenticated' }
    }

    console.log('[savePlanMeal] User authenticated:', user.id)
    const { date, mealType, recipeId, isFastingMode = false } = params

    // Use correct plan column based on mode
    const planColumn = isFastingMode ? 'fasting_plan' : 'plan'

    // Get existing plan for this date
    const { data: existingPlan } = await supabase
      .from('daily_plans')
      .select(`${planColumn}, daily_totals`)
      .eq('user_id', user.id)
      .eq('plan_date', date)
      .maybeSingle()

    console.log('[savePlanMeal] Existing plan:', existingPlan)

    // Build the meal object (fixed 1 serving)
    const meal: PlanMealSlot = {
      recipe_id: recipeId,
      servings: 1, // Fixed as per design decision
    }

    let updatedPlan: DailyPlan

    if (existingPlan) {
      // Update existing plan
      updatedPlan = (existingPlan as any)[planColumn] as DailyPlan

      if (mealType === 'snacks' || mealType === 'snack-taraweeh') {
        // Snacks are stored as array; currently we overwrite with the new snack
        updatedPlan[mealType] = [{
          recipe_id: meal.recipe_id,
          servings: meal.servings,
        }]
      } else {
        // All other meals are single slots
        updatedPlan[mealType] = meal
      }
    } else {
      // Create new plan
      if (mealType === 'snacks' || mealType === 'snack-taraweeh') {
        updatedPlan = {
          [mealType]: [{
            recipe_id: meal.recipe_id,
            servings: meal.servings,
          }],
        }
      } else {
        updatedPlan = {
          [mealType]: meal,
        }
      }
    }

    // Calculate daily totals
    const updatedTotals = await calculateDailyTotals(updatedPlan)
    console.log('[savePlanMeal] Calculated totals:', updatedTotals)

    // Upsert the plan to correct column
    console.log('[savePlanMeal] Upserting plan:', { user_id: user.id, plan_date: date, [planColumn]: updatedPlan })
    const { error: upsertError } = await supabase
      .from('daily_plans')
      .upsert({
        user_id: user.id,
        plan_date: date,
        [planColumn]: updatedPlan,
        daily_totals: updatedTotals,
      }, {
        onConflict: 'user_id,plan_date',
      })

    if (upsertError) {
      console.error('[savePlanMeal] Upsert error:', upsertError)
      return { success: false, error: 'Failed to save meal to plan' }
    }

    console.log('[savePlanMeal] Success! Revalidating paths...')
    // Revalidate dashboard to show updated indicators
    revalidatePath('/dashboard')
    revalidatePath(`/dashboard?date=${date}`)

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Unexpected error saving plan meal:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Remove a meal from a daily plan
 */
export async function removePlanMeal(params: RemovePlanMealParams): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { date, mealType, isFastingMode = false } = params

    // Use correct plan column based on mode
    const planColumn = isFastingMode ? 'fasting_plan' : 'plan'

    // Get existing plan
    const { data: existingPlan } = await supabase
      .from('daily_plans')
      .select(`${planColumn}, daily_totals`)
      .eq('user_id', user.id)
      .eq('plan_date', date)
      .maybeSingle()

    if (!existingPlan) {
      return { success: false, error: 'Plan not found' }
    }

    const updatedPlan = (existingPlan as any)[planColumn] as DailyPlan

    // Remove the meal
    if (mealType === 'snacks' || mealType === 'snack-taraweeh') {
      updatedPlan[mealType] = undefined
    } else {
      updatedPlan[mealType] = undefined
    }

    // Check if plan is now empty - handle both regular and fasting modes
    const hasAnyMeals = isFastingMode 
      ? !!(
          updatedPlan['pre-iftar']?.recipe_id ||
          updatedPlan.iftar?.recipe_id ||
          updatedPlan['full-meal-taraweeh']?.recipe_id ||
          (updatedPlan['snack-taraweeh'] && updatedPlan['snack-taraweeh'].length > 0) ||
          updatedPlan.suhoor?.recipe_id
        )
      : !!(
          updatedPlan.breakfast?.recipe_id ||
          updatedPlan.lunch?.recipe_id ||
          updatedPlan.dinner?.recipe_id ||
          (updatedPlan.snacks && updatedPlan.snacks.length > 0)
        )

    if (!hasAnyMeals) {
      // Delete the entire plan if empty
      const { error: deleteError } = await supabase
        .from('daily_plans')
        .delete()
        .eq('user_id', user.id)
        .eq('plan_date', date)

      if (deleteError) {
        console.error('Error deleting empty plan:', deleteError)
        return { success: false, error: 'Failed to delete plan' }
      }
    } else {
      // Update with removed meal
      const updatedTotals = await calculateDailyTotals(updatedPlan)

      const { error: updateError } = await supabase
        .from('daily_plans')
        .update({
          [planColumn]: updatedPlan,
          daily_totals: updatedTotals,
        })
        .eq('user_id', user.id)
        .eq('plan_date', date)

      if (updateError) {
        console.error('Error updating plan:', updateError)
        return { success: false, error: 'Failed to update plan' }
      }
    }

    revalidatePath('/dashboard')
    revalidatePath(`/dashboard?date=${date}`)

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Unexpected error removing plan meal:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Delete an entire daily plan
 */
export async function deletePlan(date: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error: deleteError } = await supabase
      .from('daily_plans')
      .delete()
      .eq('user_id', user.id)
      .eq('plan_date', date)

    if (deleteError) {
      console.error('Error deleting plan:', deleteError)
      return { success: false, error: 'Failed to delete plan' }
    }

    revalidatePath('/dashboard')
    revalidatePath(`/dashboard?date=${date}`)

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Unexpected error deleting plan:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get a daily plan for a specific date
 */
export async function getPlan(date: string, isFastingMode = false): Promise<ActionResult<DailyPlan | null>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Use correct plan column based on mode
    const planColumn = isFastingMode ? 'fasting_plan' : 'plan'

    const { data: planData } = await supabase
      .from('daily_plans')
      .select(planColumn)
      .eq('user_id', user.id)
      .eq('plan_date', date)
      .maybeSingle()

    return { success: true, data: (planData as any)?.[planColumn] as DailyPlan || null }
  } catch (error) {
    console.error('Unexpected error getting plan:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Calculate daily nutrition totals from a plan
 */
async function calculateDailyTotals(plan: DailyPlan): Promise<DailyTotals> {
  const supabase = await createClient()

  let totalCalories = 0
  let totalProtein = 0
  let totalCarbs = 0
  let totalFat = 0

  // All single-slot meal types (both regular and fasting)
  const singleSlotMeals = ['breakfast', 'lunch', 'dinner', 'pre-iftar', 'iftar', 'full-meal-taraweeh', 'suhoor'] as const

  for (const mealType of singleSlotMeals) {
    const meal = (plan as any)[mealType] as PlanMealSlot | undefined
    if (meal && meal.recipe_id) {
      const { data: recipe } = await supabase
        .from('recipes')
        .select('nutrition_per_serving')
        .eq('id', meal.recipe_id)
        .single()

      if (recipe?.nutrition_per_serving) {
        const nutrition = recipe.nutrition_per_serving as any
        const servings = meal.servings || 1

        totalCalories += (nutrition.calories || 0) * servings
        totalProtein += (nutrition.protein_g || 0) * servings
        totalCarbs += (nutrition.carbs_g || 0) * servings
        totalFat += (nutrition.fat_g || 0) * servings
      }
    }
  }

  // All array-slot meal types (snacks for regular, snack-taraweeh for fasting)
  const arraySlotMeals = ['snacks', 'snack-taraweeh'] as const

  for (const mealType of arraySlotMeals) {
    const snackArray = (plan as any)[mealType] as PlanSnackItem[] | undefined
    if (snackArray && Array.isArray(snackArray)) {
      for (const snack of snackArray) {
        if (snack.recipe_id) {
          const { data: recipe } = await supabase
            .from('recipes')
            .select('nutrition_per_serving')
            .eq('id', snack.recipe_id)
            .single()

          if (recipe?.nutrition_per_serving) {
            const nutrition = recipe.nutrition_per_serving as any
            const servings = snack.servings || 1

            totalCalories += (nutrition.calories || 0) * servings
            totalProtein += (nutrition.protein_g || 0) * servings
            totalCarbs += (nutrition.carbs_g || 0) * servings
            totalFat += (nutrition.fat_g || 0) * servings
          }
        }
      }
    }
  }

  return {
    calories: Math.round(totalCalories),
    protein_g: Math.round(totalProtein * 10) / 10,
    carbs_g: Math.round(totalCarbs * 10) / 10,
    fat_g: Math.round(totalFat * 10) / 10,
  }
}
