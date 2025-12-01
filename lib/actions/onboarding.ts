'use server'

import { createClient } from '@/lib/supabase/server'
import { calculateTDEE } from '@/lib/utils/tdee'
import type {
  ProfileBasicInfo,
  ProfileTargets,
  ProfilePreferences,
  ProfileGoals,
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
  }
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | ''
  goals: {
    goalType: 'lose_weight' | 'maintain' | 'build_muscle' | ''
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

export async function saveOnboardingData(formData: OnboardingFormData) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  const { basicInfo, activityLevel, goals, dietaryPreferences, lifestyle, mealsPerDay } = formData

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

  const profilePreferences: ProfilePreferences = {
    diet_type: dietaryPreferences.dietType || undefined,
    allergies: dietaryPreferences.allergies.length > 0 ? dietaryPreferences.allergies : undefined,
    dislikes: dietaryPreferences.dislikes.length > 0 ? dietaryPreferences.dislikes : undefined,
    cooking_skill: lifestyle.cookingSkill || undefined,
    max_prep_time_minutes: lifestyle.maxPrepTime,
    meals_per_day: mealsPerDay,
  }

  const profileGoals: ProfileGoals = {
    goal_type: goals.goalType || undefined,
    target_weight_kg: goals.targetWeight ? parseFloat(goals.targetWeight) : undefined,
    pace: goals.pace || undefined,
  }

  // Upsert profile (handles both create and update)
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        user_id: user.id,
        name: basicInfo.name,
        email: user.email,
        basic_info: profileBasicInfo,
        targets: profileTargets,
        preferences: profilePreferences,
        goals: profileGoals,
        onboarding_completed: true,
        onboarding_step: 8,
        plan_status: 'pending_assignment',
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    )

  if (profileError) {
    console.error('Profile update error:', profileError)
    throw new Error('Failed to save profile')
  }

  return { success: true }
}
