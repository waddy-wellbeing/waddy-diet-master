'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { calculateTDEE } from '@/lib/utils/tdee'
import { detectCountry } from '@/lib/utils/phone'
import type {
  ProfileBasicInfo,
  ProfileGoals,
  ProfilePreferences,
} from '@/lib/types/nutri'

interface UpdateProfileData {
  basic_info?: {
    name?: string
    age?: number
    height_cm?: number
    weight_kg?: number
    sex?: 'male' | 'female' | 'other'
  }
  mobile?: string
  activity_level?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  goals?: {
    goal_type?: 'lose_weight' | 'maintain' | 'build_muscle' | 'recomposition'
    target_weight_kg?: number
    pace?: 'slow' | 'moderate' | 'aggressive'
  }
  preferences?: {
    cooking_skill?: 'beginner' | 'intermediate' | 'advanced'
    max_prep_time_minutes?: number
    meals_per_day?: 3 | 4 | 5
  }
}

type UpdateResult = { success: true } | { success: false; error: string }

export async function updateProfile(data: UpdateProfileData): Promise<UpdateResult> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get current profile
    const { data: currentProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (fetchError || !currentProfile) {
      return { success: false, error: 'Profile not found' }
    }

    // Build update object with proper typing
    const updates: {
      basic_info?: ProfileBasicInfo
      goals?: ProfileGoals
      preferences?: ProfilePreferences
      targets?: {
        bmr: number
        tdee: number
        daily_calories: number
        protein_g: number
        carbs_g: number
        fat_g: number
      }
    } = {}

    // Handle basic_info updates
    if (data.basic_info) {
      const currentBasicInfo = currentProfile.basic_info as ProfileBasicInfo || {}
      updates.basic_info = {
        ...currentBasicInfo,
        ...data.basic_info,
      }
      
      // Also update activity_level in basic_info if it was passed separately
      if (data.activity_level) {
        updates.basic_info.activity_level = data.activity_level
      }
    } else if (data.activity_level) {
      // Only activity level is being updated
      const currentBasicInfo = currentProfile.basic_info as ProfileBasicInfo || {}
      updates.basic_info = {
        ...currentBasicInfo,
        activity_level: data.activity_level,
      }
    }

    // Handle goals updates
    if (data.goals) {
      const currentGoals = currentProfile.goals as ProfileGoals || {}
      updates.goals = {
        ...currentGoals,
        ...data.goals,
      }
    }

    // Handle preferences updates
    if (data.preferences) {
      const currentPrefs = currentProfile.preferences as ProfilePreferences || {}
      updates.preferences = {
        ...currentPrefs,
        ...data.preferences,
      }
    }

    // Recalculate TDEE if relevant fields changed
    const shouldRecalculateTDEE =
      data.basic_info?.age !== undefined ||
      data.basic_info?.sex !== undefined ||
      data.basic_info?.weight_kg !== undefined ||
      data.basic_info?.height_cm !== undefined ||
      data.activity_level !== undefined ||
      data.goals?.goal_type !== undefined ||
      data.goals?.pace !== undefined

    if (shouldRecalculateTDEE) {
      // Get merged values for calculation
      const mergedBasicInfo: ProfileBasicInfo = updates.basic_info || currentProfile.basic_info as ProfileBasicInfo || {}
      const mergedGoals: ProfileGoals = updates.goals || currentProfile.goals as ProfileGoals || {}

      // Only calculate if we have all required values
      if (
        mergedBasicInfo.age &&
        mergedBasicInfo.sex &&
        mergedBasicInfo.weight_kg &&
        mergedBasicInfo.height_cm &&
        mergedBasicInfo.activity_level
      ) {
        const tdeeResult = calculateTDEE({
          age: mergedBasicInfo.age,
          sex: mergedBasicInfo.sex as 'male' | 'female',
          weight_kg: mergedBasicInfo.weight_kg,
          height_cm: mergedBasicInfo.height_cm,
          activity_level: mergedBasicInfo.activity_level,
          goal_type: mergedGoals.goal_type || 'maintain',
          pace: mergedGoals.pace || 'moderate',
        })

        updates.targets = {
          bmr: tdeeResult.bmr,
          tdee: tdeeResult.tdee,
          daily_calories: tdeeResult.daily_calories,
          protein_g: tdeeResult.protein_g,
          carbs_g: tdeeResult.carbs_g,
          fat_g: tdeeResult.fat_g,
        }
      }
    }

    // Update profile
    const updateData: any = {
      ...updates,
      updated_at: new Date().toISOString(),
    }
    
    // Add mobile if provided
    if (data.mobile !== undefined) {
      updateData.mobile = data.mobile || null
      // Extract and update country code
      if (data.mobile) {
        updateData.country_code = detectCountry(data.mobile) || null
      } else {
        updateData.country_code = null
      }
    }
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Profile update error:', updateError)
      
      // Handle duplicate mobile number error
      if (updateError.code === '23505' && updateError.message.includes('profiles_mobile_country_unique')) {
        return { success: false, error: 'This phone number is already registered. Please use a different number.' }
      }
      
      return { success: false, error: 'Failed to update profile' }
    }

    // Revalidate profile page
    revalidatePath('/profile')
    revalidatePath('/dashboard')
    revalidatePath('/nutrition')

    return { success: true }
  } catch (error) {
    console.error('Unexpected error updating profile:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
