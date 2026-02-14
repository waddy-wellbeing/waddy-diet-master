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
 * - Daily meal plan with scaled calories and logged status
 * - Fills empty slots with suggested recipes
 */
export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get('uid')

  if (!uid) {
    return errorResponse('Missing required query param: uid')
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // ── 1. Fetch all data in parallel ─────────────────────────────────────
  const [profileResult, planResult, logResult, streakLogsResult, suggestionsResult] = await Promise.all([
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
      .order('created_at', { ascending: false })
      .limit(20), // Fetch more to have variety for different meal types
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
  const suggestedRecipes = suggestionsResult.data ?? []

  // ── 2. Calculate streak ───────────────────────────────────────────────
  const streak = calculateStreak(streakLogs.map((l) => l.log_date), today)

  // ── 3. Calculate consumed totals ──────────────────────────────────────
  const consumed: DailyTotals = todayLog?.logged_totals
    ? (todayLog.logged_totals as DailyTotals)
    : { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }

  // ── 4. Determine meal slots ───────────────────────────────────────────
  const mealSlots = getMealSlots(isFasting, preferences)
  const dailyCalories = targets.daily_calories ?? 2000

  // ── 5. Get the appropriate plan ───────────────────────────────────────
  const activePlan = isFasting
    ? (todayPlan?.fasting_plan as DailyPlan | undefined)
    : (todayPlan?.plan as DailyPlan | undefined)

  // ── 6. Fetch all recipe IDs from the plan ─────────────────────────────
  const recipeIds = new Set<string>()
  if (activePlan) {
    for (const slot of mealSlots) {
      const slotKey = slot.name as keyof DailyPlan
      const mealSlot = activePlan[slotKey] as PlanMealSlot | undefined
      if (mealSlot?.recipe_id) {
        recipeIds.add(mealSlot.recipe_id)
      }
    }
  }

  // Fetch recipes in one query
  const recipesMap = new Map<string, any>()
  if (recipeIds.size > 0) {
    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, name, image_url, nutrition_per_serving, meal_type')
      .in('id', [...recipeIds])

    for (const recipe of recipes ?? []) {
      recipesMap.set(recipe.id, recipe)
    }
  }

  // ── 7. Build meal objects with scaling ────────────────────────────────
  const todayLogParsed = todayLog?.log ? (todayLog.log as Record<string, any>) : {}
  const dailyPlanResponse: Record<string, any[]> = {}

  // Track used suggestion indices to avoid duplicates
  const usedSuggestions = new Set<string>()

  for (const slot of mealSlots) {
    const slotKey = slot.name
    const targetCalories = dailyCalories * (slot.percentage / 100)

    // Get the meal from the plan (use type assertion for flexible access)
    const mealSlot = activePlan?.[slotKey as keyof typeof activePlan] as PlanMealSlot | undefined
    const recipeId = mealSlot?.recipe_id
    const recipe = recipeId ? recipesMap.get(recipeId) : undefined

    // Check logged status
    const loggedMeal = todayLogParsed[slotKey] as { items?: any[] } | undefined
    const isLogged = (loggedMeal?.items?.length ?? 0) > 0

    if (recipe) {
      // ── Planned recipe exists ──
      const nutrition = (recipe.nutrition_per_serving ?? {}) as RecipeNutrition
      const recipeCalories = nutrition.calories ?? 0

      // Calculate scale factor (match web logic)
      let scaleFactor = recipeCalories > 0 ? targetCalories / recipeCalories : 1
      scaleFactor = Math.max(0.5, Math.min(2.0, scaleFactor)) // Clamp [0.5, 2.0]

      const scaledCalories = Math.round(recipeCalories * scaleFactor)

      dailyPlanResponse[slot.name] = [
        {
          id: recipe.id,
          name: recipe.name,
          calories: scaledCalories,
          image: recipe.image_url ?? null,
          is_logged: isLogged,
          is_suggestion: false,
          scale_factor: Math.round(scaleFactor * 100) / 100, // Round to 2 decimals
          servings: mealSlot?.servings ?? 1,
        },
      ]
    } else {
      // ── No planned recipe: Fill with suggestion ──
      const suggestedRecipe = findBestSuggestion(
        suggestedRecipes,
        slotKey,
        isFasting,
        usedSuggestions
      )

      if (suggestedRecipe) {
        usedSuggestions.add(suggestedRecipe.id)

        const nutrition = (suggestedRecipe.nutrition_per_serving ?? {}) as RecipeNutrition
        const recipeCalories = nutrition.calories ?? 0

        // Calculate scale factor for suggestion
        let scaleFactor = recipeCalories > 0 ? targetCalories / recipeCalories : 1
        scaleFactor = Math.max(0.5, Math.min(2.0, scaleFactor))

        const scaledCalories = Math.round(recipeCalories * scaleFactor)

        dailyPlanResponse[slot.name] = [
          {
            id: suggestedRecipe.id,
            name: suggestedRecipe.name,
            calories: scaledCalories,
            image: suggestedRecipe.image_url ?? null,
            is_logged: isLogged,
            is_suggestion: true, // Flag to indicate this is a suggestion
            scale_factor: Math.round(scaleFactor * 100) / 100,
            servings: 1,
          },
        ]
      } else {
        // No suggestions available
        dailyPlanResponse[slot.name] = []
      }
    }
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
 * Get meal slots based on user mode
 */
function getMealSlots(isFasting: boolean, preferences: ProfilePreferences): MealSlot[] {
  if (isFasting) {
    return [
      { name: 'suhoor', label: 'سحور', percentage: 20 },
      { name: 'pre-iftar', label: 'كسر صيام', percentage: 10 },
      { name: 'iftar', label: 'إفطار', percentage: 40 },
      { name: 'full-meal-taraweeh', label: 'وجبة تراويح', percentage: 15 },
      { name: 'snack-taraweeh', label: 'سناك تراويح', percentage: 15 },
    ]
  }

  // Regular mode: use meal_structure if available, otherwise defaults
  if (preferences.meal_structure && preferences.meal_structure.length > 0) {
    return preferences.meal_structure
  }

  // Default regular slots
  return [
    { name: 'breakfast', label: 'Breakfast', percentage: 25 },
    { name: 'lunch', label: 'Lunch', percentage: 35 },
    { name: 'dinner', label: 'Dinner', percentage: 25 },
    { name: 'snacks', label: 'Snacks', percentage: 15 },
  ]
}

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

/**
 * Find the best suggestion for a meal slot based on meal type matching
 */
function findBestSuggestion(
  suggestions: any[],
  slotName: string,
  isFasting: boolean,
  usedIds: Set<string>
): any | null {
  // Map slot names to preferred recipe meal types
  const slotToMealTypeMap: Record<string, string[]> = {
    // Regular mode
    breakfast: ['breakfast', 'smoothies'],
    lunch: ['lunch', 'one pot', 'dinner'],
    dinner: ['dinner', 'lunch', 'one pot'],
    snacks: ['snacks & sweetes', 'side dishes', 'snack'],

    // Fasting mode
    suhoor: ['breakfast', 'dinner'],
    'pre-iftar': ['snacks & sweetes', 'side dishes'],
    iftar: ['lunch', 'dinner', 'one pot'],
    'full-meal-taraweeh': ['lunch', 'dinner', 'one pot'],
    'snack-taraweeh': ['snacks & sweetes', 'side dishes', 'snack'],
  }

  const preferredTypes = slotToMealTypeMap[slotName] || []

  // First pass: Try to match preferred meal types
  for (const preferredType of preferredTypes) {
    const match = suggestions.find(
      (s) =>
        !usedIds.has(s.id) &&
        Array.isArray(s.meal_type) &&
        s.meal_type.some((t: string) => t.toLowerCase().includes(preferredType.toLowerCase()))
    )
    if (match) return match
  }

  // Second pass: Return any unused suggestion
  const anyMatch = suggestions.find((s) => !usedIds.has(s.id))
  return anyMatch || null
}
