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

  // First, get the recipes with their ingredient counts using a raw query approach
  // We query the base recipes table and compute counts via recipe_ingredients
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
    .range(offset, offset + pageSize - 1)

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
  const filteredRecipes = hasIssues 
    ? recipes.filter(r => r.ingredient_count === 0 || r.unmatched_count > 0)
    : recipes

  return {
    recipes: filteredRecipes,
    total: hasIssues ? filteredRecipes.length : (count ?? 0),
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
    
    // Clean up empty image_url
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
    
    // Clean up empty image_url
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
