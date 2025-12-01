'use server'

import { createClient } from '@/lib/supabase/server'
import { getSystemSetting } from './settings'
import type { MealSlot } from '@/lib/types/nutri'

export interface RecipeForMealPlan {
  id: string
  name: string
  image_url: string | null
  meal_type: string[]
  cuisine: string | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  servings: number
  nutrition_per_serving: {
    calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
  }
  is_vegetarian: boolean
  is_vegan: boolean
  is_gluten_free: boolean
  is_dairy_free: boolean
  // Calculated fields
  scale_factor?: number
  scaled_calories?: number
}

/**
 * Get recipes suitable for a specific meal type and calorie target
 */
export async function getRecipesForMeal(options: {
  mealType: string
  targetCalories: number
  deviationTolerance?: number
  dietaryFilters?: {
    vegetarian?: boolean
    vegan?: boolean
    gluten_free?: boolean
    dairy_free?: boolean
  }
  limit?: number
}): Promise<{ data: RecipeForMealPlan[] | null; error: string | null }> {
  const supabase = await createClient()
  
  const { mealType, targetCalories, deviationTolerance = 0.25, dietaryFilters, limit = 20 } = options

  // Map meal slot names to recipe meal_type values in the database
  // Database meal_types: breakfast, lunch, snacks & sweetes, smoothies, one pot, side dishes
  // User-facing meal slots: breakfast, lunch, dinner, snacks
  const mealTypeMapping: Record<string, string[]> = {
    breakfast: ['breakfast', 'smoothies'],
    lunch: ['lunch', 'one pot'],
    dinner: ['lunch', 'one pot'],                    // Dinner uses lunch recipes
    snack: ['snacks & sweetes', 'smoothies'],
    snack_1: ['snacks & sweetes', 'smoothies'],
    snack_2: ['snacks & sweetes', 'smoothies'],
    snack_3: ['snacks & sweetes', 'smoothies'],
  }

  const targetMealTypes = mealTypeMapping[mealType] || [mealType]

  // Build query
  let query = supabase
    .from('recipes')
    .select('id, name, image_url, meal_type, cuisine, prep_time_minutes, cook_time_minutes, servings, nutrition_per_serving, is_vegetarian, is_vegan, is_gluten_free, is_dairy_free')
    .not('nutrition_per_serving', 'is', null)

  // Apply dietary filters
  if (dietaryFilters?.vegetarian) {
    query = query.eq('is_vegetarian', true)
  }
  if (dietaryFilters?.vegan) {
    query = query.eq('is_vegan', true)
  }
  if (dietaryFilters?.gluten_free) {
    query = query.eq('is_gluten_free', true)
  }
  if (dietaryFilters?.dairy_free) {
    query = query.eq('is_dairy_free', true)
  }

  const { data: recipes, error } = await query.limit(100)

  if (error) {
    console.error('Error fetching recipes:', error)
    return { data: null, error: error.message }
  }

  if (!recipes) {
    return { data: [], error: null }
  }

  // Filter by meal type and calculate scaling
  // Get scaling limits from settings
  const { data: scalingLimits } = await getSystemSetting('scaling_limits')
  const minScale = scalingLimits?.min_scale_factor || 0.5
  const maxScale = scalingLimits?.max_scale_factor || 2.0

  const suitableRecipes: RecipeForMealPlan[] = []

  for (const recipe of recipes) {
    // Check if recipe matches meal type
    const recipeMealTypes = recipe.meal_type || []
    const matchesMealType = targetMealTypes.some(t => recipeMealTypes.includes(t))
    
    if (!matchesMealType) continue

    // Get base calories
    const baseCalories = recipe.nutrition_per_serving?.calories
    if (!baseCalories || baseCalories <= 0) continue

    // Calculate scale factor needed to hit EXACT target calories
    const scaleFactor = targetCalories / baseCalories

    // Check if scaling is within acceptable limits (not too big or too small portions)
    if (scaleFactor < minScale || scaleFactor > maxScale) continue

    // Scaled calories will ALWAYS equal target (that's the point of scaling)
    const scaledCalories = targetCalories

    suitableRecipes.push({
      ...recipe,
      scale_factor: Math.round(scaleFactor * 100) / 100,
      scaled_calories: scaledCalories,
    })
  }

  // Sort by scale factor closest to 1.0 (most natural portion size)
  suitableRecipes.sort((a, b) => {
    const aDistFromOne = Math.abs((a.scale_factor || 1) - 1)
    const bDistFromOne = Math.abs((b.scale_factor || 1) - 1)
    return aDistFromOne - bDistFromOne
  })

  return { data: suitableRecipes.slice(0, limit), error: null }
}

/**
 * Get alternative recipes for a given recipe (same meal type)
 */
export async function getRecipeAlternatives(options: {
  recipeId: string
  targetCalories?: number
  limit?: number
}): Promise<{ data: RecipeForMealPlan[] | null; originalRecipe: RecipeForMealPlan | null; error: string | null }> {
  const supabase = await createClient()
  
  const { recipeId, targetCalories, limit = 10 } = options

  // Get the original recipe
  const { data: original, error: originalError } = await supabase
    .from('recipes')
    .select('id, name, image_url, meal_type, cuisine, prep_time_minutes, cook_time_minutes, servings, nutrition_per_serving, is_vegetarian, is_vegan, is_gluten_free, is_dairy_free')
    .eq('id', recipeId)
    .single()

  if (originalError || !original) {
    return { data: null, originalRecipe: null, error: originalError?.message || 'Recipe not found' }
  }

  const mealTypes = original.meal_type || []
  if (mealTypes.length === 0) {
    return { data: [], originalRecipe: original, error: null }
  }

  // Use original recipe calories if target not specified
  const target = targetCalories || original.nutrition_per_serving?.calories || 500

  // Get alternatives with same meal type
  const { data: alternatives, error } = await supabase
    .from('recipes')
    .select('id, name, image_url, meal_type, cuisine, prep_time_minutes, cook_time_minutes, servings, nutrition_per_serving, is_vegetarian, is_vegan, is_gluten_free, is_dairy_free')
    .neq('id', recipeId)
    .overlaps('meal_type', mealTypes)
    .not('nutrition_per_serving', 'is', null)
    .limit(50)

  if (error) {
    return { data: null, originalRecipe: original, error: error.message }
  }

  // Get scaling limits
  const { data: scalingLimits } = await getSystemSetting('scaling_limits')
  const minScale = scalingLimits?.min_scale_factor || 0.5
  const maxScale = scalingLimits?.max_scale_factor || 2.0

  const suitableAlternatives: RecipeForMealPlan[] = []

  for (const recipe of alternatives || []) {
    const baseCalories = recipe.nutrition_per_serving?.calories
    if (!baseCalories || baseCalories <= 0) continue

    const scaleFactor = target / baseCalories
    if (scaleFactor < minScale || scaleFactor > maxScale) continue

    // Scaled calories will ALWAYS equal target
    suitableAlternatives.push({
      ...recipe,
      scale_factor: Math.round(scaleFactor * 100) / 100,
      scaled_calories: target,
    })
  }

  // Sort by scale factor closest to 1.0 (most natural portion size)
  suitableAlternatives.sort((a, b) => {
    const aDistFromOne = Math.abs((a.scale_factor || 1) - 1)
    const bDistFromOne = Math.abs((b.scale_factor || 1) - 1)
    return aDistFromOne - bDistFromOne
  })

  return { 
    data: suitableAlternatives.slice(0, limit), 
    originalRecipe: original,
    error: null 
  }
}

/**
 * Get ingredient swap options (same food group)
 */
export async function getIngredientSwaps(options: {
  ingredientId: string
  targetAmount?: number
  targetUnit?: string
}): Promise<{ 
  data: Array<{
    id: string
    name: string
    name_ar: string | null
    food_group: string | null
    subgroup: string | null
    serving_size: number
    serving_unit: string
    macros: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number }
    suggested_amount?: number
    calorie_diff_percent?: number
  }> | null
  originalIngredient: {
    id: string
    name: string
    name_ar: string | null
    food_group: string | null
    subgroup: string | null
    serving_size: number
    serving_unit: string
    macros: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number }
  } | null
  error: string | null 
}> {
  const supabase = await createClient()
  
  const { ingredientId, targetAmount, targetUnit } = options

  // Get original ingredient
  const { data: original, error: originalError } = await supabase
    .from('ingredients')
    .select('id, name, name_ar, food_group, subgroup, serving_size, serving_unit, macros')
    .eq('id', ingredientId)
    .single()

  if (originalError || !original) {
    return { data: null, originalIngredient: null, error: originalError?.message || 'Ingredient not found' }
  }

  if (!original.food_group) {
    return { data: [], originalIngredient: original, error: null }
  }

  // Get alternatives in same food group
  const { data: alternatives, error } = await supabase
    .from('ingredients')
    .select('id, name, name_ar, food_group, subgroup, serving_size, serving_unit, macros')
    .eq('food_group', original.food_group)
    .neq('id', ingredientId)
    .limit(30)

  if (error) {
    return { data: null, originalIngredient: original, error: error.message }
  }

  // Calculate calorie equivalence if target amount provided
  const originalCaloriesPerUnit = (original.macros?.calories || 0) / original.serving_size
  const targetCalories = targetAmount 
    ? originalCaloriesPerUnit * targetAmount 
    : original.macros?.calories || 0

  const swapOptions = (alternatives || []).map(alt => {
    const altCaloriesPerUnit = (alt.macros?.calories || 0) / alt.serving_size
    
    // Calculate suggested amount to match calories
    let suggested_amount: number | undefined
    let calorie_diff_percent: number | undefined
    
    if (targetCalories > 0 && altCaloriesPerUnit > 0) {
      suggested_amount = Math.round((targetCalories / altCaloriesPerUnit) * 10) / 10
      const suggestedCalories = suggested_amount * altCaloriesPerUnit
      calorie_diff_percent = Math.round(((suggestedCalories - targetCalories) / targetCalories) * 100)
    }

    return {
      ...alt,
      suggested_amount,
      calorie_diff_percent,
    }
  })

  // Sort by same subgroup first, then by name
  swapOptions.sort((a, b) => {
    if (a.subgroup === original.subgroup && b.subgroup !== original.subgroup) return -1
    if (b.subgroup === original.subgroup && a.subgroup !== original.subgroup) return 1
    return a.name.localeCompare(b.name)
  })

  return { data: swapOptions, originalIngredient: original, error: null }
}

/**
 * Generate a sample meal plan for testing
 */
export async function generateTestMealPlan(options: {
  dailyCalories: number
  mealStructure: MealSlot[]
  dietaryFilters?: {
    vegetarian?: boolean
    vegan?: boolean
    gluten_free?: boolean
    dairy_free?: boolean
  }
}): Promise<{
  data: Array<{
    slot: MealSlot
    recipe: RecipeForMealPlan | null
    alternativeCount: number
  }> | null
  totalCalories: number
  error: string | null
}> {
  const { dailyCalories, mealStructure, dietaryFilters } = options

  const mealPlan: Array<{
    slot: MealSlot
    recipe: RecipeForMealPlan | null
    alternativeCount: number
  }> = []

  let totalCalories = 0

  for (const slot of mealStructure) {
    const targetCalories = Math.round(dailyCalories * slot.percentage)
    
    const { data: recipes } = await getRecipesForMeal({
      mealType: slot.name,
      targetCalories,
      dietaryFilters,
      limit: 10,
    })

    const selectedRecipe = recipes && recipes.length > 0 ? recipes[0] : null
    
    mealPlan.push({
      slot: { ...slot, target_calories: targetCalories },
      recipe: selectedRecipe,
      alternativeCount: recipes ? recipes.length - 1 : 0,
    })

    if (selectedRecipe?.scaled_calories) {
      totalCalories += selectedRecipe.scaled_calories
    }
  }

  return { data: mealPlan, totalCalories, error: null }
}
