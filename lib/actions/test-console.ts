'use server'

import { createClient } from '@/lib/supabase/server'
import { getSystemSetting } from './settings'
import type { MealSlot } from '@/lib/types/nutri'
import {
  calculateMacroPercentages,
  calculateMacroSimilarity,
  calculateProteinDifference,
  getSwapQuality,
  type MacroProfile,
} from '@/lib/utils/nutrition'

export interface RecipeIngredientForPlan {
  id: string
  ingredient_id: string | null
  raw_name: string
  quantity: number | null
  scaled_quantity: number | null  // Quantity adjusted by scale_factor
  unit: string | null
  is_spice: boolean
  is_optional: boolean
  // Linked ingredient info (Supabase returns as object or null for single relation)
  ingredient?: {
    id: string
    name: string
    food_group: string | null
  } | null
}

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
  // Ingredients
  recipe_ingredients?: RecipeIngredientForPlan[]
  // Calculated fields
  scale_factor?: number
  scaled_calories?: number
  // Macro comparison fields (NEW)
  macro_similarity_score?: number
  macro_profile?: MacroProfile
  protein_diff_g?: number
  swap_quality?: 'excellent' | 'good' | 'acceptable' | 'poor'
}

/**
 * Round a number to the nearest 5 for practical measuring
 * e.g., 42.5 → 45, 48 → 50, 12 → 10
 */
function roundToNearest5(value: number): number {
  return Math.round(value / 5) * 5
}

/**
 * Transform Supabase recipe response to proper RecipeForMealPlan type
 */
function transformRecipe(
  recipe: any,
  scaleFactor?: number,
  scaledCalories?: number,
  macroComparisonData?: {
    macro_similarity_score: number
    macro_profile: MacroProfile
    protein_diff_g: number
    swap_quality: 'excellent' | 'good' | 'acceptable' | 'poor'
  }
): RecipeForMealPlan {
  const sf = scaleFactor || 1
  
  const transformedIngredients = (recipe.recipe_ingredients || []).map((ri: any) => {
    const originalQty = ri.quantity || null
    // Calculate scaled quantity and round to nearest 5 for practical measuring
    // For small quantities (< 10), round to nearest 1 instead
    let scaledQty: number | null = null
    if (originalQty !== null) {
      const rawScaled = originalQty * sf
      scaledQty = rawScaled < 10 ? Math.round(rawScaled) : roundToNearest5(rawScaled)
    }
    
    return {
      id: ri.id,
      ingredient_id: ri.ingredient_id,
      raw_name: ri.raw_name,
      quantity: originalQty,
      scaled_quantity: scaledQty,
      unit: ri.unit,
      is_spice: ri.is_spice,
      is_optional: ri.is_optional,
      ingredient: ri.ingredient || null,
    }
  })

  return {
    id: recipe.id,
    name: recipe.name,
    image_url: recipe.image_url,
    meal_type: recipe.meal_type,
    cuisine: recipe.cuisine,
    prep_time_minutes: recipe.prep_time_minutes,
    cook_time_minutes: recipe.cook_time_minutes,
    servings: recipe.servings,
    nutrition_per_serving: recipe.nutrition_per_serving,
    is_vegetarian: recipe.is_vegetarian,
    is_vegan: recipe.is_vegan,
    is_gluten_free: recipe.is_gluten_free,
    is_dairy_free: recipe.is_dairy_free,
    recipe_ingredients: transformedIngredients,
    scale_factor: scaleFactor,
    scaled_calories: scaledCalories,
    // Include macro comparison data if provided
    ...(macroComparisonData && macroComparisonData),
  }
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
  // Database meal_types: breakfast, lunch, dinner, snacks & sweetes, snack, smoothies, one pot, side dishes
  // User-facing meal slots: breakfast, lunch, dinner, snacks
  // ORDER MATTERS: First meal type in array gets priority in sorting
  const mealTypeMapping: Record<string, string[]> = {
    breakfast: ['breakfast', 'smoothies'],           // Breakfast first, then smoothies
    lunch: ['lunch', 'one pot', 'dinner', 'side dishes'],  // Lunch includes one pot, dinner recipes, and sides
    dinner: ['dinner', 'lunch', 'one pot', 'side dishes', 'breakfast'],  // Dinner uses dinner recipes first, then lunch/one pot
    snack: ['snack', 'snacks & sweetes', 'smoothies'],  // Include both singular and plural forms
    snack_1: ['snack', 'snacks & sweetes', 'smoothies'],
    snack_2: ['snack', 'snacks & sweetes', 'smoothies'],
    snack_3: ['snack', 'snacks & sweetes', 'smoothies'],
  }

  const targetMealTypes = mealTypeMapping[mealType] || [mealType]
  const primaryMealType = targetMealTypes[0] // Used for sorting priority

  // Build query - include recipe_ingredients with linked ingredient info
  // Use !inner for the FK hint to specify which relationship to use (ingredient_id, not suggested_ingredient_id)
  let query = supabase
    .from('recipes')
    .select(`
      id, name, image_url, meal_type, cuisine, prep_time_minutes, cook_time_minutes, servings, 
      nutrition_per_serving, is_vegetarian, is_vegan, is_gluten_free, is_dairy_free,
      recipe_ingredients (
        id, ingredient_id, raw_name, quantity, unit, is_spice, is_optional,
        ingredient:ingredients!recipe_ingredients_ingredient_id_fkey (id, name, food_group)
      )
    `)
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

    suitableRecipes.push(transformRecipe(
      recipe,
      Math.round(scaleFactor * 100) / 100,
      scaledCalories
    ))
  }

  // Sort by: 1) Primary meal type first, 2) Scale factor closest to 1.0
  suitableRecipes.sort((a, b) => {
    // First priority: primary meal type recipes come first
    const aPrimary = a.meal_type?.includes(primaryMealType) ? 1 : 0
    const bPrimary = b.meal_type?.includes(primaryMealType) ? 1 : 0
    if (bPrimary !== aPrimary) return bPrimary - aPrimary
    
    // Second priority: scale factor closest to 1.0 (most natural portion size)
    const aDistFromOne = Math.abs((a.scale_factor || 1) - 1)
    const bDistFromOne = Math.abs((b.scale_factor || 1) - 1)
    return aDistFromOne - bDistFromOne
  })

  return { data: suitableRecipes.slice(0, limit), error: null }
}

/**
 * Get alternative recipes for a given recipe (same meal type)
 * Now includes macro similarity scoring for better nutritional matches
 * Supports pagination with offset
 */
export async function getRecipeAlternatives(options: {
  recipeId: string
  targetCalories?: number
  limit?: number
  offset?: number
}): Promise<{ 
  data: RecipeForMealPlan[] | null
  originalRecipe: RecipeForMealPlan | null
  total: number
  hasMore: boolean
  error: string | null 
}> {
  const supabase = await createClient()
  
  const { recipeId, targetCalories, limit = 12, offset = 0 } = options

  // Get the original recipe with ingredients
  // Use FK hint to disambiguate which ingredients relation to use
  const { data: original, error: originalError } = await supabase
    .from('recipes')
    .select(`
      id, name, image_url, meal_type, cuisine, prep_time_minutes, cook_time_minutes, servings, 
      nutrition_per_serving, is_vegetarian, is_vegan, is_gluten_free, is_dairy_free,
      recipe_ingredients (
        id, ingredient_id, raw_name, quantity, unit, is_spice, is_optional,
        ingredient:ingredients!recipe_ingredients_ingredient_id_fkey (id, name, food_group)
      )
    `)
    .eq('id', recipeId)
    .single()

  if (originalError || !original) {
    return { data: null, originalRecipe: null, total: 0, hasMore: false, error: originalError?.message || 'Recipe not found' }
  }

  // Calculate original recipe's macro profile
  const originalNutrition = original.nutrition_per_serving
  const originalMacroProfile = calculateMacroPercentages({
    calories: originalNutrition?.calories || 0,
    protein_g: originalNutrition?.protein_g || 0,
    carbs_g: originalNutrition?.carbs_g || 0,
    fat_g: originalNutrition?.fat_g || 0,
  })

  // Transform original recipe with its macro profile
  const transformedOriginal = transformRecipe(
    original,
    1.0,
    originalNutrition?.calories || 0,
    {
      macro_similarity_score: 100, // Original is 100% similar to itself
      macro_profile: originalMacroProfile,
      protein_diff_g: 0,
      swap_quality: 'excellent',
    }
  )

  const mealTypes = original.meal_type || []
  if (mealTypes.length === 0) {
    return { data: [], originalRecipe: transformedOriginal, total: 0, hasMore: false, error: null }
  }

  // Use original recipe calories if target not specified
  const target = targetCalories || originalNutrition?.calories || 500

  // Get alternatives with same meal type (including ingredients)
  // Use FK hint to disambiguate which ingredients relation to use
  const { data: alternatives, error } = await supabase
    .from('recipes')
    .select(`
      id, name, image_url, meal_type, cuisine, prep_time_minutes, cook_time_minutes, servings, 
      nutrition_per_serving, is_vegetarian, is_vegan, is_gluten_free, is_dairy_free,
      recipe_ingredients (
        id, ingredient_id, raw_name, quantity, unit, is_spice, is_optional,
        ingredient:ingredients!recipe_ingredients_ingredient_id_fkey (id, name, food_group)
      )
    `)
    .neq('id', recipeId)
    .overlaps('meal_type', mealTypes)
    .not('nutrition_per_serving', 'is', null)
    .limit(500)  // Fetch all possible alternatives for filtering

  if (error) {
    return { data: null, originalRecipe: transformedOriginal, total: 0, hasMore: false, error: error.message }
  }

  // Get scaling limits
  const { data: scalingLimits } = await getSystemSetting('scaling_limits')
  const minScale = scalingLimits?.min_scale_factor || 0.5
  const maxScale = scalingLimits?.max_scale_factor || 2.0

  // Get macro similarity weights from settings (default to 50/30/20 if not set)
  const { data: macroWeights } = await getSystemSetting('macro_similarity_weights')
  const weights = macroWeights || { protein: 0.5, carbs: 0.3, fat: 0.2 }

  const suitableAlternatives: RecipeForMealPlan[] = []

  for (const recipe of alternatives || []) {
    const baseCalories = recipe.nutrition_per_serving?.calories
    if (!baseCalories || baseCalories <= 0) continue

    const scaleFactor = target / baseCalories
    if (scaleFactor < minScale || scaleFactor > maxScale) continue

    // Calculate macro profile for this alternative
    const altNutrition = recipe.nutrition_per_serving
    const altMacroProfile = calculateMacroPercentages({
      calories: altNutrition?.calories || 0,
      protein_g: altNutrition?.protein_g || 0,
      carbs_g: altNutrition?.carbs_g || 0,
      fat_g: altNutrition?.fat_g || 0,
    })

    // Calculate macro similarity score with custom weights from settings
    const macroSimilarityScore = calculateMacroSimilarity(
      originalMacroProfile,
      altMacroProfile,
      weights
    )

    // Calculate protein difference (scaled)

    // Calculate protein difference (scaled)
    const proteinDiff = calculateProteinDifference(
      originalNutrition?.protein_g || 0,
      altNutrition?.protein_g || 0,
      scaleFactor
    )

    // Get swap quality rating
    const swapQuality = getSwapQuality(macroSimilarityScore)

    // Scaled calories will ALWAYS equal target
    suitableAlternatives.push(transformRecipe(
      recipe,
      Math.round(scaleFactor * 100) / 100,
      target,
      {
        macro_similarity_score: macroSimilarityScore,
        macro_profile: altMacroProfile,
        protein_diff_g: proteinDiff,
        swap_quality: swapQuality,
      }
    ))
  }

  // Sort by: 1) Macro similarity score (highest first), 2) Scale factor closest to 1.0
  // This prioritizes nutritionally similar alternatives while still preferring natural portions
  suitableAlternatives.sort((a, b) => {
    // Primary: Macro similarity (higher is better)
    const scoreA = a.macro_similarity_score || 0
    const scoreB = b.macro_similarity_score || 0
    if (Math.abs(scoreA - scoreB) > 5) {  // Only prioritize if difference is significant (>5 points)
      return scoreB - scoreA
    }
    
    // Secondary: Scale factor closest to 1.0 (most natural portion size)
    const aDistFromOne = Math.abs((a.scale_factor || 1) - 1)
    const bDistFromOne = Math.abs((b.scale_factor || 1) - 1)
    return aDistFromOne - bDistFromOne
  })

  // Apply pagination
  const total = suitableAlternatives.length
  const paginatedData = suitableAlternatives.slice(offset, offset + limit)
  const hasMore = offset + limit < total

  return { 
    data: paginatedData, 
    originalRecipe: transformedOriginal,
    total,
    hasMore,
    error: null 
  }
}

/**
 * Get ingredient swap options (same food group)
 * Supports pagination with offset
 */
export async function getIngredientSwaps(options: {
  ingredientId: string
  targetAmount?: number
  targetUnit?: string
  limit?: number
  offset?: number
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
    macro_similarity_score?: number
    macro_profile?: { protein_pct: number; carbs_pct: number; fat_pct: number }
    protein_diff_g?: number
    swap_quality?: 'excellent' | 'good' | 'acceptable' | 'poor'
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
    macro_profile?: { protein_pct: number; carbs_pct: number; fat_pct: number }
  } | null
  total: number
  hasMore: boolean
  error: string | null 
}> {
  const supabase = await createClient()
  
  const { ingredientId, targetAmount, targetUnit, limit = 12, offset = 0 } = options

  // Get original ingredient
  const { data: original, error: originalError } = await supabase
    .from('ingredients')
    .select('id, name, name_ar, food_group, subgroup, serving_size, serving_unit, macros')
    .eq('id', ingredientId)
    .single()

  if (originalError || !original) {
    return { data: null, originalIngredient: null, total: 0, hasMore: false, error: originalError?.message || 'Ingredient not found' }
  }

  if (!original.food_group) {
    return { data: [], originalIngredient: original, total: 0, hasMore: false, error: null }
  }

  // Get alternatives in same food group
  const { data: alternatives, error } = await supabase
    .from('ingredients')
    .select('id, name, name_ar, food_group, subgroup, serving_size, serving_unit, macros')
    .eq('food_group', original.food_group)
    .neq('id', ingredientId)
    .limit(200)  // Fetch all for sorting, then paginate

  if (error) {
    return { data: null, originalIngredient: original, total: 0, hasMore: false, error: error.message }
  }

  // Get{ data: macroWeights }arity weights from settings (default to 50/30/20 if not set)
  const { data: macroWeights } = await getSystemSetting('macro_similarity_weights')
  const weights = macroWeights || { protein: 0.5, carbs: 0.3, fat: 0.2 }

  // Calculate macro profile for original ingredient
  const originalMacros = original.macros || {}
  const originalMacroProfile = calculateMacroPercentages({
    calories: originalMacros.calories || 0,
    protein_g: originalMacros.protein_g || 0,
    carbs_g: originalMacros.carbs_g || 0,
    fat_g: originalMacros.fat_g || 0,
  })

  // Calculate calorie equivalence if target amount provided
  const originalCaloriesPerUnit = (originalMacros.calories || 0) / original.serving_size
  const targetCalories = targetAmount 
    ? originalCaloriesPerUnit * targetAmount 
    : originalMacros.calories || 0

  const swapOptions = (alternatives || []).map(alt => {
    const altMacros = alt.macros || {}
    const altCaloriesPerUnit = (altMacros.calories || 0) / alt.serving_size
    
    // Calculate suggested amount to match calories
    let suggested_amount: number | undefined
    let calorie_diff_percent: number | undefined
    
    if (targetCalories > 0 && altCaloriesPerUnit > 0) {
      suggested_amount = Math.round((targetCalories / altCaloriesPerUnit) * 10) / 10
      const suggestedCalories = suggested_amount * altCaloriesPerUnit
      calorie_diff_percent = Math.round(((suggestedCalories - targetCalories) / targetCalories) * 100)
    }

    // Calculate macro profile for alternative
    const altMacroProfile = calculateMacroPercentages({
      calories: altMacros.calories || 0,
      protein_g: altMacros.protein_g || 0,
      carbs_g: altMacros.carbs_g || 0,
      fat_g: altMacros.fat_g || 0,
    })

    // Calculate macro similarity score with custom weights from settings
    const macroSimilarityScore = calculateMacroSimilarity(
      originalMacroProfile,
      altMacroProfile,
      weights
    )

    // Calculate protein difference for suggested amount
    const proteinDiff = suggested_amount
      ? (altMacros.protein_g || 0) * (suggested_amount / alt.serving_size) - (originalMacros.protein_g || 0) * ((targetAmount || original.serving_size) / original.serving_size)
      : 0

    // Get swap quality rating
    const swapQuality = getSwapQuality(macroSimilarityScore)

    return {
      ...alt,
      suggested_amount,
      calorie_diff_percent,
      macro_similarity_score: macroSimilarityScore,
      macro_profile: altMacroProfile,
      protein_diff_g: proteinDiff,
      swap_quality: swapQuality,
    }
  })

  // Enhanced sorting: 1) Same subgroup + high protein similarity, 2) Same subgroup, 3) High protein similarity, 4) Name
  swapOptions.sort((a, b) => {
    const aScor = a.macro_similarity_score || 0
    const bScore = b.macro_similarity_score || 0
    const aSameSubgroup = a.subgroup === original.subgroup
    const bSameSubgroup = b.subgroup === original.subgroup
    const aHighProtein = aScor >= 70  // 70+ is good protein match
    const bHighProtein = bScore >= 70

    // Priority 1: Same subgroup AND high protein similarity
    if (aSameSubgroup && aHighProtein && !(bSameSubgroup && bHighProtein)) return -1
    if (bSameSubgroup && bHighProtein && !(aSameSubgroup && aHighProtein)) return 1

    // Priority 2: Same subgroup (regardless of protein)
    if (aSameSubgroup && !bSameSubgroup) return -1
    if (bSameSubgroup && !aSameSubgroup) return 1

    // Priority 3: High protein similarity (even if different subgroup)
    if (aHighProtein && !bHighProtein) return -1
    if (bHighProtein && !aHighProtein) return 1

    // Priority 4: By macro similarity score (higher first)
    if (Math.abs(aScor - bScore) > 5) {
      return bScore - aScor
    }

    // Finally: Alphabetical by name
    return a.name.localeCompare(b.name)
  })

  // Apply pagination
  const total = swapOptions.length
  const paginatedData = swapOptions.slice(offset, offset + limit)
  const hasMore = offset + limit < total

  return { 
    data: paginatedData, 
    originalIngredient: { ...original, macro_profile: originalMacroProfile }, 
    total, 
    hasMore, 
    error: null 
  }
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
