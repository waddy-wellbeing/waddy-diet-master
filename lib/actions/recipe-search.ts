'use server'

import { createClient } from '@/lib/supabase/server'

export async function searchRecipes({
  query,
  mealType,
  limit = 100,
}: {
  query: string
  mealType: string
  limit?: number
}): Promise<any[]> {
  try {
    const supabase = await createClient()
    
    // Meal type mapping for proper recipe filtering
    const mealTypeMapping: Record<string, string[]> = {
      breakfast: ["breakfast", "smoothies"],
      lunch: ["lunch", "one pot", "side dishes"],
      dinner: ["dinner", "one pot", "side dishes"],
      snacks: ["snack", "snacks & sweets", "smoothies"],
      mid_morning: ["snack", "snacks & sweets", "smoothies"],
      afternoon: ["snack", "snacks & sweets", "smoothies"],
      evening: ["snack", "snacks & sweets", "smoothies"],
      // Fasting meal mappings
      "pre-iftar": ["pre-iftar", "smoothies"],
      "iftar": ["lunch", "one pot"],
      "full-meal-taraweeh": ["lunch", "dinner", "one pot"],
      "snack-taraweeh": ["snack", "snacks & sweets"],
      "suhoor": ["breakfast", "dinner"],
    }
    
    const acceptedTypes = mealTypeMapping[mealType] || []
    
    // Build database query
    let dbQuery = supabase
      .from('recipes')
      .select('id, name, description, image_url, meal_type, recommendation_group, nutrition_per_serving, prep_time_minutes, cook_time_minutes')
      .eq('is_public', true)
      .not('nutrition_per_serving', 'is', null)
    
    // Apply search filter if query provided
    const isSearching = query.trim().length > 0
    if (isSearching) {
      const searchTerm = `%${query.trim()}%`
      dbQuery = dbQuery.or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
      // When searching: NO meal_type filter (return all matching recipes)
    } else if (acceptedTypes.length > 0) {
      // When NOT searching: Filter by meal_type at DATABASE level (avoid fetching 500 rows)
      // Use PostgreSQL array overlap operator to check if meal_type && acceptedTypes
      dbQuery = dbQuery.overlaps('meal_type', acceptedTypes)
    }
    
    // Fetch recipes - limit based on use case
    const fetchLimit = isSearching ? 500 : 100
    const { data: recipes, error } = await dbQuery.limit(fetchLimit)
    
    if (error) {
      console.error('Error searching recipes:', error)
      return []
    }
    
    if (!recipes || recipes.length === 0) {
      return []
    }
    
    // Tag each recipe with whether it matches the target meal type
    const isFastingMeal = ['pre-iftar', 'iftar', 'full-meal-taraweeh', 'snack-taraweeh', 'suhoor'].includes(mealType)
    const tagged = recipes.map((r) => ({
      ...r,
      is_suitable: acceptedTypes.length === 0
        ? true
        : (r.meal_type as string[] | null)?.some((t) =>
            acceptedTypes.some((a) => t.toLowerCase() === a.toLowerCase())
          ) ?? false,
    }))

    // Sort: suitable first, then by Ramadan tag, then alphabetically
    tagged.sort((a, b) => {
      // 1. Suitable for this meal type first
      if (a.is_suitable !== b.is_suitable) return a.is_suitable ? -1 : 1

      // 2. Ramadan recommendations for fasting meals
      if (isFastingMeal) {
        const aRamadan = (a.recommendation_group as string[] | null)?.includes('ramadan') ? 1 : 0
        const bRamadan = (b.recommendation_group as string[] | null)?.includes('ramadan') ? 1 : 0
        if (aRamadan !== bRamadan) return bRamadan - aRamadan

        if (mealType === 'pre-iftar') {
          const aHas = (a.meal_type || []).some((t: string) => t.toLowerCase() === 'pre-iftar')
          const bHas = (b.meal_type || []).some((t: string) => t.toLowerCase() === 'pre-iftar')
          if (aHas !== bHas) return aHas ? -1 : 1
        }
      }

      return 0
    })

    return tagged.slice(0, limit)
  } catch (error) {
    console.error('Unexpected error in searchRecipes:', error)
    return []
  }
}
