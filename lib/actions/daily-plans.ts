'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { DailyPlan, DailyTotals } from '@/lib/types/nutri'

interface SaveMealToPlanParams {
  date: string // YYYY-MM-DD format
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks'
  recipeId: string
  servings: number
  swappedIngredients?: Record<string, { ingredient_id: string; name: string; quantity: number; unit: string }>
}

type SaveResult = { success: true } | { success: false; error: string }

/**
 * Save or update a meal in the user's daily plan
 */
export async function saveMealToPlan(params: SaveMealToPlanParams): Promise<SaveResult> {
  try {
    console.log('=== saveMealToPlan called ===')
    console.log('Params:', JSON.stringify(params, null, 2))
    
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Auth error:', authError)
      return { success: false, error: 'Not authenticated' }
    }

    console.log('User authenticated:', user.id)
    const { date, mealType, recipeId, servings, swappedIngredients } = params
    console.log('Recipe ID to save:', recipeId)

    // Get existing plan for this date
    const { data: existingPlan } = await supabase
      .from('daily_plans')
      .select('plan, daily_totals')
      .eq('user_id', user.id)
      .eq('plan_date', date)
      .maybeSingle()

    // Build the meal object matching PlanMealSlot type
    const meal: any = {
      recipe_id: recipeId,
      servings,
      swapped: swappedIngredients && Object.keys(swappedIngredients).length > 0,
      swapped_ingredients: swappedIngredients || undefined,
    }

    let updatedPlan: DailyPlan
    let updatedTotals: DailyTotals

    if (existingPlan) {
      // Update existing plan
      const plan = existingPlan.plan as DailyPlan
      plan[mealType] = meal

      // Recalculate totals
      updatedTotals = await calculateDailyTotals(plan)
      updatedPlan = plan
    } else {
      // Create new plan
      updatedPlan = {
        [mealType]: meal,
      } as DailyPlan

      updatedTotals = await calculateDailyTotals(updatedPlan)
    }

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
      console.error('Error saving meal to plan:', upsertError)
      return { success: false, error: 'Failed to save meal' }
    }

    // Revalidate the dashboard to show updated meal
    revalidatePath('/dashboard')
    revalidatePath('/meal-builder')

    return { success: true }
  } catch (error) {
    console.error('Unexpected error saving meal:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Calculate daily totals from a plan
 * Note: This is a simplified version that will be recalculated on page load
 * with actual recipe nutrition data
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

      if (recipe && recipe.nutrition_per_serving) {
        const nutrition = recipe.nutrition_per_serving as any
        totalCalories += Math.round((nutrition.calories || 0) * meal.servings)
        totalProtein += Math.round((nutrition.protein_g || 0) * meal.servings)
        totalCarbs += Math.round((nutrition.carbs_g || 0) * meal.servings)
        totalFat += Math.round((nutrition.fat_g || 0) * meal.servings)
      }
    }
  }

  // Handle snacks (array of items)
  if (plan.snacks && Array.isArray(plan.snacks)) {
    for (const snack of plan.snacks) {
      if (snack.recipe_id) {
        const { data: recipe } = await supabase
          .from('recipes')
          .select('nutrition_per_serving')
          .eq('id', snack.recipe_id)
          .single()

        if (recipe && recipe.nutrition_per_serving) {
          const nutrition = recipe.nutrition_per_serving as any
          const servings = snack.servings || 1
          totalCalories += Math.round((nutrition.calories || 0) * servings)
          totalProtein += Math.round((nutrition.protein_g || 0) * servings)
          totalCarbs += Math.round((nutrition.carbs_g || 0) * servings)
          totalFat += Math.round((nutrition.fat_g || 0) * servings)
        }
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

/**
 * Remove a meal from the daily plan
 */
export async function removeMealFromPlan(date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks'): Promise<SaveResult> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

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

    const plan = existingPlan.plan as DailyPlan
    delete plan[mealType]

    // Recalculate totals
    const updatedTotals = await calculateDailyTotals(plan)

    // Update the plan
    const { error: updateError } = await supabase
      .from('daily_plans')
      .update({
        plan,
        daily_totals: updatedTotals,
      })
      .eq('user_id', user.id)
      .eq('plan_date', date)

    if (updateError) {
      return { success: false, error: 'Failed to remove meal' }
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Unexpected error removing meal:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Save the entire meal plan for a day
 * Used to initialize today's plan with the default recipes shown on dashboard
 */
export async function saveFullDayPlan(params: {
  date: string
  meals: {
    breakfast?: { recipeId: string; servings: number }
    lunch?: { recipeId: string; servings: number }
    dinner?: { recipeId: string; servings: number }
    snacks?: { recipeId: string; servings: number }
  }
}): Promise<SaveResult> {
  try {
    console.log('=== saveFullDayPlan called ===')
    console.log('Params:', JSON.stringify(params, null, 2))
    
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { date, meals } = params

    // Check if plan already exists for this date
    const { data: existingPlan } = await supabase
      .from('daily_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('plan_date', date)
      .maybeSingle()

    // Don't overwrite existing plan
    if (existingPlan) {
      console.log('Plan already exists for this date, skipping')
      return { success: true }
    }

    // Build the plan object
    const plan: DailyPlan = {}
    
    if (meals.breakfast) {
      plan.breakfast = {
        recipe_id: meals.breakfast.recipeId,
        servings: meals.breakfast.servings,
      }
    }
    
    if (meals.lunch) {
      plan.lunch = {
        recipe_id: meals.lunch.recipeId,
        servings: meals.lunch.servings,
      }
    }
    
    if (meals.dinner) {
      plan.dinner = {
        recipe_id: meals.dinner.recipeId,
        servings: meals.dinner.servings,
      }
    }
    
    if (meals.snacks) {
      plan.snacks = [{
        recipe_id: meals.snacks.recipeId,
        servings: meals.snacks.servings,
      }]
    }

    // Calculate totals
    const dailyTotals = await calculateDailyTotals(plan)

    // Insert the plan
    const { error: insertError } = await supabase
      .from('daily_plans')
      .insert({
        user_id: user.id,
        plan_date: date,
        plan,
        daily_totals: dailyTotals,
      })

    if (insertError) {
      console.error('Error saving full day plan:', insertError)
      return { success: false, error: 'Failed to save plan' }
    }

    console.log('Full day plan saved successfully')
    revalidatePath('/dashboard')
    
    return { success: true }
  } catch (error) {
    console.error('Unexpected error saving full day plan:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
