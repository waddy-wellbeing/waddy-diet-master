'use server'

import { createClient } from '@/lib/supabase/server'
import { calculateTDEE } from '@/lib/utils/tdee'
import { detectCountry } from '@/lib/utils/phone'
import type {
  ProfileBasicInfo,
  ProfileTargets,
  ProfilePreferences,
  ProfileGoals,
  MealSlot,
} from '@/lib/types/nutri'

interface OnboardingFormData {
  basicInfo: {
    name: string
    age: string
    sex: 'male' | 'female' | 'other' | ''
    height: string
    heightUnit: 'cm' | 'ft'
    weight: string
    weightUnit: 'kg' | 'lbs'
    mobile?: string
  }
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | ''
  goals: {
    goalType: 'lose_weight' | 'maintain' | 'build_muscle' | 'recomposition' | ''
    targetWeight: string
    targetWeightUnit: 'kg' | 'lbs'
    pace: 'slow' | 'moderate' | 'aggressive' | ''
  }
  dietaryPreferences: {
    dietType: 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | ''
    allergies: string[]
    hasNoAllergies: boolean
    dislikes: string[]
  }
  lifestyle: {
    cookingSkill: 'beginner' | 'intermediate' | 'advanced' | ''
    maxPrepTime: number
  }
  mealsPerDay: 3 | 4 | 5
}

type SaveResult = { success: true } | { success: false; error: string }

export async function saveOnboardingData(formData: OnboardingFormData): Promise<SaveResult> {
  console.log('=== saveOnboardingData called ===')
  console.log('Form data received:', JSON.stringify(formData, null, 2))
  
  try {
    console.log('Creating Supabase client...')
    const supabase = await createClient()
    console.log('Supabase client created')
    
    console.log('Getting user...')
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('User result:', { userId: user?.id, authError: authError?.message })
    
    if (authError) {
      console.error('Auth error:', authError)
      return { success: false, error: 'Authentication error' }
    }
    
    if (!user) {
      console.error('No user found')
      return { success: false, error: 'Not authenticated' }
    }

    console.log('Saving onboarding data for user:', user.id)

    const { basicInfo, activityLevel, goals, dietaryPreferences, lifestyle, mealsPerDay } = formData
    const mobile = basicInfo.mobile || undefined

    // Extract country code from mobile number
    const countryCode = mobile ? detectCountry(mobile) : null

    // Parse and convert values (always store in metric)
    const height_cm = parseFloat(basicInfo.height) || 0
    const weight_kg = parseFloat(basicInfo.weight) || 0
    const age = parseInt(basicInfo.age) || 0
    const sex = basicInfo.sex === 'male' || basicInfo.sex === 'female' ? basicInfo.sex : 'male'
    const activity = activityLevel || 'moderate'
    const goalType = goals.goalType || 'maintain'
    const pace = goals.pace || 'moderate'

    // Calculate TDEE and targets
    const calculations = calculateTDEE({
      age,
      sex,
      weight_kg,
      height_cm,
      activity_level: activity,
      goal_type: goalType,
      pace,
    })

    // Build profile data structures
    const profileBasicInfo: ProfileBasicInfo = {
      name: basicInfo.name,
      age,
      height_cm,
      weight_kg,
      sex: basicInfo.sex || undefined,
      activity_level: activityLevel || undefined,
    }

    const profileTargets: ProfileTargets = {
      daily_calories: calculations.daily_calories,
      protein_g: calculations.protein_g,
      carbs_g: calculations.carbs_g,
      fat_g: calculations.fat_g,
      bmr: calculations.bmr,
      tdee: calculations.tdee,
    }

    // Generate default meal structure based on user's requested meal count
    const defaultMealStructure: MealSlot[] = 
      mealsPerDay === 3 ? [
        { name: 'breakfast', label: 'Breakfast', percentage: 25 },
        { name: 'lunch', label: 'Lunch', percentage: 40 },
        { name: 'dinner', label: 'Dinner', percentage: 35 },
      ] : mealsPerDay === 4 ? [
        { name: 'breakfast', label: 'Breakfast', percentage: 25 },
        { name: 'lunch', label: 'Lunch', percentage: 30 },
        { name: 'dinner', label: 'Dinner', percentage: 30 },
        { name: 'snacks', label: 'Snacks', percentage: 15 },
      ] : [
        { name: 'breakfast', label: 'Breakfast', percentage: 25 },
        { name: 'mid_morning', label: 'Mid-Morning', percentage: 10 },
        { name: 'lunch', label: 'Lunch', percentage: 30 },
        { name: 'afternoon', label: 'Afternoon', percentage: 10 },
        { name: 'dinner', label: 'Dinner', percentage: 25 },
      ]

    // Calculate target calories per meal (same pattern as assignMealStructure)
    const mealStructure = defaultMealStructure.map(meal => ({
      ...meal,
      target_calories: Math.round(calculations.daily_calories * (meal.percentage / 100)),
    }))

    const profilePreferences: ProfilePreferences = {
      diet_type: dietaryPreferences.dietType || undefined,
      allergies: dietaryPreferences.allergies.length > 0 ? dietaryPreferences.allergies : undefined,
      dislikes: dietaryPreferences.dislikes.length > 0 ? dietaryPreferences.dislikes : undefined,
      cooking_skill: lifestyle.cookingSkill || undefined,
      max_prep_time_minutes: lifestyle.maxPrepTime,
      meals_per_day: mealsPerDay,
      meal_structure: mealStructure,
    }

    const profileGoals: ProfileGoals = {
      goal_type: goals.goalType || undefined,
      target_weight_kg: goals.targetWeight ? parseFloat(goals.targetWeight) : undefined,
      pace: goals.pace || undefined,
    }

    // Upsert profile (handles both create and update)
    console.log('Upserting profile for user:', user.id)
    
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          name: basicInfo.name,
          email: user.email,
          mobile: mobile || null,
          country_code: countryCode || null,
          basic_info: profileBasicInfo,
          targets: profileTargets,
          preferences: profilePreferences,
          goals: profileGoals,
          onboarding_completed: true,
          onboarding_step: 8,
          plan_status: 'pending_assignment',
        },
        {
          onConflict: 'user_id',
        }
      )
      .select()
      .single()

    console.log('Upsert result:', { profileData, profileError })

    if (profileError) {
      console.error('Profile update error:', profileError)
      
      // Handle duplicate mobile number error with user-friendly message
      if (profileError.code === '23505' && profileError.message.includes('profiles_mobile_country_unique')) {
        return { success: false, error: 'This phone number is already registered. Please use a different number or sign in.' }
      }
      
      return { success: false, error: 'Failed to save your information. Please try again.' }
    }

    console.log('Onboarding saved successfully')
    return { success: true }
  } catch (error) {
    console.error('Unexpected error in saveOnboardingData:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Sync guest onboarding data after user signs up
 * This is called from the signup page when there's local storage data
 */
export async function syncGuestOnboardingData(formData: OnboardingFormData): Promise<SaveResult> {
  return saveOnboardingData(formData)
}
