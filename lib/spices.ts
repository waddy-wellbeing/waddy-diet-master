import { createClient } from '@/lib/supabase/server'
import type { NutriSpice } from '@/lib/types/nutri'

/**
 * Get all default spices from the database
 * Used for autocomplete/dropdown in recipe ingredient editor
 * 
 * @returns Array of NutriSpice objects ordered by name
 */
export async function getDefaultSpices(): Promise<NutriSpice[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('nutri_spices')
    .select('*')
    .eq('is_default', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching spices:', error)
    return []
  }

  return data as NutriSpice[]
}

/**
 * Search spices by name or alias
 * 
 * @param query - Search term to match against name, name_ar, or aliases
 * @returns Array of matching NutriSpice objects
 */
export async function searchSpices(query: string): Promise<NutriSpice[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('nutri_spices')
    .select('*')
    .eq('is_default', true)
    .or(`name.ilike.%${query}%,name_ar.ilike.%${query}%`)
    .order('name', { ascending: true })
    .limit(20)

  if (error) {
    console.error('Error searching spices:', error)
    return []
  }

  return data as NutriSpice[]
}
