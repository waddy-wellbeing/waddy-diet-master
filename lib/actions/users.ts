'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { MealSlot, PlanStatus, ProfileBasicInfo, ProfileTargets, ProfilePreferences, ProfileGoals } from '@/lib/types/nutri'

// Normalize legacy decimal percentages (0-1) to percentage values (0-100)
const normalizeMealStructurePercentages = (structure: MealSlot[] = []): MealSlot[] => {
  const total = structure.reduce((sum, meal) => sum + (meal.percentage || 0), 0)
  if (total > 0 && total <= 1.5) {
    return structure.map(meal => ({ ...meal, percentage: meal.percentage * 100 }))
  }
  return structure
}

export interface UserWithProfile {
  id: string
  email: string
  created_at: string
  profile: {
    id: string
    name: string | null
    email: string | null
    mobile?: string | null
    avatar_url: string | null
    role: 'admin' | 'moderator' | 'client'
    plan_status: PlanStatus
    basic_info: {
      name?: string
      age?: number
      height_cm?: number
      weight_kg?: number
      sex?: string
      activity_level?: string
    }
    targets: {
      daily_calories?: number
      protein_g?: number
      carbs_g?: number
      fat_g?: number
      fiber_g?: number
      bmr?: number
      tdee?: number
    }
    preferences: {
      meals_per_day?: number
      meal_structure?: MealSlot[]
      diet_type?: string
      allergies?: string[]
      dislikes?: string[]
      cuisine_preferences?: string[]
      cooking_skill?: string
      max_prep_time_minutes?: number
    }
    goals: {
      goal_type?: string
      target_weight_kg?: number
      pace?: string
    }
    onboarding_completed: boolean
    onboarding_step: number
  } | null
}

/**
 * Get all users with their profiles
 */
export async function getUsers(options?: {
  planStatus?: PlanStatus
  search?: string
  page?: number
  pageSize?: number
}): Promise<{
  data: UserWithProfile[] | null
  count: number
  error: string | null
}> {
  const supabase = await createClient()
  const page = options?.page || 1
  const pageSize = options?.pageSize || 20
  const offset = (page - 1) * pageSize

  // First get profiles with optional filters
  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })

  if (options?.planStatus) {
    query = query.eq('plan_status', options.planStatus)
  }

  // Add search filters if provided (include JSON basic_info.name)
  if (options?.search) {
    const trimmed = options.search.trim()
    const searchTerm = `%${trimmed}%`
    // Avoid ilike on UUIDs (causes errors); search text fields + JSON name
    query = query.or(
      `name.ilike.${searchTerm},email.ilike.${searchTerm},mobile.ilike.${searchTerm},basic_info->>name.ilike.${searchTerm}`
    )
  }

  // Get profiles
  const { data: profiles, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) {
    console.error('Error fetching profiles:', error)
    return { data: null, count: 0, error: error.message }
  }

  if (!profiles || profiles.length === 0) {
    return { data: [], count: 0, error: null }
  }

  // Get auth users for email info using admin client
  // For now, we'll use the profile data and show user_id as identifier
  // In production, you'd use the service role to fetch auth.users
  
  const users: UserWithProfile[] = profiles.map((profile) => ({
    id: profile.user_id,
    email: profile.email || `User ${profile.user_id.slice(0, 8)}...`,
    created_at: profile.created_at,
    profile: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      mobile: profile.mobile,
      avatar_url: profile.avatar_url,
      role: profile.role,
      plan_status: profile.plan_status,
      basic_info: profile.basic_info || {},
      targets: profile.targets || {},
      preferences: profile.preferences || {},
      goals: profile.goals || {},
      onboarding_completed: profile.onboarding_completed,
      onboarding_step: profile.onboarding_step,
    },
  }))

  // Return server-filtered results directly; count reflects server-side total
  return { data: users, count: count || 0, error: null }
}

/**
 * Get a single user with profile
 */
export async function getUser(userId: string): Promise<{
  data: UserWithProfile | null
  error: string | null
}> {
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('Error fetching user:', error)
    return { data: null, error: error.message }
  }

  return {
    data: {
      id: profile.user_id,
      email: profile.email || `User ${profile.user_id.slice(0, 8)}...`,
      created_at: profile.created_at,
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        mobile: profile.mobile,
        avatar_url: profile.avatar_url,
        role: profile.role,
        plan_status: profile.plan_status,
        basic_info: profile.basic_info || {},
        targets: profile.targets || {},
        preferences: profile.preferences || {},
        goals: profile.goals || {},
        onboarding_completed: profile.onboarding_completed,
        onboarding_step: profile.onboarding_step,
      },
    },
    error: null,
  }
}

/**
 * Assign meal structure to a user
 */
export async function assignMealStructure(
  userId: string,
  mealStructure: MealSlot[],
  dailyCalories?: number
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  const normalizedStructure = normalizeMealStructurePercentages(mealStructure)

  // Validate percentages sum to 100
  const totalPercentage = normalizedStructure.reduce((sum, meal) => sum + meal.percentage, 0)
  if (Math.abs(totalPercentage - 100) > 0.5) {
    return { 
      success: false, 
      error: `Percentages must sum to 100% (currently ${totalPercentage.toFixed(1)}%)` 
    }
  }

  // Get current profile to merge preferences
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('preferences, targets')
    .eq('user_id', userId)
    .single()

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  // Calculate target calories per meal if daily_calories is set
  const calories = dailyCalories || profile.targets?.daily_calories
  const structureWithCalories = normalizedStructure.map(meal => ({
    ...meal,
    target_calories: calories ? Math.round(calories * (meal.percentage / 100)) : undefined,
  }))

  // Update preferences with meal structure
  const updatedPreferences = {
    ...profile.preferences,
    meals_per_day: normalizedStructure.length,
    meal_structure: structureWithCalories,
  }

  // Update targets if daily_calories provided
  const updatedTargets = dailyCalories 
    ? { ...profile.targets, daily_calories: dailyCalories }
    : profile.targets

  // Update profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      preferences: updatedPreferences,
      targets: updatedTargets,
      plan_status: 'active',
    })
    .eq('user_id', userId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // Send plan assignment notification (non-blocking)
  // Use today's date as the plan effective date
  const today = new Date().toISOString().split('T')[0]
  import('@/lib/actions/notifications')
    .then(({ sendPlanUpdateNotification }) => {
      sendPlanUpdateNotification(userId, today, true).catch(err => {
        console.error('Failed to send plan assignment notification:', err)
      })
    })
    .catch(err => {
      console.error('Failed to import notification module:', err)
    })

  revalidatePath('/admin/users')
  return { success: true, error: null }
}

/**
 * Update user's plan status
 */
export async function updatePlanStatus(
  userId: string,
  status: PlanStatus
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({ plan_status: status })
    .eq('user_id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/users')
  return { success: true, error: null }
}

/**
 * Update user's daily calories target
 */
export async function updateUserCalories(
  userId: string,
  dailyCalories: number
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  // Get current profile
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('targets, preferences')
    .eq('user_id', userId)
    .single()

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  // Recalculate meal calories if structure exists
  const mealStructure = profile.preferences?.meal_structure
    ? normalizeMealStructurePercentages(profile.preferences.meal_structure as MealSlot[])
    : undefined
  let updatedPreferences = profile.preferences

  if (mealStructure && mealStructure.length > 0) {
    const updatedStructure = normalizeMealStructurePercentages(mealStructure).map(meal => ({
      ...meal,
      target_calories: Math.round(dailyCalories * (meal.percentage / 100)),
    }))
    updatedPreferences = {
      ...profile.preferences,
      meal_structure: updatedStructure,
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      targets: { ...profile.targets, daily_calories: dailyCalories },
      preferences: updatedPreferences,
    })
    .eq('user_id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/users')
  return { success: true, error: null }
}

/**
 * Update user's basic info
 */
export async function updateUserBasicInfo(
  userId: string,
  basicInfo: Partial<ProfileBasicInfo>,
  name?: string,
  mobile?: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  // Get current profile
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('basic_info')
    .eq('user_id', userId)
    .single()

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  const updateData: Record<string, unknown> = {
    basic_info: { ...profile.basic_info, ...basicInfo },
  }
  
  if (name !== undefined) {
    updateData.name = name
  }
  
  if (mobile !== undefined) {
    updateData.mobile = mobile || null
  }

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('user_id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return { success: true, error: null }
}

/**
 * Update user's targets
 */
export async function updateUserTargets(
  userId: string,
  targets: Partial<ProfileTargets>
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  // Get current profile
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('targets, preferences')
    .eq('user_id', userId)
    .single()

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

    const mealStructure = profile.preferences?.meal_structure
      ? normalizeMealStructurePercentages(profile.preferences.meal_structure as MealSlot[])
      : undefined
    const updatedStructure = mealStructure
      ? mealStructure.map(meal => ({
          ...meal,
          target_calories: Math.round(targets.daily_calories! * (meal.percentage / 100)),
        }))
      : undefined

    const updatedTargets = { ...profile.targets, ...targets }
  
    // Update preferences with meal structure (if exists)
    const updatedPreferences = {
      ...profile.preferences,
      ...(updatedStructure ? { meal_structure: updatedStructure } : {}),
    }

  const { error } = await supabase
    .from('profiles')
    .update({
      targets: updatedTargets,
      preferences: updatedPreferences,
    })
    .eq('user_id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return { success: true, error: null }
}

/**
 * Update user's preferences
 */
export async function updateUserPreferences(
  userId: string,
  preferences: Partial<ProfilePreferences>
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  // Get current profile
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('user_id', userId)
    .single()

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      preferences: { ...profile.preferences, ...preferences },
    })
    .eq('user_id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return { success: true, error: null }
}

/**
 * Update user's goals
 */
export async function updateUserGoals(
  userId: string,
  goals: Partial<ProfileGoals>
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()

  // Get current profile
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('goals')
    .eq('user_id', userId)
    .single()

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      goals: { ...profile.goals, ...goals },
    })
    .eq('user_id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return { success: true, error: null }
}
