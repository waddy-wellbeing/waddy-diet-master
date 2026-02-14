import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { corsOptionsResponse, jsonResponse, errorResponse } from '../_shared/cors'
import type { DailyLog, LoggedMeal, LoggedItem, DailyTotals, MealType, MEAL_TYPES } from '@/lib/types/nutri'

export const dynamic = 'force-dynamic'

/** Preflight */
export function OPTIONS() {
  return corsOptionsResponse()
}

// Accepted meal types
const VALID_MEAL_TYPES: readonly string[] = ['breakfast', 'lunch', 'dinner', 'snacks']

/**
 * POST /api/mobile/log
 *
 * Body: {
 *   uid:      string        — User ID
 *   date:     string        — YYYY-MM-DD
 *   mealType: MealType      — breakfast | lunch | dinner | snacks
 *   items:    LoggedItem[]   — Array of recipe/ingredient entries
 * }
 *
 * Upserts the meal into the user's daily_logs row for the given date.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>

  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body')
  }

  const { uid, date, mealType, items } = body as {
    uid?: string
    date?: string
    mealType?: string
    items?: LoggedItem[]
  }

  // ── Validation ──────────────────────────────────────────────────────────
  if (!uid || typeof uid !== 'string') {
    return errorResponse('Missing or invalid field: uid')
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return errorResponse('Missing or invalid field: date (expected YYYY-MM-DD)')
  }
  if (!mealType || !VALID_MEAL_TYPES.includes(mealType)) {
    return errorResponse(`Invalid mealType. Expected one of: ${VALID_MEAL_TYPES.join(', ')}`)
  }
  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse('items must be a non-empty array')
  }

  const supabase = createAdminClient()
  const meal = mealType as MealType

  // ── Fetch existing log for this date ────────────────────────────────────
  const { data: existing } = await supabase
    .from('daily_logs')
    .select('id, log, logged_totals, meals_logged')
    .eq('user_id', uid)
    .eq('log_date', date)
    .maybeSingle()

  const loggedMeal: LoggedMeal = {
    logged_at: new Date().toISOString(),
    items,
  }

  let updatedLog: DailyLog
  let mealsLogged: number

  if (existing) {
    // Merge new meal into existing log
    const log = (existing.log ?? {}) as DailyLog
    log[meal] = loggedMeal
    updatedLog = log
    mealsLogged = countMeals(updatedLog)
  } else {
    updatedLog = { [meal]: loggedMeal } as unknown as DailyLog
    mealsLogged = 1
  }

  // ── Calculate totals from logged items (best-effort) ────────────────────
  // The frontend / coach may recalculate & patch accurate totals later.
  const totals = await computeLoggedTotals(supabase, updatedLog)

  // ── Upsert ──────────────────────────────────────────────────────────────
  if (existing) {
    const { error } = await supabase
      .from('daily_logs')
      .update({
        log: updatedLog,
        logged_totals: totals,
        meals_logged: mealsLogged,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) {
      console.error('[mobile/log] Update error:', error.message)
      return errorResponse('Failed to update log', 500)
    }
  } else {
    const { error } = await supabase
      .from('daily_logs')
      .insert({
        user_id: uid,
        log_date: date,
        log: updatedLog,
        logged_totals: totals,
        meals_logged: mealsLogged,
      })

    if (error) {
      console.error('[mobile/log] Insert error:', error.message)
      return errorResponse('Failed to create log', 500)
    }
  }

  return jsonResponse({ success: true, logged_totals: totals, meals_logged: mealsLogged }, 201)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Count how many meal slots have entries */
function countMeals(log: DailyLog): number {
  let count = 0
  if (log.breakfast?.items?.length) count++
  if (log.lunch?.items?.length) count++
  if (log.dinner?.items?.length) count++
  if (log.snacks?.items?.length) count++
  return count
}

/**
 * Best-effort nutrition totals based on logged recipe/ingredient IDs.
 * Looks up recipes & ingredients from the DB and sums calories/macros.
 */
async function computeLoggedTotals(
  supabase: ReturnType<typeof createAdminClient>,
  log: DailyLog
): Promise<DailyTotals> {
  const totals: DailyTotals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }

  // Collect all unique recipe IDs and ingredient IDs from every meal
  const recipeIds = new Set<string>()
  const ingredientIds = new Set<string>()

  const meals: (LoggedMeal | undefined)[] = [log.breakfast, log.lunch, log.dinner, log.snacks]

  for (const meal of meals) {
    if (!meal?.items) continue
    for (const item of meal.items) {
      if (item.type === 'recipe' && item.recipe_id) recipeIds.add(item.recipe_id)
      if (item.type === 'ingredient' && item.ingredient_id) ingredientIds.add(item.ingredient_id)
    }
  }

  // Batch-fetch recipes
  const recipeNutritionMap = new Map<string, { calories: number; protein_g: number; carbs_g: number; fat_g: number }>()

  if (recipeIds.size > 0) {
    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, nutrition_per_serving')
      .in('id', [...recipeIds])

    for (const r of recipes ?? []) {
      const n = (r.nutrition_per_serving ?? {}) as Record<string, number>
      recipeNutritionMap.set(r.id, {
        calories: n.calories ?? 0,
        protein_g: n.protein_g ?? 0,
        carbs_g: n.carbs_g ?? 0,
        fat_g: n.fat_g ?? 0,
      })
    }
  }

  // Batch-fetch ingredients
  const ingredientNutritionMap = new Map<string, { calories: number; protein_g: number; carbs_g: number; fat_g: number }>()

  if (ingredientIds.size > 0) {
    const { data: ingredients } = await supabase
      .from('ingredients')
      .select('id, macros')
      .in('id', [...ingredientIds])

    for (const ing of ingredients ?? []) {
      const m = (ing.macros ?? {}) as Record<string, number>
      ingredientNutritionMap.set(ing.id, {
        calories: m.calories ?? 0,
        protein_g: m.protein_g ?? 0,
        carbs_g: m.carbs_g ?? 0,
        fat_g: m.fat_g ?? 0,
      })
    }
  }

  // Sum totals across all meals
  for (const meal of meals) {
    if (!meal?.items) continue
    for (const item of meal.items) {
      const servings = item.servings ?? 1

      if (item.type === 'recipe' && item.recipe_id) {
        const n = recipeNutritionMap.get(item.recipe_id)
        if (n) {
          totals.calories! += n.calories * servings
          totals.protein_g! += n.protein_g * servings
          totals.carbs_g! += n.carbs_g * servings
          totals.fat_g! += n.fat_g * servings
        }
      }

      if (item.type === 'ingredient' && item.ingredient_id) {
        const n = ingredientNutritionMap.get(item.ingredient_id)
        if (n) {
          const amount = item.amount ?? 1
          totals.calories! += n.calories * amount
          totals.protein_g! += n.protein_g * amount
          totals.carbs_g! += n.carbs_g * amount
          totals.fat_g! += n.fat_g * amount
        }
      }
    }
  }

  // Round to integers
  totals.calories = Math.round(totals.calories!)
  totals.protein_g = Math.round(totals.protein_g!)
  totals.carbs_g = Math.round(totals.carbs_g!)
  totals.fat_g = Math.round(totals.fat_g!)

  return totals
}
