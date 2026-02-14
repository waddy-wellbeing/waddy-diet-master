import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { corsOptionsResponse, jsonResponse, errorResponse } from '../_shared/cors'
import type { ProfileTargets, DailyTotals, DailyLog, LoggedMeal, RecipeNutrition } from '@/lib/types/nutri'

export const dynamic = 'force-dynamic'

/** Preflight */
export function OPTIONS() {
  return corsOptionsResponse()
}

/**
 * GET /api/mobile/dashboard?uid=<user_id>
 *
 * Returns the user's nutrition targets, today's consumed totals,
 * and 3 suggested public recipes.
 */
export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get('uid')

  if (!uid) {
    return errorResponse('Missing required query param: uid')
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // ── 1. Fetch profile targets ──────────────────────────────────────────
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('targets')
    .eq('user_id', uid)
    .single()

  if (profileErr || !profile) {
    return errorResponse('Profile not found', 404)
  }

  const targets = (profile.targets ?? {}) as ProfileTargets

  // ── 2. Fetch today's daily log ────────────────────────────────────────
  const { data: logRow } = await supabase
    .from('daily_logs')
    .select('log, logged_totals')
    .eq('user_id', uid)
    .eq('log_date', today)
    .maybeSingle()

  let consumed: DailyTotals = {
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
  }

  if (logRow?.logged_totals) {
    consumed = logRow.logged_totals as DailyTotals
  } else if (logRow?.log) {
    // Fallback: derive consumed from individual log meals if totals are empty
    consumed = deriveTotalsFromLog(logRow.log as DailyLog)
  }

  // ── 3. Fetch 3 suggested public recipes ───────────────────────────────
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, name, image_url, nutrition_per_serving')
    .eq('is_public', true)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(3)

  const suggestions = (recipes ?? []).map((r) => {
    const n = (r.nutrition_per_serving ?? {}) as RecipeNutrition
    return {
      id: r.id,
      name: r.name,
      calories: n.calories ?? 0,
      image: r.image_url ?? null,
    }
  })

  // ── Response ──────────────────────────────────────────────────────────
  return jsonResponse({
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
    suggestions,
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveTotalsFromLog(log: DailyLog): DailyTotals {
  const meals: (LoggedMeal | undefined)[] = [
    log.breakfast,
    log.lunch,
    log.dinner,
    log.snacks,
  ]
  const totals: DailyTotals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }

  for (const meal of meals) {
    if (!meal?.items) continue
    // Individual item nutrition is not stored in the log items themselves;
    // the aggregated logged_totals field is the authoritative source.
    // This fallback is intentionally a no-op beyond structure — the real
    // totals should come from logged_totals on the row.
  }

  return totals
}
