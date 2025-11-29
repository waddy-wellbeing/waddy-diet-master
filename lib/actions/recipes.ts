'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { recipeSchema, type RecipeFormData } from '@/lib/validators/recipes'

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
}: GetRecipesParams = {}): Promise<GetRecipesResult> {
  const supabase = await createClient()
  
  const offset = (page - 1) * pageSize

  // Build query
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
      created_at
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

  return {
    recipes: data ?? [],
    total: count ?? 0,
    error: null,
  }
}

// =============================================================================
// Get Single Recipe (full details)
// =============================================================================

export async function getRecipe(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return { recipe: null, error: error.message }
  }

  return { recipe: data, error: null }
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
// Create Recipe
// =============================================================================

export async function createRecipe(
  formData: RecipeFormData
): Promise<ActionResult<{ id: string }>> {
  try {
    // Require admin access
    const user = await requireAdmin()
    
    // Validate input
    const validated = recipeSchema.parse(formData)
    
    // Clean up empty image_url
    const cleanedData = {
      ...validated,
      image_url: validated.image_url || null,
    }
    
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('recipes')
      .insert({
        ...cleanedData,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'A recipe with this name already exists' }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/recipes')
    revalidatePath('/admin')
    
    return { success: true, data: { id: data.id } }
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to create recipe' }
  }
}

// =============================================================================
// Update Recipe
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
    
    // Clean up empty image_url
    const cleanedData = {
      ...validated,
      image_url: validated.image_url || null,
    }
    
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('recipes')
      .update(cleanedData)
      .eq('id', id)

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'A recipe with this name already exists' }
      }
      return { success: false, error: error.message }
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
