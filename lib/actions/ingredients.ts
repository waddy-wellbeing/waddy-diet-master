'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { ingredientSchema, type IngredientFormData } from '@/lib/validators/ingredients'

export type ActionResult<T = void> = 
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Get paginated ingredients with optional search and filters
 */
export async function getIngredients(options: {
  page?: number
  pageSize?: number
  search?: string
  foodGroup?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
} = {}) {
  const {
    page = 1,
    pageSize = 20,
    search = '',
    foodGroup = '',
    sortBy = 'name',
    sortOrder = 'asc',
  } = options

  const supabase = await createClient()
  
  let query = supabase
    .from('ingredients')
    .select('*', { count: 'exact' })

  // Apply search filter
  if (search) {
    query = query.or(`name.ilike.%${search}%,name_ar.ilike.%${search}%`)
  }

  // Apply food group filter
  if (foodGroup) {
    query = query.eq('food_group', foodGroup)
  }

  // Apply sorting
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })

  // Apply pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching ingredients:', error)
    return { ingredients: [], total: 0, error: error.message }
  }

  return {
    ingredients: data ?? [],
    total: count ?? 0,
    error: null,
  }
}

/**
 * Get a single ingredient by ID
 */
export async function getIngredient(id: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return { ingredient: null, error: error.message }
  }

  return { ingredient: data, error: null }
}

/**
 * Create a new ingredient
 */
export async function createIngredient(
  formData: IngredientFormData
): Promise<ActionResult<{ id: string }>> {
  try {
    // Require admin access
    const user = await requireAdmin()
    
    // Validate input
    const validated = ingredientSchema.parse(formData)
    
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('ingredients')
      .insert({
        ...validated,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'An ingredient with this name already exists' }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/ingredients')
    revalidatePath('/admin')
    
    return { success: true, data: { id: data.id } }
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to create ingredient' }
  }
}

/**
 * Update an existing ingredient
 */
export async function updateIngredient(
  id: string,
  formData: IngredientFormData
): Promise<ActionResult> {
  try {
    // Require admin access
    await requireAdmin()
    
    // Validate input
    const validated = ingredientSchema.parse(formData)
    
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('ingredients')
      .update(validated)
      .eq('id', id)

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'An ingredient with this name already exists' }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/ingredients')
    revalidatePath('/admin')
    
    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to update ingredient' }
  }
}

/**
 * Delete an ingredient
 */
export async function deleteIngredient(id: string): Promise<ActionResult> {
  try {
    // Require admin access
    await requireAdmin()
    
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/ingredients')
    revalidatePath('/admin')
    
    return { success: true, data: undefined }
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to delete ingredient' }
  }
}

/**
 * Get unique food groups for filter dropdown
 */
export async function getFoodGroups() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('ingredients')
    .select('food_group')
    .not('food_group', 'is', null)
    .order('food_group')

  if (error) {
    return []
  }

  // Get unique values
  const uniqueGroups = [...new Set(data.map((d) => d.food_group).filter(Boolean))]
  return uniqueGroups as string[]
}

/**
 * Get unique subgroups for dropdown
 */
export async function getSubgroups() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('ingredients')
    .select('subgroup')
    .not('subgroup', 'is', null)
    .order('subgroup')

  if (error) {
    return []
  }

  // Get unique values
  const uniqueSubgroups = [...new Set(data.map((d) => d.subgroup).filter(Boolean))]
  return uniqueSubgroups as string[]
}

/**
 * Get food groups with their associated subgroups
 * Returns a map of food_group -> subgroup[]
 */
export async function getFoodGroupsWithSubgroups() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('ingredients')
    .select('food_group, subgroup')
    .not('food_group', 'is', null)
    .not('subgroup', 'is', null)
    .order('food_group')
    .order('subgroup')

  if (error) {
    return {}
  }

  // Group subgroups by food_group
  const groupMap: Record<string, string[]> = {}
  
  for (const item of data) {
    if (!item.food_group || !item.subgroup) continue
    
    if (!groupMap[item.food_group]) {
      groupMap[item.food_group] = []
    }
    
    // Add subgroup if not already present
    if (!groupMap[item.food_group].includes(item.subgroup)) {
      groupMap[item.food_group].push(item.subgroup)
    }
  }

  return groupMap
}
