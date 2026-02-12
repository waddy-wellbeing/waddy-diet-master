'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getFastingTemplate } from '@/lib/config/fasting-templates'
import type { DailyPlan, DailyTotals, PlanMealSlot, MealSlot } from '@/lib/types/nutri'

type SaveResult = { success: true } | { success: false; error: string }

/**
 * Save fasting meal plan for a specific date (explicit user action)
 * Called when user clicks save button in dashboard (same flow as regular mode)
 * Mirrors the regular plan generation logic but uses fasting templates
 * 
 * NOTE: This is NOT auto-called on toggle. User must explicitly save their fasting plan.
 * Dashboard shows RECOMMENDATIONS until user saves.
 * 
 * @param userId - The user's ID
 * @param planDate - The date to save plan for (YYYY-MM-DD)
 * @returns Success/error result
 */
export async function generateFastingPlan(
  userId: string,
  planDate: string
): Promise<SaveResult> {
  try {
    console.log('=== generateFastingPlan called ===')
    console.log('User ID:', userId, 'Date:', planDate)
    
    const supabase = await createClient()

    // 1. Get user's targets and preferences
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('targets, preferences')
      .eq('user_id', userId)
      .single()

    if (profileError) {
      return { success: false, error: profileError.message }
    }

    const dailyCalories = profile.targets?.daily_calories
    const fastingMealsPerDay = profile.preferences?.fasting_meals_per_day

    if (!dailyCalories) {
      return { 
        success: false, 
        error: 'Missing daily_calories in user targets' 
      }
    }

    if (!fastingMealsPerDay) {
      return { 
        success: false, 
        error: 'Missing fasting_meals_per_day in user preferences' 
      }
    }

    console.log('Daily calories:', dailyCalories)
    console.log('Fasting meals per day:', fastingMealsPerDay)

    // 2. Get fasting template based on meal count
    const template = getFastingTemplate(fastingMealsPerDay)
    if (!template) {
      return { 
        success: false, 
        error: `No fasting template found for ${fastingMealsPerDay} meals` 
      }
    }

    console.log('Fasting template:', template)

    // 3. Calculate target calories per meal
    const fastingMealsWithCalories = template.map(meal => ({
      ...meal,
      target_calories: Math.round(dailyCalories * (meal.percentage / 100))
    }))

    console.log('Fasting meals with calculated calories:', fastingMealsWithCalories)

    // 4. Fetch all public recipes (we'll add filtering later)
    const { data: allRecipes, error: recipesError } = await supabase
      .from('recipes')
      .select(`
        id,
        name,
        meal_type,
        nutrition_per_serving
      `)
      .eq('is_public', true)
      .not('nutrition_per_serving', 'is', null)

    if (recipesError) {
      return { success: false, error: recipesError.message }
    }

    if (!allRecipes || allRecipes.length === 0) {
      return { success: false, error: 'No recipes available' }
    }

    console.log('Found recipes:', allRecipes.length)

    // 5. Assign recipes to each fasting meal
    // For now, we'll use a simple approach without meal type filtering
    const assignedPlan: Record<string, PlanMealSlot> = {}

    const minScale = 0.5
    const maxScale = 2.0

    for (const meal of fastingMealsWithCalories) {
      const targetCalories = meal.target_calories!
      const mealName = meal.name // e.g., 'iftar', 'suhoor', 'pre-iftar'

      // Find suitable recipes (skip meal type filtering for now as requested)
      const suitableRecipes: Array<{
        id: string
        scaleFactor: number
        macroScore: number
      }> = []

      for (const recipe of allRecipes) {
        const baseCalories = recipe.nutrition_per_serving?.calories
        if (!baseCalories || baseCalories <= 0) continue

        // Calculate scale factor to hit exact target calories
        const scaleFactor = targetCalories / baseCalories

        // Check if scaling is within acceptable limits
        if (scaleFactor < minScale || scaleFactor > maxScale) continue

        // Calculate macro similarity score (simplified for now)
        const recipeProtein = recipe.nutrition_per_serving?.protein_g || 0
        const recipeCarbs = recipe.nutrition_per_serving?.carbs_g || 0
        const recipeFat = recipe.nutrition_per_serving?.fat_g || 0

        const proteinPct = Math.round(((recipeProtein * 4) / baseCalories) * 100)
        const carbsPct = Math.round(((recipeCarbs * 4) / baseCalories) * 100)
        const fatPct = Math.round(((recipeFat * 9) / baseCalories) * 100)

        // Simple scoring: prefer balanced recipes (around 30% protein, 40% carbs, 30% fat)
        const proteinScore = Math.max(0, 100 - Math.abs(30 - proteinPct) * 1.5)
        const carbsScore = Math.max(0, 100 - Math.abs(40 - carbsPct) * 1.5)
        const fatScore = Math.max(0, 100 - Math.abs(30 - fatPct) * 1.5)

        const macroScore = Math.round(
          proteinScore * 0.5 + carbsScore * 0.3 + fatScore * 0.2
        )

        suitableRecipes.push({
          id: recipe.id,
          scaleFactor,
          macroScore
        })
      }

      // Sort by: 1) Macro score (descending), 2) Scale factor closest to 1.0
      suitableRecipes.sort((a, b) => {
        const scoreDiff = b.macroScore - a.macroScore
        if (Math.abs(scoreDiff) > 5) return scoreDiff

        const aDistFromOne = Math.abs(a.scaleFactor - 1)
        const bDistFromOne = Math.abs(b.scaleFactor - 1)
        return aDistFromOne - bDistFromOne
      })

      // Assign the best recipe to this meal
      if (suitableRecipes.length > 0) {
        const bestRecipe = suitableRecipes[0]
        assignedPlan[mealName] = {
          recipe_id: bestRecipe.id,
          servings: Math.round(bestRecipe.scaleFactor * 100) / 100
        }
        console.log(`Assigned ${mealName}:`, bestRecipe.id, `scale: ${bestRecipe.scaleFactor}`)
      } else {
        console.warn(`No suitable recipes found for ${mealName} (${targetCalories} cal)`)
      }
    }

    // 6. Check if plan already exists
    const { data: existingPlan } = await supabase
      .from('daily_plans')
      .select('fasting_plan')
      .eq('user_id', userId)
      .eq('plan_date', planDate)
      .maybeSingle()

    if (existingPlan?.fasting_plan) {
      console.log('Fasting plan already exists for this date, skipping')
      return { success: true }
    }

    // 7. Save fasting plan to database
    const { error: upsertError } = await supabase
      .from('daily_plans')
      .upsert({
        user_id: userId,
        plan_date: planDate,
        fasting_plan: assignedPlan,
        is_generated: true
      }, {
        onConflict: 'user_id,plan_date'
      })

    if (upsertError) {
      return { success: false, error: upsertError.message }
    }

    console.log('Fasting plan saved successfully')
    revalidatePath('/dashboard')
    revalidatePath(`/dashboard/${planDate}`)
    
    return { success: true }

  } catch (error) {
    console.error('Error in generateFastingPlan:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}
