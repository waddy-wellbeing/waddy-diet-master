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
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks'
  recipeId: string
}

interface RemovePlanMealParams {
  date: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks'
}

/**
 * Save a meal to a daily plan (create or update)
 * Fixed 1 serving per meal slot as per design decision
 */
export async function savePlanMeal(params: SavePlanMealParams): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { date, mealType, recipeId } = params

    // Get existing plan for this date
    const { data: existingPlan } = await supabase
      .from('daily_plans')
      .select('plan, daily_totals')
      .eq('user_id', user.id)
      .eq('plan_date', date)
      .maybeSingle()

    // Build the meal object (fixed 1 serving)
    const meal: PlanMealSlot = {
      recipe_id: recipeId,
      servings: 1, // Fixed as per design decision
    }

    let updatedPlan: DailyPlan

    if (existingPlan) {
      // Update existing plan
      updatedPlan = existingPlan.plan as DailyPlan

      if (mealType === 'snacks') {
        // Snacks are stored as array; currently we overwrite with the new snack
        updatedPlan.snacks = [{
          recipe_id: meal.recipe_id,
          servings: meal.servings,
        }]
      } else {
        // Breakfast, lunch, dinner are single slots
        updatedPlan[mealType] = meal
      }
    } else {
      // Create new plan
      if (mealType === 'snacks') {
        updatedPlan = {
          snacks: [{
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

    // Upsert the plan
    const { error: upsertError } = await supabase
      .from('daily_plans')
      .upsert({
        user_id: user.id,
        plan_date: date,
        plan: updatedPlan,
        daily_totals: updatedTotals,
      }, {
        onConflict: 'user_id,plan_date',
      })

    if (upsertError) {
      return { success: false, error: 'Failed to save meal to plan' }
    }

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

    const { date, mealType } = params

    // Get existing plan
    const { data: existingPlan } = await supabase
      .from('daily_plans')
      .select('plan, daily_totals')
      .eq('user_id', user.id)
      .eq('plan_date', date)
      .maybeSingle()

    if (!existingPlan) {
      return { success: false, error: 'Plan not found' }
    }

    const updatedPlan = existingPlan.plan as DailyPlan

    // Remove the meal
    if (mealType === 'snacks') {
      updatedPlan.snacks = undefined
    } else {
      updatedPlan[mealType] = undefined
    }

    // Check if plan is now empty
    const hasAnyMeals = !!(
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
          plan: updatedPlan,
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
 * Recipe info returned with plan (minimal data for display)
 */
export interface PlanRecipeInfo {
  id: string
  name: string
  image_url: string | null
  nutrition_per_serving: { calories?: number } | null
}

/**
 * Get a daily plan for a specific date
 * Returns both the plan and recipe info for all recipes in the plan
 */
export async function getPlan(date: string): Promise<ActionResult<{ plan: DailyPlan | null; recipes: Record<string, PlanRecipeInfo> }>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: planData } = await supabase
      .from('daily_plans')
      .select('plan')
      .eq('user_id', user.id)
      .eq('plan_date', date)
      .maybeSingle()

    const plan = planData?.plan as DailyPlan || null
    const recipes: Record<string, PlanRecipeInfo> = {}

    // If we have a plan, fetch recipe info for all recipes in it
    if (plan) {
      const recipeIds: string[] = []
      
      // Collect all recipe IDs from the plan
      if (plan.breakfast?.recipe_id) recipeIds.push(plan.breakfast.recipe_id)
      if (plan.lunch?.recipe_id) recipeIds.push(plan.lunch.recipe_id)
      if (plan.dinner?.recipe_id) recipeIds.push(plan.dinner.recipe_id)
      if (plan.snacks) {
        for (const snack of plan.snacks) {
          if (snack.recipe_id) recipeIds.push(snack.recipe_id)
        }
      }

      // Fetch recipe info for all IDs
      if (recipeIds.length > 0) {
        const { data: recipeData } = await supabase
          .from('recipes')
          .select('id, name, image_url, nutrition_per_serving')
          .in('id', recipeIds)

        if (recipeData) {
          for (const recipe of recipeData) {
            recipes[recipe.id] = {
              id: recipe.id,
              name: recipe.name,
              image_url: recipe.image_url,
              nutrition_per_serving: recipe.nutrition_per_serving as { calories?: number } | null,
            }
          }
        }
      }
    }

    return { success: true, data: { plan, recipes } }
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

  // Calculate for breakfast, lunch, dinner
  for (const mealType of ['breakfast', 'lunch', 'dinner'] as const) {
    const meal = plan[mealType]
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

  // Calculate for snacks
  if (plan.snacks && Array.isArray(plan.snacks)) {
    for (const snack of plan.snacks) {
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

  return {
    calories: Math.round(totalCalories),
    protein_g: Math.round(totalProtein * 10) / 10,
    carbs_g: Math.round(totalCarbs * 10) / 10,
    fat_g: Math.round(totalFat * 10) / 10,
  }
}
