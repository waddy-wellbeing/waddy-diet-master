'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { startOfWeek, endOfWeek, format } from 'date-fns'
import type { 
  ShoppingListRecord, 
  ShoppingListItems,
  DailyPlan,
  RecipeIngredient
} from '@/lib/types/nutri'

type ActionResult<T> = { success: true; data: T } | { success: false; error: string }

/**
 * Generate a shopping list for a week by aggregating ingredients from daily plans
 */
export async function generateShoppingList(
  weekStartDate: Date = new Date()
): Promise<ActionResult<ShoppingListRecord>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Calculate week boundaries (Monday to Sunday)
    const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 1 }) // Monday
    const weekEnd = endOfWeek(weekStartDate, { weekStartsOn: 1 }) // Sunday

    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

    // Fetch all daily plans for the week
    const { data: plans, error: plansError } = await supabase
      .from('daily_plans')
      .select('plan_date, plan')
      .eq('user_id', user.id)
      .gte('plan_date', weekStartStr)
      .lte('plan_date', weekEndStr)

    if (plansError) {
      console.error('Error fetching plans:', plansError)
      return { success: false, error: 'Failed to fetch meal plans' }
    }

    if (!plans || plans.length === 0) {
      return { success: false, error: 'No meal plans found for this week' }
    }

    // Aggregate ingredients across all plans
    const aggregated = new Map<string, {
      ingredient_id: string
      name: string
      name_ar?: string
      total_quantity: number
      unit: string
      food_group: string
      recipes: Set<string>
    }>()

    // Process each daily plan
    for (const dayPlan of plans) {
      const plan = dayPlan.plan as DailyPlan

      // Process each meal type (breakfast, lunch, dinner, snacks)
      for (const mealType of ['breakfast', 'lunch', 'dinner', 'snacks'] as const) {
        // Handle snacks as array, others as single meal
        let mealsToProcess: Array<{ recipe_id?: string; servings?: number }> = []
        
        if (mealType === 'snacks') {
          if (Array.isArray(plan.snacks)) {
            mealsToProcess = plan.snacks
          }
        } else {
          const meal = plan[mealType]
          if (meal) {
            mealsToProcess = [meal]
          }
        }

        for (const meal of mealsToProcess) {
          if (!meal || !meal.recipe_id) continue

          // Fetch recipe with ingredients
          const { data: recipe, error: recipeError } = await supabase
            .from('recipes')
            .select('id, name, ingredients')
            .eq('id', meal.recipe_id)
            .single()

          if (recipeError || !recipe) {
            console.error('Error fetching recipe:', recipeError)
            continue
          }

          const scaleFactor = meal.servings || 1
          const ingredients = recipe.ingredients as unknown as RecipeIngredient[]

          // Process each ingredient in the recipe
          for (const ingredient of ingredients) {
            // Skip spices (they are "to taste")
            if (ingredient.is_spice) continue
            
            // Skip ingredients without ID or quantity
            if (!ingredient.ingredient_id || !ingredient.quantity) continue

            const key = ingredient.ingredient_id

            if (aggregated.has(key)) {
              // Add to existing ingredient
              const item = aggregated.get(key)!
              item.total_quantity += ingredient.quantity * scaleFactor
              item.recipes.add(recipe.name)
            } else {
              // Fetch ingredient details
              const { data: ingredientData } = await supabase
                .from('ingredients')
                .select('name, name_ar, food_group')
                .eq('id', ingredient.ingredient_id)
                .single()

              if (ingredientData) {
                aggregated.set(key, {
                  ingredient_id: ingredient.ingredient_id,
                  name: ingredientData.name,
                  name_ar: ingredientData.name_ar || undefined,
                  total_quantity: ingredient.quantity * scaleFactor,
                  unit: ingredient.unit || '',
                  food_group: ingredientData.food_group || 'Uncategorized',
                  recipes: new Set([recipe.name])
                })
              }
            }
          }
        }
      }
    }

    // Group by food_group
    const grouped: ShoppingListItems = {}
    
    for (const item of aggregated.values()) {
      const foodGroup = item.food_group || 'Uncategorized'
      
      if (!grouped[foodGroup]) {
        grouped[foodGroup] = []
      }

      grouped[foodGroup].push({
        ingredient_id: item.ingredient_id,
        ingredient_name: item.name,
        ingredient_name_ar: item.name_ar,
        total_quantity: Math.round(item.total_quantity * 10) / 10, // Round to 1 decimal
        unit: item.unit,
        food_group: item.food_group,
        used_in_recipes: Array.from(item.recipes)
      })
    }

    // Sort items within each group by name
    for (const group of Object.values(grouped)) {
      group.sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name))
    }

    // Upsert shopping list
    const { data: shoppingList, error: upsertError } = await supabase
      .from('shopping_lists')
      .upsert({
        user_id: user.id,
        week_start_date: weekStartStr,
        week_end_date: weekEndStr,
        items: grouped,
        checked_items: [] // Reset checked items when regenerating
      }, {
        onConflict: 'user_id,week_start_date'
      })
      .select()
      .single()

    if (upsertError) {
      console.error('Error saving shopping list:', upsertError)
      return { success: false, error: 'Failed to save shopping list' }
    }

    revalidatePath('/shopping-list')
    return { success: true, data: shoppingList }
  } catch (error) {
    console.error('Unexpected error generating shopping list:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get shopping list for a specific week
 */
export async function getShoppingList(
  weekStartDate: Date = new Date()
): Promise<ActionResult<ShoppingListRecord | null>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 1 })
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')

    const { data: shoppingList, error: fetchError } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStartStr)
      .maybeSingle()

    if (fetchError) {
      console.error('Error fetching shopping list:', fetchError)
      return { success: false, error: 'Failed to fetch shopping list' }
    }

    return { success: true, data: shoppingList }
  } catch (error) {
    console.error('Unexpected error fetching shopping list:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Toggle checked state for an ingredient in the shopping list
 */
export async function toggleShoppingListItem(
  listId: string,
  ingredientId: string,
  checked: boolean
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Fetch current shopping list
    const { data: currentList, error: fetchError } = await supabase
      .from('shopping_lists')
      .select('checked_items')
      .eq('id', listId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !currentList) {
      return { success: false, error: 'Shopping list not found' }
    }

    // Update checked items array
    let checkedItems = currentList.checked_items as string[]
    
    if (checked) {
      // Add to checked items if not already there
      if (!checkedItems.includes(ingredientId)) {
        checkedItems = [...checkedItems, ingredientId]
      }
    } else {
      // Remove from checked items
      checkedItems = checkedItems.filter(id => id !== ingredientId)
    }

    // Update database
    const { error: updateError } = await supabase
      .from('shopping_lists')
      .update({ checked_items: checkedItems })
      .eq('id', listId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating shopping list:', updateError)
      return { success: false, error: 'Failed to update item' }
    }

    revalidatePath('/shopping-list')
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Unexpected error toggling item:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Delete a shopping list
 */
export async function deleteShoppingList(listId: string): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error: deleteError } = await supabase
      .from('shopping_lists')
      .delete()
      .eq('id', listId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting shopping list:', deleteError)
      return { success: false, error: 'Failed to delete shopping list' }
    }

    revalidatePath('/shopping-list')
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Unexpected error deleting shopping list:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get count of daily plans for a week (to check if user has plans)
 */
export async function getWeekPlanCount(weekStartDate: Date = new Date()): Promise<ActionResult<number>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    const weekStart = startOfWeek(weekStartDate, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(weekStartDate, { weekStartsOn: 1 })

    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

    const { count, error: countError } = await supabase
      .from('daily_plans')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('plan_date', weekStartStr)
      .lte('plan_date', weekEndStr)

    if (countError) {
      console.error('Error counting plans:', countError)
      return { success: false, error: 'Failed to count plans' }
    }

    return { success: true, data: count || 0 }
  } catch (error) {
    console.error('Unexpected error counting plans:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
