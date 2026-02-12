'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { DailyPlan, DailyTotals, PlanMealSlot, PlanSnackItem, RecipeNutrition } from '@/lib/types/nutri'

interface SaveMealToPlanParams {
  date: string // YYYY-MM-DD format
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'pre-iftar' | 'iftar' | 'full-meal-taraweeh' | 'snack-taraweeh' | 'suhoor'
  recipeId: string
  servings: number
  swappedIngredients?: Record<string, { ingredient_id: string; name: string; quantity: number; unit: string }>
  isFastingMode?: boolean // NEW: Indicates if this is a fasting plan
}

type SaveResult = { success: true } | { success: false; error: string }

/**
 * Save or update a meal in the user's daily plan
 * Saves to 'plan' column for regular mode, 'fasting_plan' column for fasting mode
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
    const { date, mealType, recipeId, servings, swappedIngredients, isFastingMode } = params
    console.log('Recipe ID to save:', recipeId)
    console.log('Fasting mode:', isFastingMode)

    // Determine which plan column to use (always use daily_totals for totals)
    const planColumn = isFastingMode ? 'fasting_plan' : 'plan'

    // Get existing plan for this date
    const { data: existingPlan } = await supabase
      .from('daily_plans')
      .select(`${planColumn}, daily_totals, mode`)
      .eq('user_id', user.id)
      .eq('plan_date', date)
      .maybeSingle()

    // Build the meal object matching PlanMealSlot type
    const hasSwaps = !!swappedIngredients && Object.keys(swappedIngredients).length > 0

    const meal: PlanMealSlot = {
      recipe_id: recipeId,
      servings,
      swapped: hasSwaps || undefined,
      swapped_ingredients: hasSwaps ? swappedIngredients : undefined,
    }

    type SnackRecipeItem = PlanSnackItem & Pick<PlanMealSlot, 'swapped' | 'swapped_ingredients'>

    let updatedPlan: DailyPlan
    let updatedTotals: DailyTotals

    if (existingPlan) {
      // Update existing plan
      const plan = ((existingPlan as any)[planColumn] || {}) as DailyPlan

      if (mealType === 'snacks') {
        // Keep snacks stored as an array (schema convention). Update the first snack slot.
        const nextSnacks: SnackRecipeItem[] = Array.isArray(plan.snacks) ? [...(plan.snacks as SnackRecipeItem[])] : []
        nextSnacks[0] = {
          ...(nextSnacks[0] || {}),
          recipe_id: meal.recipe_id,
          servings: meal.servings,
          swapped: meal.swapped,
          swapped_ingredients: meal.swapped_ingredients,
        }
        plan.snacks = nextSnacks
      } else {
        ;(plan as any)[mealType] = meal
      }

      // Recalculate totals
      updatedTotals = await calculateDailyTotals(plan)
      updatedPlan = plan
    } else {
      // Create new plan
      if (mealType === 'snacks') {
        updatedPlan = {
          snacks: [
            {
              recipe_id: meal.recipe_id,
              servings: meal.servings,
              swapped: meal.swapped,
              swapped_ingredients: meal.swapped_ingredients,
            } as SnackRecipeItem,
          ],
        } as DailyPlan
      } else {
        updatedPlan = {
          [mealType]: meal,
        } as DailyPlan
      }

      updatedTotals = await calculateDailyTotals(updatedPlan)
    }

    // Upsert the plan - use dynamic column names based on mode
    const upsertData: any = {
      user_id: user.id,
      plan_date: date,
    }
    upsertData[planColumn] = updatedPlan
    upsertData['daily_totals'] = updatedTotals // Always use daily_totals, not fasting_daily_totals

    const { error: upsertError } = await supabase
      .from('daily_plans')
      .upsert(upsertData, {
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

      if (recipe && recipe.nutrition_per_serving) {
        const nutrition = recipe.nutrition_per_serving as unknown as RecipeNutrition
        const servings = meal.servings || 1
        totalCalories += Math.round((nutrition.calories || 0) * servings)
        totalProtein += Math.round((nutrition.protein_g || 0) * servings)
        totalCarbs += Math.round((nutrition.carbs_g || 0) * servings)
        totalFat += Math.round((nutrition.fat_g || 0) * servings)
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

          if (recipe && recipe.nutrition_per_serving) {
            const nutrition = recipe.nutrition_per_serving as unknown as RecipeNutrition
            const servings = snack.servings || 1
            totalCalories += Math.round((nutrition.calories || 0) * servings)
            totalProtein += Math.round((nutrition.protein_g || 0) * servings)
            totalCarbs += Math.round((nutrition.carbs_g || 0) * servings)
            totalFat += Math.round((nutrition.fat_g || 0) * servings)
          }
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
    // Fasting meals
    'pre-iftar'?: { recipeId: string; servings: number }
    iftar?: { recipeId: string; servings: number }
    'full-meal-taraweeh'?: { recipeId: string; servings: number }
    'snack-taraweeh'?: { recipeId: string; servings: number }
    suhoor?: { recipeId: string; servings: number }
  }
  isFastingMode?: boolean // NEW: Indicates if this is a fasting plan
}): Promise<SaveResult> {
  try {
    console.log('=== saveFullDayPlan called ===')
    console.log('Params:', JSON.stringify(params, null, 2))
    
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { date, meals, isFastingMode } = params

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
    
    // Regular meals
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

    // Fasting meals
    if (meals['pre-iftar']) {
      (plan as any)['pre-iftar'] = {
        recipe_id: meals['pre-iftar'].recipeId,
        servings: meals['pre-iftar'].servings,
      }
    }

    if (meals.iftar) {
      (plan as any).iftar = {
        recipe_id: meals.iftar.recipeId,
        servings: meals.iftar.servings,
      }
    }

    if (meals['full-meal-taraweeh']) {
      (plan as any)['full-meal-taraweeh'] = {
        recipe_id: meals['full-meal-taraweeh'].recipeId,
        servings: meals['full-meal-taraweeh'].servings,
      }
    }

    if (meals['snack-taraweeh']) {
      (plan as any)['snack-taraweeh'] = {
        recipe_id: meals['snack-taraweeh'].recipeId,
        servings: meals['snack-taraweeh'].servings,
      }
    }

    if (meals.suhoor) {
      (plan as any).suhoor = {
        recipe_id: meals.suhoor.recipeId,
        servings: meals.suhoor.servings,
      }
    }

    // Calculate totals
    const dailyTotals = await calculateDailyTotals(plan)

    // Insert the plan - use appropriate columns based on mode
    const insertData: any = {
      user_id: user.id,
      plan_date: date,
    }

    if (isFastingMode) {
      insertData.fasting_plan = plan
    } else {
      insertData.plan = plan
    }
    // Always use daily_totals (no separate fasting_daily_totals column)
    insertData.daily_totals = dailyTotals

    const { error: insertError } = await supabase
      .from('daily_plans')
      .insert(insertData)

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
