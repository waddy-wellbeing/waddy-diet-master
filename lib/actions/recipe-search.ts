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
      snacks: ["snack", "snacks & sweetes", "smoothies"],
      // Fasting meal mappings
      "pre-iftar": ["pre-iftar", "smoothies"],
      "iftar": ["lunch"],
      "full-meal-taraweeh": ["lunch", "dinner"],
      "snack-taraweeh": ["snack"],
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
    }
    
    // Fetch recipes
    const { data: recipes, error } = await dbQuery.limit(500)
    
    if (error) {
      console.error('Error searching recipes:', error)
      return []
    }
    
    if (!recipes || recipes.length === 0) {
      return []
    }
    
    // MEAL TYPE FILTERING LOGIC:
    // - If NOT searching (empty query): FILTER by meal_type (show only appropriate recipes)
    // - If searching (has query): NO FILTERING (show all matching recipes)
    let filtered = recipes
    
    if (!isSearching && acceptedTypes.length > 0) {
      // Initial display - filter by meal_type mapping
      filtered = recipes.filter((recipe) => {
        const recipeMealTypes = recipe.meal_type || []
        return acceptedTypes.some((t) =>
          recipeMealTypes.some((rmt: string) => rmt.toLowerCase() === t.toLowerCase())
        )
      })
    }
    // else: searching mode - return all recipes matching query
    
    // Sort recipes: Ramadan recommendations first for fasting meals
    const isFastingMeal = ['pre-iftar', 'iftar', 'full-meal-taraweeh', 'snack-taraweeh', 'suhoor'].includes(mealType)
    
    if (isFastingMeal) {
      filtered.sort((a, b) => {
        const aRamadan = (a.recommendation_group as string[] | null)?.includes('ramadan') ? 1 : 0
        const bRamadan = (b.recommendation_group as string[] | null)?.includes('ramadan') ? 1 : 0
        
        // Ramadan tag takes priority
        if (aRamadan !== bRamadan) return bRamadan - aRamadan
        
        // For pre-iftar: prioritize "pre-iftar" type over "smoothies"
        if (mealType === 'pre-iftar') {
          const aHasPreIftar = (a.meal_type || []).some((t: string) => 
            t.toLowerCase() === 'pre-iftar'
          )
          const bHasPreIftar = (b.meal_type || []).some((t: string) => 
            t.toLowerCase() === 'pre-iftar'
          )
          
          if (aHasPreIftar && !bHasPreIftar) return -1
          if (!aHasPreIftar && bHasPreIftar) return 1
        }
        
        return 0
      })
    }
    
    // Return limited results
    return filtered.slice(0, limit)
  } catch (error) {
    console.error('Unexpected error in searchRecipes:', error)
    return []
  }
}
