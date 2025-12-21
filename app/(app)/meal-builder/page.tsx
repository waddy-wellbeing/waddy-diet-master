import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MealBuilderContent } from './meal-builder-content'
import type { RecipeRecord } from '@/lib/types/nutri'

export const metadata: Metadata = {
  title: 'Meal Builder | Waddy Diet Master',
  description: 'Customize your meals',
}

// Recipe with ingredients and scaling
export interface ScaledRecipeWithIngredients extends RecipeRecord {
  scale_factor: number
  scaled_calories: number
  original_calories: number
  recipe_ingredients: {
    id: string
    ingredient_id: string | null
    raw_name: string
    quantity: number | null
    scaled_quantity: number | null
    unit: string | null
    is_spice: boolean
    is_optional: boolean
    ingredient?: {
      id: string
      name: string
      name_ar: string | null
      food_group: string | null
    } | null
  }[]
  parsed_instructions: { step: number; instruction: string }[]
}

function roundForMeasuring(value: number): number {
  if (value < 10) return Math.round(value)
  return Math.round(value / 5) * 5
}

interface PageProps {
  searchParams: Promise<{ meal?: string }>
}

export default async function MealBuilderPage({ searchParams }: PageProps) {
  const { meal: initialMeal } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch profile, recipes, and today's plan in parallel
  const todayStr = new Date().toISOString().split('T')[0]
  const [{ data: profile }, { data: allRecipes }, { data: todaysPlan }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('recipes')
      .select(`
        *,
        recipe_ingredients (
          id, ingredient_id, raw_name, quantity, unit, is_spice, is_optional,
          ingredient:ingredients!recipe_ingredients_ingredient_id_fkey (
            id, name, name_ar, food_group
          )
        )
      `)
      .eq('is_public', true)
      .not('nutrition_per_serving', 'is', null)
      .order('name'),
    supabase
      .from('daily_plans')
      .select('plan')
      .eq('user_id', user.id)
      .eq('plan_date', todayStr)
      .maybeSingle(),
  ])

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  // Get user's targets
  const dailyCalories = profile.targets?.daily_calories || 2000
  const dailyProtein = profile.targets?.protein_g || 150
  const dailyCarbs = profile.targets?.carbs_g || 250
  const dailyFat = profile.targets?.fat_g || 65
  
  const mealTargets = {
    breakfast: { 
      calories: Math.round(dailyCalories * 0.25), 
      protein: Math.round(dailyProtein * 0.25),
      carbs: Math.round(dailyCarbs * 0.25),
      fat: Math.round(dailyFat * 0.25),
    },
    lunch: { 
      calories: Math.round(dailyCalories * 0.35), 
      protein: Math.round(dailyProtein * 0.35),
      carbs: Math.round(dailyCarbs * 0.35),
      fat: Math.round(dailyFat * 0.35),
    },
    dinner: { 
      calories: Math.round(dailyCalories * 0.30), 
      protein: Math.round(dailyProtein * 0.30),
      carbs: Math.round(dailyCarbs * 0.30),
      fat: Math.round(dailyFat * 0.30),
    },
    snacks: { 
      calories: Math.round(dailyCalories * 0.10), 
      protein: Math.round(dailyProtein * 0.10),
      carbs: Math.round(dailyCarbs * 0.10),
      fat: Math.round(dailyFat * 0.10),
    },
  }

  // Meal type mapping
  const mealTypeMapping: Record<string, string[]> = {
    breakfast: ['breakfast', 'smoothies'],
    lunch: ['lunch', 'one pot', 'dinner', 'side dishes'],
    dinner: ['dinner', 'lunch', 'one pot', 'side dishes', 'breakfast'],
    snacks: ['snack', 'snacks & sweetes', 'smoothies'],
  }

  const minScale = 0.5
  const maxScale = 2.0

  // Process recipes for each meal type
  const recipesByMealType: Record<string, ScaledRecipeWithIngredients[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
  }

  if (allRecipes) {
    for (const mealSlot of ['breakfast', 'lunch', 'dinner', 'snacks'] as const) {
      const targetCalories = mealTargets[mealSlot].calories
      const acceptedMealTypes = mealTypeMapping[mealSlot]
      const primaryMealType = acceptedMealTypes[0]

      const suitableRecipes: ScaledRecipeWithIngredients[] = []

      for (const recipe of allRecipes) {
        const recipeMealTypes = recipe.meal_type || []
        const matchesMealType = acceptedMealTypes.some(t =>
          recipeMealTypes.some((rmt: string) => rmt.toLowerCase() === t.toLowerCase())
        )

        if (!matchesMealType) continue

        const baseCalories = recipe.nutrition_per_serving?.calories
        if (!baseCalories || baseCalories <= 0) continue

        const scaleFactor = targetCalories / baseCalories
        if (scaleFactor < minScale || scaleFactor > maxScale) continue

        // Scale ingredients
        const scaledIngredients = (recipe.recipe_ingredients || []).map((ri: any) => ({
          id: ri.id,
          ingredient_id: ri.ingredient_id,
          raw_name: ri.raw_name,
          quantity: ri.quantity,
          scaled_quantity: ri.quantity ? roundForMeasuring(ri.quantity * scaleFactor) : null,
          unit: ri.unit,
          is_spice: ri.is_spice,
          is_optional: ri.is_optional,
          ingredient: ri.ingredient || null,
        }))

        // Parse instructions
        let parsedInstructions: { step: number; instruction: string }[] = []
        if (Array.isArray(recipe.instructions)) {
          parsedInstructions = recipe.instructions.map((item: any, idx: number) => ({
            step: item.step || idx + 1,
            instruction: typeof item === 'string' ? item : item.instruction || String(item),
          }))
        }

        suitableRecipes.push({
          ...(recipe as RecipeRecord),
          scale_factor: Math.round(scaleFactor * 100) / 100,
          scaled_calories: targetCalories,
          original_calories: baseCalories,
          recipe_ingredients: scaledIngredients,
          parsed_instructions: parsedInstructions,
        })
      }

      // Sort by scale factor closest to 1.0
      suitableRecipes.sort((a, b) => {
        const aPrimary = a.meal_type?.some(t => t.toLowerCase() === primaryMealType) ? 1 : 0
        const bPrimary = b.meal_type?.some(t => t.toLowerCase() === primaryMealType) ? 1 : 0
        if (bPrimary !== aPrimary) return bPrimary - aPrimary

        const aDistFromOne = Math.abs(a.scale_factor - 1)
        const bDistFromOne = Math.abs(b.scale_factor - 1)
        return aDistFromOne - bDistFromOne
      })

      recipesByMealType[mealSlot] = suitableRecipes
    }
  }

  // Validate initial meal param
  const validMeals = ['breakfast', 'lunch', 'dinner', 'snacks']
  const selectedMeal = initialMeal && validMeals.includes(initialMeal) ? initialMeal : null

  return (
    <MealBuilderContent
      mealTargets={mealTargets}
      recipesByMealType={recipesByMealType}
      userId={user.id}
      userRole={profile?.role || 'user'}
      initialMeal={selectedMeal as 'breakfast' | 'lunch' | 'dinner' | 'snacks' | null}
      todaysPlan={todaysPlan?.plan}
    />
  )
}
