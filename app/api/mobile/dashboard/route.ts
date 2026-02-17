import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { corsOptionsResponse, jsonResponse, errorResponse } from '../_shared/cors'
import type {
  ProfileTargets,
  ProfilePreferences,
  DailyTotals,
  DailyPlan,
  PlanMealSlot,
  RecipeNutrition,
  MealSlot,
} from '@/lib/types/nutri'

export const dynamic = 'force-dynamic'

// ─── Meal Slot Configurations ──────────────────────────────────────────────

interface MealRatioConfig {
  name: string
  percentage: number
  acceptedMealTypes: string[] // For filtering recipes
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

/** Preflight */
export function OPTIONS() {
  return corsOptionsResponse()
}

/**
 * GET /api/mobile/dashboard?uid=<user_id>
 *
 * Returns the user's dashboard data with:
 * - User mode (fasting or regular)
 * - Streak count
 * - Targets and consumed totals
 * - Daily meal plan with exact scaling and macro similarity scoring
 * - Top 3 recipe alternatives per slot for swapping
 */
export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get('uid')

  if (!uid) {
    return errorResponse('Missing required query param: uid')
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // ── 1. Fetch all data in parallel ─────────────────────────────────────
  const [profileResult, planResult, logResult, streakLogsResult, allRecipesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('targets, preferences')
      .eq('user_id', uid)
      .single(),
    supabase
      .from('daily_plans')
      .select('plan, fasting_plan')
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
      .eq('status', 'complete')
      .limit(100), // Fetch more for better alternatives
  ])

  if (profileResult.error || !profileResult.data) {
    return errorResponse('Profile not found', 404)
  }

  const profile = profileResult.data
  const targets = (profile.targets ?? {}) as ProfileTargets
  const preferences = (profile.preferences ?? {}) as ProfilePreferences
  const isFasting = preferences.is_fasting || false

  const todayPlan = planResult.data
  const todayLog = logResult.data
  const streakLogs = streakLogsResult.data ?? []
  const allRecipes = allRecipesResult.data ?? []

  // ── 2. Calculate streak ───────────────────────────────────────────────
  const streak = calculateStreak(streakLogs.map((l) => l.log_date), today)

  // ── 3. Calculate consumed totals ──────────────────────────────────────
  const consumed: DailyTotals = todayLog?.logged_totals
    ? (todayLog.logged_totals as DailyTotals)
    : { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }

  // ── 4. Determine meal configuration ───────────────────────────────────
  const mealConfig = isFasting ? FASTING_MEAL_CONFIG : REGULAR_MEAL_CONFIG
  const dailyCalories = targets.daily_calories ?? 2000
  const dailyProtein = targets.protein_g ?? 150
  const dailyCarbs = targets.carbs_g ?? 200
  const dailyFat = targets.fat_g ?? 67

  // Target macro percentages (for similarity scoring)
  const targetProteinPct = (dailyProtein * 4) / dailyCalories // 4 cal/g
  const targetCarbsPct = (dailyCarbs * 4) / dailyCalories
  const targetFatPct = (dailyFat * 9) / dailyCalories // 9 cal/g

  // ── 5. Get the appropriate plan ───────────────────────────────────────
  const activePlan = isFasting
    ? (todayPlan?.fasting_plan as DailyPlan | undefined)
    : (todayPlan?.plan as DailyPlan | undefined)

  // ── 6. Get logged status per slot ─────────────────────────────────────
  const todayLogParsed = todayLog?.log ? (todayLog.log as Record<string, any>) : {}

  // ── 7. Build response per slot ────────────────────────────────────────
  const dailyPlanResponse: Record<string, any[]> = {}

  for (const slotConfig of mealConfig) {
    const slotName = slotConfig.name
    const targetCalories = dailyCalories * (slotConfig.percentage / 100)

    // Check if slot has logged items
    const loggedMeal = todayLogParsed[slotName] as { items?: any[] } | undefined
    const loggedRecipeIds = new Set(
      (loggedMeal?.items || [])
        .filter((item: any) => item.type === 'recipe')
        .map((item: any) => item.recipe_id)
    )

    // Get planned recipe (if exists)
    const plannedSlot = activePlan?.[slotName as keyof typeof activePlan] as PlanMealSlot | undefined
    const plannedRecipeId = plannedSlot?.recipe_id

    // Filter recipes by meal type
    let suitableRecipes = allRecipes.filter((recipe) => {
      const recipeMealTypes = recipe.meal_type || []
      return slotConfig.acceptedMealTypes.some((acceptedType) =>
        recipeMealTypes.some((recipeType: string) =>
          recipeType.toLowerCase().includes(acceptedType.toLowerCase())
        )
      )
    })

    // If planned recipe exists and not in suitable list, add it
    if (plannedRecipeId) {
      const plannedRecipe = allRecipes.find((r) => r.id === plannedRecipeId)
      if (plannedRecipe && !suitableRecipes.find((r) => r.id === plannedRecipeId)) {
        suitableRecipes.unshift(plannedRecipe)
      }
    }

    // ── 7.1 Scale and score each recipe ────────────────────────────────
    const scoredRecipes = suitableRecipes
      .map((recipe) => {
        const nutrition = (recipe.nutrition_per_serving ?? {}) as RecipeNutrition
        const baseCalories = nutrition.calories ?? 0
        const baseProtein = nutrition.protein_g ?? 0
        const baseCarbs = nutrition.carbs_g ?? 0
        const baseFat = nutrition.fat_g ?? 0

        if (baseCalories <= 0) return null

        // Calculate scale factor to hit target calories
        const scaleFactor = targetCalories / baseCalories
        const clampedScale = Math.max(0.5, Math.min(scaleFactor, 2.0))

        // Scaled macros
        const scaledProtein = baseProtein * clampedScale
        const scaledCarbs = baseCarbs * clampedScale
        const scaledFat = baseFat * clampedScale
        const scaledCalories = baseCalories * clampedScale

        // Calculate macro percentages of scaled recipe
        const scaledProteinPct = (scaledProtein * 4) / scaledCalories
        const scaledCarbsPct = (scaledCarbs * 4) / scaledCalories
        const scaledFatPct = (scaledFat * 9) / scaledCalories

        // Macro similarity score (lower difference = higher score)
        const proteinDiff = Math.abs(scaledProteinPct - targetProteinPct)
        const carbsDiff = Math.abs(scaledCarbsPct - targetCarbsPct)
        const fatDiff = Math.abs(scaledFatPct - targetFatPct)

        // Weighted similarity (protein most important)
        const macroSimilarityScore = 1 - (proteinDiff * 0.4 + carbsDiff * 0.3 + fatDiff * 0.3)

        // Penalize if scale factor is out of acceptable range
        const isInRange = scaleFactor >= 0.5 && scaleFactor <= 2.0
        const finalScore = isInRange ? macroSimilarityScore : macroSimilarityScore - 1.0

        return {
          id: recipe.id,
          name: recipe.name,
          image: recipe.image_url ?? null,
          calories: Math.round(scaledCalories),
          scale_factor: Math.round(clampedScale * 100) / 100,
          servings: Math.round(clampedScale * 100) / 100, // Web uses scale_factor as servings
          is_logged: loggedRecipeIds.has(recipe.id),
          is_suggestion: plannedRecipeId !== recipe.id,
          macro_similarity_score: Math.round(finalScore * 100) / 100,
          macros: {
            protein: Math.round(scaledProtein),
            carbs: Math.round(scaledCarbs),
            fat: Math.round(scaledFat),
          },
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    // ── 7.2 Sort by macro similarity (best first) ──────────────────────
    scoredRecipes.sort((a, b) => {
      // Primary sort: Macro similarity score (higher is better)
      const scoreDiff = b.macro_similarity_score - a.macro_similarity_score
      if (scoreDiff !== 0) return scoreDiff

      // Secondary sort: Scale factor closest to 1.0
      const aScaleDiff = Math.abs(a.scale_factor - 1.0)
      const bScaleDiff = Math.abs(b.scale_factor - 1.0)
      return aScaleDiff - bScaleDiff
    })

    // ── 7.3 Return top 3 alternatives (or fewer if not available) ──────
    // If planned recipe exists, ensure it's first
    if (plannedRecipeId) {
      const plannedIndex = scoredRecipes.findIndex((r) => r.id === plannedRecipeId)
      if (plannedIndex > 0) {
        const [plannedRecipe] = scoredRecipes.splice(plannedIndex, 1)
        scoredRecipes.unshift(plannedRecipe)
      }
    }

    dailyPlanResponse[slotName] = scoredRecipes.slice(0, 3)
  }

  // ── Response ──────────────────────────────────────────────────────────
  return jsonResponse({
    user_mode: isFasting ? 'fasting' : 'regular',
    streak,
    targets: {
      calories: targets.daily_calories ?? 0,
      protein: targets.protein_g ?? 0,
      carbs: targets.carbs_g ?? 0,
      fat: targets.fat_g ?? 0,
      fiber: targets.fiber_g ?? 0,
    },
    consumed: {
      calories: consumed.calories ?? 0,
      protein: consumed.protein_g ?? 0,
      carbs: consumed.carbs_g ?? 0,
      fat: consumed.fat_g ?? 0,
    },
    daily_plan: dailyPlanResponse,
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculate streak: count consecutive days from today backwards
 */
function calculateStreak(logDates: string[], today: string): number {
  const dateSet = new Set(logDates)
  let streak = 0
  let checkDate = new Date(today)

  for (let i = 0; i < 30; i++) {
    const dateStr = checkDate.toISOString().slice(0, 10)
    if (dateSet.has(dateStr)) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}

/**
 * Get date N days ago in YYYY-MM-DD format
 */
function getDateDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}
