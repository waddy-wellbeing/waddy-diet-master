import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRecipeDetails } from '@/lib/actions/recipes'
import { RecipeDetailsContent } from './recipe-details-content'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ scale?: string; calories?: string; meal?: string }>
}

export default async function RecipeDetailsPage({ params, searchParams }: PageProps) {
  const { id: recipeId } = await params
  const { scale, calories, meal } = await searchParams
  
  const supabase = await createClient()
  
  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Parse scaling params
  const scaleFactor = scale ? parseFloat(scale) : undefined
  const targetCalories = calories ? parseInt(calories) : undefined

  // Fetch recipe with scaling
  const { data: recipe, error } = await getUserRecipeDetails({
    recipeId,
    scaleFactor,
    targetCalories,
  })

  if (error || !recipe) {
    notFound()
  }

  return (
    <RecipeDetailsContent 
      recipe={recipe} 
      mealType={meal || null}
    />
  )
}
