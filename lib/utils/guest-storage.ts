/**
 * Local Storage utilities for guest onboarding data
 * Data is persisted until the user signs in, then synced to the server
 */

const ONBOARDING_STORAGE_KEY = 'waddy_guest_onboarding'

export interface GuestOnboardingData {
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
  completedAt?: string
}

/**
 * Save guest onboarding data to local storage
 */
export function saveGuestOnboardingData(data: GuestOnboardingData): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to save onboarding data to local storage:', error)
  }
}

/**
 * Load guest onboarding data from local storage
 */
export function loadGuestOnboardingData(): GuestOnboardingData | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as GuestOnboardingData
  } catch (error) {
    console.error('Failed to load onboarding data from local storage:', error)
    return null
  }
}

/**
 * Check if guest has completed onboarding
 */
export function hasGuestCompletedOnboarding(): boolean {
  const data = loadGuestOnboardingData()
  return !!data?.completedAt
}

/**
 * Clear guest onboarding data (after successful sync to server)
 */
export function clearGuestOnboardingData(): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear onboarding data from local storage:', error)
  }
}

/**
 * Get initial form state - check local storage first
 */
export function getInitialOnboardingState(): Partial<GuestOnboardingData> {
  const stored = loadGuestOnboardingData()
  if (stored) return stored
  
  return {
    basicInfo: {
      name: '',
      age: '',
      sex: '',
      height: '',
      heightUnit: 'cm',
      weight: '',
      weightUnit: 'kg',
      mobile: '',
    },
    activityLevel: '',
    goals: {
      goalType: '',
      targetWeight: '',
      targetWeightUnit: 'kg',
      pace: '',
    },
    dietaryPreferences: {
      dietType: '',
      allergies: [],
      hasNoAllergies: false,
      dislikes: [],
    },
    lifestyle: {
      cookingSkill: '',
      maxPrepTime: 30,
    },
    mealsPerDay: 3,
  }
}
