'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { recipeSchema, type RecipeFormData } from '@/lib/validators/recipes'
import type { RecipeIngredient, RecipeWithIngredients } from '@/lib/types/nutri'

// =============================================================================
// Types
// =============================================================================

interface ActionResult<T = void> {
  success: boolean
  error?: string
  data?: T
}

interface GetRecipesParams {
  page?: number
  pageSize?: number
  search?: string
  mealType?: string
  cuisine?: string
  hasIssues?: boolean // Filter for recipes with no ingredients or unmatched ingredients
}

export interface RecipeListItem {
  id: string
  name: string
  description: string | null
  image_url: string | null
  meal_type: string[]
  cuisine: string | null
  servings: number
  difficulty: string | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
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
  is_public: boolean
  admin_notes: string | null
  ingredient_count: number
  unmatched_count: number
  created_at: string
}

interface GetRecipesResult {
  recipes: RecipeListItem[]
  total: number
  error: string | null
}

// =============================================================================
// Helper: Check if user is admin
// =============================================================================

async function requireAdmin() {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    throw new Error('Profile not found')
  }

  if (profile.role !== 'admin' && profile.role !== 'moderator') {
    throw new Error('Admin access required')
  }

  return user
}

// =============================================================================
// Get Recipes (with pagination and filters)
// =============================================================================

export async function getRecipes({
  page = 1,
  pageSize = 20,
  search = '',
  mealType = '',
  cuisine = '',
  hasIssues = false,
}: GetRecipesParams = {}): Promise<GetRecipesResult> {
  const supabase = await createClient()
  
  const offset = (page - 1) * pageSize

  // Build the base query
  let query = supabase
    .from('recipes')
    .select(`
      id,
      name,
      description,
      image_url,
      meal_type,
      cuisine,
      servings,
      difficulty,
      prep_time_minutes,
      cook_time_minutes,
      nutrition_per_serving,
      is_vegetarian,
      is_vegan,
      is_gluten_free,
      is_dairy_free,
      is_public,
      admin_notes,
      created_at,
      recipe_ingredients(id, is_matched)
    `, { count: 'exact' })
    .order('name', { ascending: true })

  // Apply search filter
  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
  }

  // Apply meal type filter
  if (mealType) {
    query = query.contains('meal_type', [mealType])
  }

  // Apply cuisine filter
  if (cuisine) {
    query = query.eq('cuisine', cuisine)
  }

  // For hasIssues filter, we need to fetch all and filter client-side
  // because we can't filter on computed values (ingredient_count, unmatched_count)
  // or check for null image_url in combination with ingredient issues
  if (!hasIssues) {
    query = query.range(offset, offset + pageSize - 1)
  }

  const { data, count, error } = await query

  if (error) {
    return { recipes: [], total: 0, error: error.message }
  }

  // Transform data to include computed counts
  const recipes: RecipeListItem[] = (data ?? []).map((recipe: any) => {
    const ingredientCount = recipe.recipe_ingredients?.length ?? 0
    const unmatchedCount = recipe.recipe_ingredients?.filter((ri: any) => !ri.is_matched).length ?? 0
    
    // Remove the nested recipe_ingredients from the result
    const { recipe_ingredients, ...recipeData } = recipe
    
    return {
      ...recipeData,
      ingredient_count: ingredientCount,
      unmatched_count: unmatchedCount,
    }
  })

  // If filtering by issues, do it client-side (since we can't filter on computed values)
  // Issues include: no ingredients, unmatched ingredients, or missing image
  if (hasIssues) {
    const recipesWithIssues = recipes.filter(r => 
      r.ingredient_count === 0 || 
      r.unmatched_count > 0 || 
      !r.image_url
    )
    
    // Apply pagination to filtered results
    const paginatedRecipes = recipesWithIssues.slice(offset, offset + pageSize)
    
    return {
      recipes: paginatedRecipes,
      total: recipesWithIssues.length,
      error: null,
    }
  }

  return {
    recipes,
    total: count ?? 0,
    error: null,
  }
}

// =============================================================================
// Get Single Recipe (full details with ingredients from junction table)
// =============================================================================

export async function getRecipe(id: string): Promise<{
  recipe: RecipeWithIngredients | null
  error: string | null
}> {
  const supabase = await createClient()

  // Fetch the recipe
  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single()

  if (recipeError) {
    return { recipe: null, error: recipeError.message }
  }

  // Fetch ingredients from junction table with related ingredient/spice names
  const { data: ingredientRows, error: ingredientsError } = await supabase
    .from('recipe_ingredients')
    .select(`
      ingredient_id, 
      spice_id, 
      raw_name, 
      quantity, 
      unit, 
      is_spice, 
      is_optional, 
      sort_order,
      ingredients:ingredient_id(name, name_ar),
      spices:spice_id(name, name_ar)
    `)
    .eq('recipe_id', id)
    .order('sort_order', { ascending: true })

  if (ingredientsError) {
    return { recipe: null, error: ingredientsError.message }
  }

  // Transform junction table rows to RecipeIngredient format for the form
  const ingredients: RecipeIngredient[] = (ingredientRows ?? []).map(row => {
    // Get linked name from the related table (Supabase returns single object for FK relations)
    const linkedIngredient = row.ingredients as unknown as { name: string; name_ar: string | null } | null
    const linkedSpice = row.spices as unknown as { name: string; name_ar: string | null } | null
    
    return {
      ingredient_id: row.ingredient_id,
      spice_id: row.spice_id,
      raw_name: row.raw_name,
      quantity: row.quantity,
      unit: row.unit,
      is_spice: row.is_spice,
      is_optional: row.is_optional,
      linked_name: row.is_spice ? linkedSpice?.name : linkedIngredient?.name,
      linked_name_ar: row.is_spice ? linkedSpice?.name_ar : linkedIngredient?.name_ar,
    }
  })

  return {
    recipe: {
      ...recipe,
      ingredients,
    },
    error: null,
  }
}

// =============================================================================
// Get Cuisines (for filter dropdown)
// =============================================================================

export async function getCuisines(): Promise<string[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('recipes')
    .select('cuisine')
    .not('cuisine', 'is', null)
    .order('cuisine')

  if (error || !data) {
    return []
  }

  // Get unique cuisines
  const cuisines = [...new Set(data.map(r => r.cuisine).filter(Boolean))] as string[]
  return cuisines
}

// =============================================================================
// Create Recipe (saves to recipes table + recipe_ingredients junction table)
// =============================================================================

export async function createRecipe(
  formData: RecipeFormData
): Promise<ActionResult<{ id: string }>> {
  try {
    // Require admin access
    const user = await requireAdmin()
    
    // Validate input
    const validated = recipeSchema.parse(formData)
    
    // Separate ingredients from recipe data
    const { ingredients, ...recipeData } = validated
    
    // Clean up empty image URLs
    const cleanedRecipeData = {
      ...recipeData,
      image_url: recipeData.image_url || null,
    }
    
    const supabase = await createClient()
    
    // 1. Insert the recipe (without ingredients - they go to junction table)
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        ...cleanedRecipeData,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (recipeError) {
      if (recipeError.code === '23505') {
        return { success: false, error: 'A recipe with this name already exists' }
      }
      return { success: false, error: recipeError.message }
    }

    // 2. Insert ingredients into junction table
    if (ingredients && ingredients.length > 0) {
      const ingredientRows = ingredients.map((ing, index) => ({
        recipe_id: recipe.id,
        ingredient_id: ing.is_spice ? null : (ing.ingredient_id || null),
        spice_id: ing.is_spice ? (ing.spice_id || null) : null,
        raw_name: ing.raw_name,
        quantity: ing.is_spice ? null : ing.quantity, // Spices have no quantity
        unit: ing.is_spice ? null : ing.unit,
        is_spice: ing.is_spice,
        is_optional: ing.is_optional,
        sort_order: index,
        is_matched: ing.is_spice ? !!ing.spice_id : !!ing.ingredient_id,
      }))

      const { error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientRows)

      if (ingredientsError) {
        // Rollback: delete the recipe if ingredients failed
        await supabase.from('recipes').delete().eq('id', recipe.id)
        return { success: false, error: `Failed to save ingredients: ${ingredientsError.message}` }
      }
    }

    revalidatePath('/admin/recipes')
    revalidatePath('/admin')
    
    return { success: true, data: { id: recipe.id } }
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to create recipe' }
  }
}

// =============================================================================
// Update Recipe (updates recipes table + replaces recipe_ingredients)
// =============================================================================

export async function updateRecipe(
  id: string,
  formData: RecipeFormData
): Promise<ActionResult> {
  try {
    // Require admin access
    await requireAdmin()
    
    // Validate input
    const validated = recipeSchema.parse(formData)
    
    // Separate ingredients from recipe data
    const { ingredients, ...recipeData } = validated
    
    // Clean up empty image URLs
    const cleanedRecipeData = {
      ...recipeData,
      image_url: recipeData.image_url || null,
    }
    
    const supabase = await createClient()
    
    // 1. Update the recipe (without ingredients)
    const { error: recipeError } = await supabase
      .from('recipes')
      .update(cleanedRecipeData)
      .eq('id', id)

    if (recipeError) {
      if (recipeError.code === '23505') {
        return { success: false, error: 'A recipe with this name already exists' }
      }
      return { success: false, error: recipeError.message }
    }

    // 2. Delete existing ingredients from junction table
    const { error: deleteError } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', id)

    if (deleteError) {
      return { success: false, error: `Failed to update ingredients: ${deleteError.message}` }
    }

    // 3. Insert new ingredients into junction table
    if (ingredients && ingredients.length > 0) {
      const ingredientRows = ingredients.map((ing, index) => ({
        recipe_id: id,
        ingredient_id: ing.is_spice ? null : (ing.ingredient_id || null),
        spice_id: ing.is_spice ? (ing.spice_id || null) : null,
        raw_name: ing.raw_name,
        quantity: ing.is_spice ? null : ing.quantity,
        unit: ing.is_spice ? null : ing.unit,
        is_spice: ing.is_spice,
        is_optional: ing.is_optional,
        sort_order: index,
        is_matched: ing.is_spice ? !!ing.spice_id : !!ing.ingredient_id,
      }))

      const { error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientRows)

      if (ingredientsError) {
        return { success: false, error: `Failed to save ingredients: ${ingredientsError.message}` }
      }
    }

    revalidatePath('/admin/recipes')
    revalidatePath('/admin')
    
    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to update recipe' }
  }
}

// =============================================================================
// Delete Recipe
// =============================================================================

export async function deleteRecipe(id: string): Promise<ActionResult> {
  try {
    // Require admin access
    await requireAdmin()
    
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/recipes')
    revalidatePath('/admin')
    
    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to delete recipe' }
  }
}

// =============================================================================
// Search Ingredients (for ingredient picker)
// =============================================================================

export async function searchIngredients(query: string, limit: number = 10) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name, name_ar, serving_size, serving_unit, macros')
    .or(`name.ilike.%${query}%,name_ar.ilike.%${query}%`)
    .limit(limit)

  if (error) {
    return { ingredients: [], error: error.message }
  }

  return { ingredients: data ?? [], error: null }
}

// =============================================================================
// Search Spices (for ingredient picker)
// =============================================================================

export async function searchSpices(query: string, limit: number = 10) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('spices')
    .select('id, name, name_ar')
    .or(`name.ilike.%${query}%,name_ar.ilike.%${query}%`)
    .limit(limit)

  if (error) {
    return { spices: [], error: error.message }
  }

  return { spices: data ?? [], error: null }
}

// =============================================================================
// USER-FACING: Recipe Details with Scaling
// =============================================================================

export interface RecipeIngredientDetail {
  id: string
  ingredient_id: string | null
  raw_name: string
  quantity: number | null
  scaled_quantity: number | null
  unit: string | null
  is_spice: boolean
  is_optional: boolean
  ingredient?: {
    id: string
    name: string
    name_ar: string | null
    food_group: string | null
    subgroup: string | null
  } | null
}

export interface InstructionStep {
  step: number
  instruction: string
}

export interface UserRecipeDetails {
  id: string
  name: string
  description: string | null
  image_url: string | null
  meal_type: string[]
  cuisine: string | null
  tags: string[]
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  servings: number
  difficulty: string | null
  instructions: InstructionStep[]
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
  recipe_ingredients: RecipeIngredientDetail[]
  // Scaling info
  scale_factor: number
  scaled_calories: number
  original_calories: number
}

export interface IngredientSwapOption {
  id: string
  name: string
  name_ar: string | null
  food_group: string | null
  subgroup: string | null
  serving_size: number
  serving_unit: string
  macros: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number }
  suggested_amount: number
  calorie_diff_percent: number
}

/**
 * Round a number for practical measuring
 * < 10: round to nearest 1
 * >= 10: round to nearest 5
 */
function roundForMeasuring(value: number): number {
  if (value < 10) return Math.round(value)
  return Math.round(value / 5) * 5
}

/**
 * Get recipe details with scaled ingredients for user view
 */
export async function getUserRecipeDetails(options: {
  recipeId: string
  targetCalories?: number
  scaleFactor?: number
}): Promise<{ data: UserRecipeDetails | null; error: string | null }> {
  const supabase = await createClient()
  
  const { recipeId, targetCalories, scaleFactor: providedScaleFactor } = options

  const { data: recipe, error } = await supabase
    .from('recipes')
    .select(`
      id, name, description, image_url, meal_type, cuisine, tags,
      prep_time_minutes, cook_time_minutes, servings, difficulty,
      instructions, nutrition_per_serving,
      is_vegetarian, is_vegan, is_gluten_free, is_dairy_free,
      recipe_ingredients (
        id, ingredient_id, raw_name, quantity, unit, is_spice, is_optional,
        ingredient:ingredients!recipe_ingredients_ingredient_id_fkey (
          id, name, name_ar, food_group, subgroup
        )
      )
    `)
    .eq('id', recipeId)
    .single()

  if (error || !recipe) {
    return { data: null, error: error?.message || 'Recipe not found' }
  }

  const baseCalories = recipe.nutrition_per_serving?.calories || 0
  
  // Determine scale factor
  let scaleFactor = providedScaleFactor || 1
  if (targetCalories && baseCalories > 0) {
    scaleFactor = targetCalories / baseCalories
  }

  // Transform ingredients with scaling
  const transformedIngredients: RecipeIngredientDetail[] = (recipe.recipe_ingredients || []).map((ri: any) => {
    const originalQty = ri.quantity || null
    let scaledQty: number | null = null
    if (originalQty !== null) {
      scaledQty = roundForMeasuring(originalQty * scaleFactor)
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

  // Parse instructions - handle array of objects or strings
  let instructions: InstructionStep[] = []
  if (Array.isArray(recipe.instructions)) {
    instructions = recipe.instructions.map((item: any, index: number) => {
      if (typeof item === 'string') {
        return { step: index + 1, instruction: item }
      }
      return { step: item.step || index + 1, instruction: item.instruction || String(item) }
    })
  } else if (typeof recipe.instructions === 'string') {
    try {
      const parsed = JSON.parse(recipe.instructions)
      instructions = Array.isArray(parsed) 
        ? parsed.map((item: any, index: number) => ({
            step: item.step || index + 1,
            instruction: item.instruction || String(item)
          }))
        : [{ step: 1, instruction: recipe.instructions }]
    } catch {
      instructions = [{ step: 1, instruction: recipe.instructions }]
    }
  }

  const result: UserRecipeDetails = {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    image_url: recipe.image_url,
    meal_type: recipe.meal_type || [],
    cuisine: recipe.cuisine,
    tags: recipe.tags || [],
    prep_time_minutes: recipe.prep_time_minutes,
    cook_time_minutes: recipe.cook_time_minutes,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    instructions,
    nutrition_per_serving: recipe.nutrition_per_serving || {},
    is_vegetarian: recipe.is_vegetarian,
    is_vegan: recipe.is_vegan,
    is_gluten_free: recipe.is_gluten_free,
    is_dairy_free: recipe.is_dairy_free,
    recipe_ingredients: transformedIngredients,
    scale_factor: Math.round(scaleFactor * 100) / 100,
    scaled_calories: Math.round(baseCalories * scaleFactor),
    original_calories: baseCalories,
  }

  return { data: result, error: null }
}

/**
 * Get ingredient swap alternatives
 */
export async function getUserIngredientSwaps(options: {
  ingredientId: string
  targetAmount: number
  targetUnit: string
}): Promise<{ data: IngredientSwapOption[] | null; error: string | null }> {
  const supabase = await createClient()
  
  const { ingredientId, targetAmount } = options

  // Get original ingredient
  const { data: original, error: originalError } = await supabase
    .from('ingredients')
    .select('id, name, name_ar, food_group, subgroup, serving_size, serving_unit, macros')
    .eq('id', ingredientId)
    .single()

  if (originalError || !original) {
    return { data: null, error: originalError?.message || 'Ingredient not found' }
  }

  if (!original.food_group) {
    return { data: [], error: null }
  }

  // Get alternatives in same food group
  const { data: alternatives, error } = await supabase
    .from('ingredients')
    .select('id, name, name_ar, food_group, subgroup, serving_size, serving_unit, macros')
    .eq('food_group', original.food_group)
    .neq('id', ingredientId)
    .limit(20)

  if (error) {
    return { data: null, error: error.message }
  }

  // Calculate calorie equivalence
  const originalCaloriesPerUnit = (original.macros?.calories || 0) / original.serving_size
  const targetCalories = originalCaloriesPerUnit * targetAmount

  const swapOptions: IngredientSwapOption[] = (alternatives || []).map(alt => {
    const altCaloriesPerUnit = (alt.macros?.calories || 0) / alt.serving_size
    
    let suggested_amount = 0
    let calorie_diff_percent = 0
    
    if (targetCalories > 0 && altCaloriesPerUnit > 0) {
      suggested_amount = roundForMeasuring(targetCalories / altCaloriesPerUnit)
      const suggestedCalories = suggested_amount * altCaloriesPerUnit
      calorie_diff_percent = Math.round(((suggestedCalories - targetCalories) / targetCalories) * 100)
    }

    return {
      id: alt.id,
      name: alt.name,
      name_ar: alt.name_ar,
      food_group: alt.food_group,
      subgroup: alt.subgroup,
      serving_size: alt.serving_size,
      serving_unit: alt.serving_unit,
      macros: alt.macros || {},
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

  return { data: swapOptions, error: null }
}
