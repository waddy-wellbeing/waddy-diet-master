import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { corsOptionsResponse, jsonResponse, errorResponse } from '../../_shared/cors'
import type {
  ProfileTargets,
  ProfilePreferences,
  DailyTotals,
  DailyPlan,
  RecipeNutrition,
  DailyLog,
} from '@/lib/types/nutri'

export const dynamic = 'force-dynamic'

/** Preflight */
export function OPTIONS() {
  return corsOptionsResponse()
}

// ─── Meal Slot Configurations ──────────────────────────────────────────────

interface MealRatioConfig {
  name: string
  percentage: number
  acceptedMealTypes: string[]
}

const REGULAR_MEAL_CONFIG: MealRatioConfig[] = [
  { name: 'breakfast', percentage: 25, acceptedMealTypes: ['breakfast', 'smoothies'] },
  { name: 'lunch', percentage: 35, acceptedMealTypes: ['lunch', 'one pot', 'dinner'] },
  { name: 'dinner', percentage: 25, acceptedMealTypes: ['dinner', 'lunch', 'one pot'] },
  { name: 'snacks', percentage: 15, acceptedMealTypes: ['snacks & sweetes', 'side dishes', 'snack'] },
]

const FASTING_MEAL_CONFIG: MealRatioConfig[] = [
  { name: 'suhoor', percentage: 20, acceptedMealTypes: ['breakfast', 'dinner'] },
  { name: 'pre-iftar', percentage: 10, acceptedMealTypes: ['snacks & sweetes', 'side dishes'] },
  { name: 'iftar', percentage: 40, acceptedMealTypes: ['lunch', 'dinner', 'one pot'] },
  { name: 'full-meal-taraweeh', percentage: 15, acceptedMealTypes: ['lunch', 'dinner', 'one pot'] },
  { name: 'snack-taraweeh', percentage: 15, acceptedMealTypes: ['snacks & sweetes', 'side dishes', 'snack'] },
]

interface ScaledRecipe {
  id: string
  name: string
  image_url?: string
  meal_type?: string[]
  nutrition_per_serving?: RecipeNutrition
  scale_factor: number
  scaled_calories: number
  original_calories: number
  macro_similarity_score: number
}

interface CandidateRecipe {
  id: string
  name: string
  image_url?: string
  scaled_calories: number
  scale_factor: number
  macro_similarity_score: number
  nutrition_per_serving?: RecipeNutrition
}

/**
 * GET /api/mobile/dashboard/full?uid=<user_id>
 *
 * Comprehensive dashboard endpoint with:
 * - User profile and targets
 * - Today's log and plan (with auto-generation if missing)
 * - Candidate recipes for each meal type (for swapping)
 * - Streak and week data
 */
export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get('uid')

  if (!uid) {
    return errorResponse('Missing required query param: uid')
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // ── 1. Fetch core data in parallel ─────────────────────────────────────
  const [profileResult, planResult, logResult, streakLogsResult, allRecipesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('targets, preferences, role')
      .eq('user_id', uid)
      .single(),
    supabase
      .from('daily_plans')
      .select('plan, fasting_plan, mode')
      .eq('user_id', uid)
      .eq('plan_date', today)
      .maybeSingle(),
    supabase
      .from('daily_logs')
      .select('log, logged_totals')
      .eq('user_id', uid)
      .eq('log_date', today)
      .maybeSingle(),
    supabase
      .from('daily_logs')
      .select('log_date')
      .eq('user_id', uid)
      .gte('log_date', getDateDaysAgo(30))
      .order('log_date', { ascending: false }),
    supabase
      .from('recipes')
      .select('id, name, image_url, nutrition_per_serving, meal_type')
      .eq('is_public', true)
      .eq('status', 'complete'),
  ])

  if (profileResult.error || !profileResult.data) {
    return errorResponse('Profile not found', 404)
  }

  const profile = profileResult.data
  const targets = (profile.targets ?? {}) as ProfileTargets
  const preferences = (profile.preferences ?? {}) as ProfilePreferences
  const isFasting = preferences.is_fasting || false

  let todayPlan = planResult.data
  const todayLog = logResult.data
  const streakLogs = streakLogsResult.data ?? []
  const allRecipes = allRecipesResult.data ?? []

  // ── 2. Calculate streak ───────────────────────────────────────────────
  const streak = calculateStreak(
    streakLogs.map((l) => l.log_date),
    today,
  )

  // ── 3. Get meal configuration ──────────────────────────────────────────
  const mealConfig = isFasting ? FASTING_MEAL_CONFIG : REGULAR_MEAL_CONFIG

  // ── 4. Calculate meal targets ──────────────────────────────────────────
  const dailyCalories = targets.daily_calories || 2000
  const dailyProtein = targets.protein_g || 150
  const dailyCarbs = targets.carbs_g || 250
  const dailyFat = targets.fat_g || 65

  const mealTargets: Record<string, number> = {}
  for (const slot of mealConfig) {
    mealTargets[slot.name] = Math.round(dailyCalories * (slot.percentage / 100))
  }

  // ── 5. Build candidate recipes for each meal type ───────────────────────
  const candidates = buildCandidates(
    allRecipes,
    mealConfig,
    mealTargets,
    dailyProtein,
    dailyCarbs,
    dailyFat,
    dailyCalories,
  )

  // ── 6. Auto-generate plan if missing for today ──────────────────────────
  if (!todayPlan) {
    todayPlan = await generateAndSavePlan(
      supabase,
      uid,
      today,
      candidates,
      mealConfig,
      isFasting,
    )
  }

  // ── 7. Build active plan from candidates ────────────────────────────────
  const activePlan = buildActivePlan(
    todayPlan,
    candidates,
    mealConfig,
    isFasting,
    todayLog,
  )

  // ── 8. Calculate consumed totals ────────────────────────────────────────
  const consumed: DailyTotals = todayLog?.logged_totals
    ? (todayLog.logged_totals as DailyTotals)
    : { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }

  // ── 9. Transform candidates to response format ──────────────────────────
  const candidatesResponse: Record<string, CandidateRecipe[]> = {}
  for (const [mealType, recipes] of Object.entries(candidates)) {
    candidatesResponse[mealType] = recipes.map((r) => ({
      id: r.id,
      name: r.name,
      image_url: r.image_url,
      scaled_calories: r.scaled_calories,
      scale_factor: r.scale_factor,
      macro_similarity_score: r.macro_similarity_score,
      nutrition_per_serving: r.nutrition_per_serving,
    }))
  }

  return jsonResponse({
    success: true,
    user_mode: isFasting ? 'fasting' : 'regular',
    targets: {
      daily_calories: dailyCalories,
      protein_g: dailyProtein,
      carbs_g: dailyCarbs,
      fat_g: dailyFat,
    },
    meal_targets: mealTargets,
    streak,
    today_log: todayLog,
    today_date: today,
    active_plan: activePlan,
    candidates: candidatesResponse,
    consumed,
  })
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getDateDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

function calculateStreak(logDates: string[], today: string): number {
  const logSet = new Set(logDates)
  let streak = 0
  const current = new Date(today)

  for (let i = 0; i < 30; i++) {
    const dateStr = current.toISOString().slice(0, 10)
    if (logSet.has(dateStr)) {
      streak++
      current.setDate(current.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}

function buildCandidates(
  allRecipes: any[],
  mealConfig: MealRatioConfig[],
  mealTargets: Record<string, number>,
  dailyProtein: number,
  dailyCarbs: number,
  dailyFat: number,
  dailyCalories: number,
): Record<string, ScaledRecipe[]> {
  const candidates: Record<string, ScaledRecipe[]> = {}

  // Calculate target macros as percentages
  const targetMacros = {
    protein_pct: Math.round(((dailyProtein * 4) / dailyCalories) * 100),
    carbs_pct: Math.round(((dailyCarbs * 4) / dailyCalories) * 100),
    fat_pct: Math.round(((dailyFat * 9) / dailyCalories) * 100),
  }

  // Process each meal slot
  for (const slot of mealConfig) {
    const mealType = slot.name
    const targetCalories = mealTargets[mealType]
    const acceptedMealTypes = slot.acceptedMealTypes

    const suitable: ScaledRecipe[] = []

    for (const recipe of allRecipes) {
      // Parse nutrition
      const nutritionData = typeof recipe.nutrition_per_serving === 'string'
        ? JSON.parse(recipe.nutrition_per_serving)
        : recipe.nutrition_per_serving

      const baseCalories = nutritionData?.calories
      if (!baseCalories || baseCalories <= 0) continue

      // Check meal type filter
      const recipeMealTypes = recipe.meal_type || []
      const matchesMealType = acceptedMealTypes.some((t) =>
        recipeMealTypes.some((rmt: string) => rmt.toLowerCase() === t.toLowerCase()),
      )
      if (!matchesMealType) continue

      // Calculate scale factor
      const scaleFactor = targetCalories / baseCalories
      const clampedScaleFactor = Math.max(0.5, Math.min(scaleFactor, 2.0))

      // Calculate macro similarity score
      const recipeProtein = nutritionData?.protein_g || 0
      const recipeCarbs = nutritionData?.carbs_g || 0
      const recipeFat = nutritionData?.fat_g || 0

      // Apply scale factor to recipe macros
      const scaledProtein = recipeProtein * clampedScaleFactor
      const scaledCarbs = recipeCarbs * clampedScaleFactor
      const scaledFat = recipeFat * clampedScaleFactor
      const scaledTotalCals = targetCalories

      // Calculate macro percentages after scaling
      const recipeMacros = {
        protein_pct: Math.round(((scaledProtein * 4) / scaledTotalCals) * 100),
        carbs_pct: Math.round(((scaledCarbs * 4) / scaledTotalCals) * 100),
        fat_pct: Math.round(((scaledFat * 9) / scaledTotalCals) * 100),
      }

      // Calculate similarity (weighted: protein 40%, carbs 30%, fat 30%)
      const proteinDiff = Math.abs(recipeMacros.protein_pct - targetMacros.protein_pct)
      const carbsDiff = Math.abs(recipeMacros.carbs_pct - targetMacros.carbs_pct)
      const fatDiff = Math.abs(recipeMacros.fat_pct - targetMacros.fat_pct)

      const macroSimilarityScore = Math.round(
        100 - (proteinDiff * 0.4 + carbsDiff * 0.3 + fatDiff * 0.3),
      )

      suitable.push({
        id: recipe.id,
        name: recipe.name,
        image_url: recipe.image_url,
        meal_type: recipe.meal_type,
        nutrition_per_serving: nutritionData,
        scale_factor: Math.round(clampedScaleFactor * 100) / 100,
        scaled_calories: targetCalories,
        original_calories: baseCalories,
        macro_similarity_score: macroSimilarityScore,
      })
    }

    // Sort by macro similarity (descending), then scale factor closest to 1.0
    suitable.sort((a, b) => {
      // Primary: macro similarity
      const simDiff = (b.macro_similarity_score || 0) - (a.macro_similarity_score || 0)
      if (Math.abs(simDiff) > 5) return simDiff

      // Secondary: scale factor closest to 1.0
      const aDistFromOne = Math.abs(a.scale_factor - 1.0)
      const bDistFromOne = Math.abs(b.scale_factor - 1.0)
      return aDistFromOne - bDistFromOne
    })

    candidates[mealType] = suitable
  }

  return candidates
}

async function generateAndSavePlan(
  supabase: ReturnType<typeof createAdminClient>,
  uid: string,
  date: string,
  candidates: Record<string, ScaledRecipe[]>,
  mealConfig: MealRatioConfig[],
  isFasting: boolean,
): Promise<any> {
  // Build plan from first candidate for each meal
  const plan: Record<string, any> = {}

  for (const slot of mealConfig) {
    const mealType = slot.name
    const topRecipe = candidates[mealType]?.[0]

    if (topRecipe) {
      plan[mealType] = {
        recipe_id: topRecipe.id,
        servings: topRecipe.scale_factor,
        swapped: false,
      }
    }
  }

  // Upsert to database
  const { data: existing } = await supabase
    .from('daily_plans')
    .select('id')
    .eq('user_id', uid)
    .eq('plan_date', date)
    .maybeSingle()

  if (existing) {
    // Update
    await supabase
      .from('daily_plans')
      .update({
        [isFasting ? 'fasting_plan' : 'plan']: plan,
        mode: isFasting ? 'fasting' : 'regular',
      })
      .eq('id', existing.id)
  } else {
    // Insert
    await supabase.from('daily_plans').insert({
      user_id: uid,
      plan_date: date,
      [isFasting ? 'fasting_plan' : 'plan']: plan,
      mode: isFasting ? 'fasting' : 'regular',
    })
  }

  // Return the generated plan
  return {
    plan: isFasting ? undefined : plan,
    fasting_plan: isFasting ? plan : undefined,
    mode: isFasting ? 'fasting' : 'regular',
  }
}

interface ActivePlanMeal {
  recipe_id: string
  recipe_name: string
  scaled_calories: number
  scale_factor: number
  is_logged: boolean
  macro_similarity_score: number
  nutrition_per_serving?: RecipeNutrition
}

function buildActivePlan(
  todayPlan: any,
  candidates: Record<string, ScaledRecipe[]>,
  mealConfig: MealRatioConfig[],
  isFasting: boolean,
  todayLog?: any,
): Record<string, ActivePlanMeal | null> {
  const activePlan: Record<string, ActivePlanMeal | null> = {}
  const planData = isFasting ? todayPlan?.fasting_plan : todayPlan?.plan
  const logData = (todayLog?.log ?? {}) as DailyLog

  for (const slot of mealConfig) {
    const mealType = slot.name
    const planSlot = planData?.[mealType]

    if (!planSlot || !planSlot.recipe_id) {
      activePlan[mealType] = null
      continue
    }

    // Find the recipe in candidates to get its details
    const recipe = candidates[mealType]?.find((r) => r.id === planSlot.recipe_id)

    if (recipe) {
      // Check if logged
      const mealLog = logData[mealType as keyof DailyLog]
      const isLogged = !!mealLog?.items?.some((item: any) => item.recipe_id === planSlot.recipe_id)

      activePlan[mealType] = {
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        scaled_calories: recipe.scaled_calories,
        scale_factor: recipe.scale_factor,
        is_logged: isLogged,
        macro_similarity_score: recipe.macro_similarity_score,
        nutrition_per_serving: recipe.nutrition_per_serving,
      }
    } else {
      activePlan[mealType] = null
    }
  }

  return activePlan
}
