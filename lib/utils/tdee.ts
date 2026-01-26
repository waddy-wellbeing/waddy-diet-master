/**
 * TDEE (Total Daily Energy Expenditure) Calculator
 * 
 * Uses Mifflin-St Jeor equation for BMR calculation
 * Then applies activity multiplier and goal adjustments
 */

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type GoalType = 'lose_weight' | 'maintain' | 'build_muscle' | 'recomposition'
export type Pace = 'slow' | 'moderate' | 'aggressive'

export interface TDEEInput {
  age: number
  sex: Sex
  weight_kg: number
  height_cm: number
  activity_level: ActivityLevel
  goal_type: GoalType
  pace?: Pace
}

export interface TDEEResult {
  bmr: number
  tdee: number
  daily_calories: number
  calorie_adjustment: number
  protein_g: number
  carbs_g: number
  fat_g: number
  // Breakdown info
  activity_multiplier: number
  goal_adjustment_percent: number
}

// Activity level multipliers (Harris-Benedict style)
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,      // Little or no exercise
  light: 1.375,        // Light exercise 1-3 days/week
  moderate: 1.55,      // Moderate exercise 3-5 days/week
  active: 1.725,       // Hard exercise 6-7 days/week
  very_active: 1.9,    // Very hard exercise, physical job
}

// Goal adjustments (percentage of TDEE)
const GOAL_ADJUSTMENTS: Record<GoalType, Record<Pace, number>> = {
  lose_weight: {
    slow: -0.10,       // -10% (lose ~0.25kg/week)
    moderate: -0.20,   // -20% (lose ~0.5kg/week)
    aggressive: -0.25, // -25% (lose ~0.75kg/week)
  },
  maintain: {
    slow: 0,
    moderate: 0,
    aggressive: 0,
  },
  build_muscle: {
    slow: 0.10,        // +10% (lean bulk)
    moderate: 0.15,    // +15% (moderate bulk)
    aggressive: 0.20,  // +20% (aggressive bulk)
  },
  recomposition: {
    slow: -0.05,       // -5% (slight deficit, high protein)
    moderate: 0,       // maintenance calories, high protein
    aggressive: 0.05,  // +5% (slight surplus, high protein)
  },
}

// Activity level labels for display
export const ACTIVITY_LABELS: Record<ActivityLevel, { label: string; description: string }> = {
  sedentary: { 
    label: 'Sedentary', 
    description: 'Little or no exercise, desk job' 
  },
  light: { 
    label: 'Lightly Active', 
    description: 'Light exercise 1-3 days/week' 
  },
  moderate: { 
    label: 'Moderately Active', 
    description: 'Moderate exercise 3-5 days/week' 
  },
  active: { 
    label: 'Very Active', 
    description: 'Hard exercise 6-7 days/week' 
  },
  very_active: { 
    label: 'Extra Active', 
    description: 'Very hard exercise, physical job' 
  },
}

// Goal labels for display
export const GOAL_LABELS: Record<GoalType, { label: string; description: string }> = {
  lose_weight: { 
    label: 'Lose Weight', 
    description: 'Create calorie deficit to lose fat' 
  },
  maintain: { 
    label: 'Maintain Weight', 
    description: 'Keep current weight stable' 
  },
  build_muscle: { 
    label: 'Build Muscle', 
    description: 'Create calorie surplus for muscle growth' 
  },
  recomposition: {
    label: 'Body Recomposition',
    description: 'Build muscle while losing fat'
  },
}

// Pace labels for display
export const PACE_LABELS: Record<Pace, { label: string; description: string }> = {
  slow: { 
    label: 'Slow', 
    description: 'Gradual, sustainable change' 
  },
  moderate: { 
    label: 'Moderate', 
    description: 'Balanced approach' 
  },
  aggressive: { 
    label: 'Aggressive', 
    description: 'Faster results, more challenging' 
  },
}

/**
 * Calculate BMR using Mifflin-St Jeor Equation
 * More accurate than Harris-Benedict for modern populations
 */
export function calculateBMR(
  weight_kg: number,
  height_cm: number,
  age: number,
  sex: Sex
): number {
  // Mifflin-St Jeor Equation
  // Men: BMR = (10 × weight in kg) + (6.25 × height in cm) − (5 × age in years) + 5
  // Women: BMR = (10 × weight in kg) + (6.25 × height in cm) − (5 × age in years) − 161
  
  const base = (10 * weight_kg) + (6.25 * height_cm) - (5 * age)
  
  if (sex === 'male') {
    return Math.round(base + 5)
  } else {
    return Math.round(base - 161)
  }
}

/**
 * Calculate TDEE and recommended daily calories
 */
export function calculateTDEE(input: TDEEInput): TDEEResult {
  const { age, sex, weight_kg, height_cm, activity_level, goal_type, pace = 'moderate' } = input

  // Step 1: Calculate BMR
  const bmr = calculateBMR(weight_kg, height_cm, age, sex)

  // Step 2: Apply activity multiplier to get TDEE
  const activity_multiplier = ACTIVITY_MULTIPLIERS[activity_level]
  const tdee = Math.round(bmr * activity_multiplier)

  // Step 3: Apply goal adjustment
  const goal_adjustment_percent = GOAL_ADJUSTMENTS[goal_type][pace]
  const calorie_adjustment = Math.round(tdee * goal_adjustment_percent)
  const daily_calories = tdee + calorie_adjustment

  // Step 4: Calculate macros (using balanced approach)
  // Protein: 2g per kg body weight (or 30% of calories, whichever is higher)
  // Fat: 25% of calories
  // Carbs: remaining calories
  
  const protein_from_weight = Math.round(weight_kg * 2) // 2g per kg
  const protein_from_percent = Math.round((daily_calories * 0.30) / 4) // 30% of calories, 4 cal/g
  const protein_g = Math.max(protein_from_weight, protein_from_percent)
  
  const fat_g = Math.round((daily_calories * 0.25) / 9) // 25% of calories, 9 cal/g
  
  // Remaining calories go to carbs
  const protein_calories = protein_g * 4
  const fat_calories = fat_g * 9
  const carb_calories = daily_calories - protein_calories - fat_calories
  const carbs_g = Math.round(carb_calories / 4) // 4 cal/g

  return {
    bmr,
    tdee,
    daily_calories,
    calorie_adjustment,
    protein_g,
    carbs_g,
    fat_g,
    activity_multiplier,
    goal_adjustment_percent,
  }
}

/**
 * Calculate meal budgets based on daily calories and meal structure
 */
export function calculateMealBudgets(
  dailyCalories: number,
  mealDistribution: { name: string; percentage: number }[]
): { name: string; percentage: number; calories: number }[] {
  return mealDistribution.map(meal => ({
    ...meal,
    calories: Math.round(dailyCalories * (meal.percentage / 100)),
  }))
}

/**
 * Get calorie range with deviation tolerance
 */
export function getCalorieRange(
  targetCalories: number,
  deviationTolerance: number = 0.25
): { min: number; max: number } {
  return {
    min: Math.round(targetCalories * (1 - deviationTolerance)),
    max: Math.round(targetCalories * (1 + deviationTolerance)),
  }
}
