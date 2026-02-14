import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { corsOptionsResponse, jsonResponse, errorResponse } from '../_shared/cors'
import type { RecipeNutrition } from '@/lib/types/nutri'

export const dynamic = 'force-dynamic'

/** Preflight */
export function OPTIONS() {
  return corsOptionsResponse()
}

/**
 * GET /api/mobile/search?q=<query>
 *
 * Search public recipes by name (case-insensitive).
 * Returns up to 20 results.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()

  if (!q) {
    return errorResponse('Missing required query param: q')
  }

  const supabase = createAdminClient()

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, name, image_url, nutrition_per_serving, meal_type, tags')
    .eq('is_public', true)
    .eq('status', 'complete')
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(20)

  if (error) {
    console.error('[mobile/search] Supabase error:', error.message)
    return errorResponse('Search failed', 500)
  }

  const results = (recipes ?? []).map((r) => {
    const n = (r.nutrition_per_serving ?? {}) as RecipeNutrition
    return {
      id: r.id,
      name: r.name,
      image: r.image_url ?? null,
      calories: n.calories ?? 0,
      macros: {
        protein: n.protein_g ?? 0,
        carbs: n.carbs_g ?? 0,
        fat: n.fat_g ?? 0,
      },
      meal_type: r.meal_type ?? [],
      tags: r.tags ?? [],
    }
  })

  return jsonResponse(results)
}
