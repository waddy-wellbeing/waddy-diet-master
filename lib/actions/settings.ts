'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SystemSettingRecord, SystemSettingsMap, SystemSettingKey } from '@/lib/types/nutri'

/**
 * Get all system settings
 */
export async function getSystemSettings(): Promise<{
  data: SystemSettingRecord[] | null
  error: string | null
}> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .order('key')
  
  if (error) {
    console.error('Error fetching system settings:', error)
    return { data: null, error: error.message }
  }
  
  return { data, error: null }
}

/**
 * Get a single system setting by key
 */
export async function getSystemSetting<K extends SystemSettingKey>(
  key: K
): Promise<{
  data: SystemSettingsMap[K] | null
  error: string | null
}> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .single()
  
  if (error) {
    console.error(`Error fetching setting ${key}:`, error)
    return { data: null, error: error.message }
  }
  
  // Parse the value - it might be stored as a string or object
  let parsedValue = data.value
  if (typeof parsedValue === 'string') {
    try {
      parsedValue = JSON.parse(parsedValue)
    } catch {
      // If it's a simple string/number, parseFloat or keep as-is
      const num = parseFloat(parsedValue)
      if (!isNaN(num)) {
        parsedValue = num
      }
    }
  }
  
  return { data: parsedValue as SystemSettingsMap[K], error: null }
}

/**
 * Update a system setting
 */
export async function updateSystemSetting(
  key: string,
  value: unknown,
  description?: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  // Get current user for updated_by
  const { data: { user } } = await supabase.auth.getUser()
  
  const updateData: {
    value: unknown
    updated_by: string | null
    description?: string
  } = {
    value,
    updated_by: user?.id || null,
  }
  
  if (description !== undefined) {
    updateData.description = description
  }
  
  const { error } = await supabase
    .from('system_settings')
    .update(updateData)
    .eq('key', key)
  
  if (error) {
    console.error(`Error updating setting ${key}:`, error)
    return { success: false, error: error.message }
  }
  
  revalidatePath('/admin/settings')
  return { success: true, error: null }
}

/**
 * Create a new system setting
 */
export async function createSystemSetting(
  key: string,
  value: unknown,
  description: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  // Get current user for updated_by
  const { data: { user } } = await supabase.auth.getUser()
  
  const { error } = await supabase
    .from('system_settings')
    .insert({
      key,
      value,
      description,
      updated_by: user?.id || null,
    })
  
  if (error) {
    console.error(`Error creating setting ${key}:`, error)
    return { success: false, error: error.message }
  }
  
  revalidatePath('/admin/settings')
  return { success: true, error: null }
}

/**
 * Delete a system setting
 */
export async function deleteSystemSetting(
  key: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('system_settings')
    .delete()
    .eq('key', key)
  
  if (error) {
    console.error(`Error deleting setting ${key}:`, error)
    return { success: false, error: error.message }
  }
  
  revalidatePath('/admin/settings')
  return { success: true, error: null }
}

/**
 * Get meal distribution settings with defaults
 */
export async function getMealDistribution() {
  const { data, error } = await getSystemSetting('meal_distribution')
  
  if (error || !data) {
    // Return defaults
    return {
      breakfast: 0.25,
      lunch: 0.35,
      dinner: 0.30,
      snacks: 0.10,
    }
  }
  
  return data
}

/**
 * Get deviation tolerance with default
 */
export async function getDeviationTolerance(): Promise<number> {
  const { data } = await getSystemSetting('deviation_tolerance')
  return data ?? 0.25
}
