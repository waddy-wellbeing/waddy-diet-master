'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { spiceSchema, type SpiceFormData } from '@/lib/validators/spices'

// =============================================================================
// Types
// =============================================================================

interface ActionResult<T = void> {
  success: boolean
  error?: string
  data?: T
}

interface GetSpicesParams {
  page?: number
  pageSize?: number
  search?: string
}

interface GetSpicesResult {
  spices: Array<{
    id: string
    name: string
    name_ar: string | null
    aliases: string[]
    is_default: boolean
    created_at: string
  }>
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
// Get Spices (with pagination and search)
// =============================================================================

export async function getSpices({
  page = 1,
  pageSize = 20,
  search = '',
}: GetSpicesParams = {}): Promise<GetSpicesResult> {
  const supabase = await createClient()
  
  const offset = (page - 1) * pageSize

  // Build query
  let query = supabase
    .from('spices')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(offset, offset + pageSize - 1)

  // Apply search filter
  if (search) {
    query = query.or(`name.ilike.%${search}%,name_ar.ilike.%${search}%`)
  }

  const { data, count, error } = await query

  if (error) {
    return { spices: [], total: 0, error: error.message }
  }

  return {
    spices: data ?? [],
    total: count ?? 0,
    error: null,
  }
}

// =============================================================================
// Get Single Spice
// =============================================================================

export async function getSpice(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('spices')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return { spice: null, error: error.message }
  }

  return { spice: data, error: null }
}

// =============================================================================
// Create Spice
// =============================================================================

export async function createSpice(
  formData: SpiceFormData
): Promise<ActionResult<{ id: string }>> {
  try {
    // Require admin access
    await requireAdmin()
    
    // Validate input
    const validated = spiceSchema.parse(formData)
    
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('spices')
      .insert(validated)
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'A spice with this name already exists' }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/spices')
    revalidatePath('/admin')
    
    return { success: true, data: { id: data.id } }
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to create spice' }
  }
}

// =============================================================================
// Update Spice
// =============================================================================

export async function updateSpice(
  id: string,
  formData: SpiceFormData
): Promise<ActionResult> {
  try {
    // Require admin access
    await requireAdmin()
    
    // Validate input
    const validated = spiceSchema.parse(formData)
    
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('spices')
      .update(validated)
      .eq('id', id)

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'A spice with this name already exists' }
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/spices')
    revalidatePath('/admin')
    
    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to update spice' }
  }
}

// =============================================================================
// Delete Spice
// =============================================================================

export async function deleteSpice(id: string): Promise<ActionResult> {
  try {
    // Require admin access
    await requireAdmin()
    
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('spices')
      .delete()
      .eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/spices')
    revalidatePath('/admin')
    
    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'Failed to delete spice' }
  }
}
