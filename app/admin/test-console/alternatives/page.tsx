'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { 
  ArrowLeft, 
  RefreshCcw,
  UtensilsCrossed, 
  Search,
  Clock,
  Scale,
  AlertCircle,
  ChefHat,
  Leaf,
  Wheat,
  Milk,
  TrendingUp,
  Target,
  Award,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getRecipeAlternatives, type RecipeForMealPlan } from '@/lib/actions/test-console'
import { createClient } from '@/lib/supabase/client'

interface RecipeOption {
  id: string
  name: string
  meal_type: string[]
  cuisine?: string | null
  nutrition_per_serving?: { calories?: number }
}

export default function AlternativesPage() {
  const [recipes, setRecipes] = useState<RecipeOption[]>([])
  const [selectedRecipeId, setSelectedRecipeId] = useState('')
  const [targetCalories, setTargetCalories] = useState<number | undefined>(undefined)
  const [useTargetCalories, setUseTargetCalories] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [originalRecipe, setOriginalRecipe] = useState<RecipeForMealPlan | null>(null)
  const [alternatives, setAlternatives] = useState<RecipeForMealPlan[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMealType, setFilterMealType] = useState<string>('')
  const [filterCuisine, setFilterCuisine] = useState<string>('')

  // Load recipes on mount
  useEffect(() => {
    async function loadRecipes() {
      const supabase = createClient()
      const { data } = await supabase
        .from('recipes')
        .select('id, name, meal_type, cuisine, nutrition_per_serving')
        .order('name')
        .limit(100)

      if (data) {
        setRecipes(data)
      }
    }
    loadRecipes()
  }, [])

  const handleFindAlternatives = async () => {
    if (!selectedRecipeId) return

    setIsLoading(true)
    setError(null)

    const { data, originalRecipe: original, error: err } = await getRecipeAlternatives({
      recipeId: selectedRecipeId,
      targetCalories: useTargetCalories ? targetCalories : undefined,
      limit: 15,
    })

    if (err) {
      setError(err)
      setAlternatives(null)
      setOriginalRecipe(null)
    } else {
      setAlternatives(data)
      setOriginalRecipe(original)
    }

    setIsLoading(false)
  }

  // Get unique meal types and cuisines for filters
  const mealTypes = Array.from(new Set(recipes.flatMap(r => r.meal_type || []))).sort()
  const cuisines = Array.from(new Set(recipes.map(r => r.cuisine).filter(Boolean))).sort() as string[]

  const filteredRecipes = recipes.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesMealType = !filterMealType || r.meal_type?.includes(filterMealType)
    const matchesCuisine = !filterCuisine || r.cuisine === filterCuisine
    return matchesSearch && matchesMealType && matchesCuisine
  })

  const getDietaryBadges = (recipe: RecipeForMealPlan) => {
    const badges = []
    if (recipe.is_vegetarian) badges.push({ icon: Leaf, label: 'Vegetarian', color: 'text-green-600' })
    if (recipe.is_vegan) badges.push({ icon: Leaf, label: 'Vegan', color: 'text-green-700' })
    if (recipe.is_gluten_free) badges.push({ icon: Wheat, label: 'GF', color: 'text-amber-600' })
    if (recipe.is_dairy_free) badges.push({ icon: Milk, label: 'DF', color: 'text-blue-600' })
    return badges
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/test-console">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Recipe Alternatives</h1>
          <p className="text-muted-foreground">
            Find alternative recipes with similar meal type and calorie range
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Selection Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              Select Recipe
            </CardTitle>
            <CardDescription>
              Choose a recipe to find alternatives for
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Recipes</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Meal Type Filter</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={filterMealType}
                onChange={(e) => setFilterMealType(e.target.value)}
              >
                <option value="">All Meal Types</option>
                {mealTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Cuisine Filter</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={filterCuisine}
                onChange={(e) => setFilterCuisine(e.target.value)}
              >
                <option value="">All Cuisines</option>
                {cuisines.map(cuisine => (
                  <option key={cuisine} value={cuisine}>{cuisine}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Recipe</Label>
              <div className="max-h-[200px] overflow-y-auto border rounded-md">
                {filteredRecipes.length > 0 ? (
                  filteredRecipes.map(recipe => (
                    <button
                      key={recipe.id}
                      onClick={() => setSelectedRecipeId(recipe.id)}
                      className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 transition-colors ${
                        selectedRecipeId === recipe.id
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="font-medium truncate font-arabic">{recipe.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {recipe.meal_type?.join(', ')} • {recipe.nutrition_per_serving?.calories || 0} kcal
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                    No recipes found
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useTargetCalories}
                  onChange={(e) => setUseTargetCalories(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm">Override target calories</span>
              </label>
              
              {useTargetCalories && (
                <div className="space-y-2">
                  <Label htmlFor="calories">Target Calories</Label>
                  <Input
                    id="calories"
                    type="number"
                    min={100}
                    max={2000}
                    step={10}
                    value={targetCalories || ''}
                    onChange={(e) => setTargetCalories(parseInt(e.target.value) || undefined)}
                    placeholder="e.g. 500"
                  />
                </div>
              )}
            </div>

            <Button 
              onClick={handleFindAlternatives}
              className="w-full"
              disabled={!selectedRecipeId || isLoading}
            >
              {isLoading ? (
                <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4 mr-2" />
              )}
              Find Alternatives
            </Button>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-4">
          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span>{error}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {originalRecipe && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">Original Recipe</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="w-24 h-24 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                    {originalRecipe.image_url ? (
                      <Image
                        src={originalRecipe.image_url}
                        alt={originalRecipe.name}
                        width={96}
                        height={96}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg font-arabic">{originalRecipe.name}</div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      {originalRecipe.cuisine && <span>{originalRecipe.cuisine}</span>}
                      {originalRecipe.meal_type && (
                        <span>{originalRecipe.meal_type.join(', ')}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-lg font-bold">
                        {originalRecipe.nutrition_per_serving?.calories || 0} kcal
                      </span>
                      {getDietaryBadges(originalRecipe).map(badge => (
                        <span key={badge.label} className={`flex items-center gap-1 text-xs ${badge.color}`}>
                          <badge.icon className="h-3 w-3" />
                          {badge.label}
                        </span>
                      ))}
                    </div>
                    {/* Original Recipe Macros */}
                    {originalRecipe.macro_profile && (
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t">
                        <span className="text-xs text-muted-foreground font-medium">Macros:</span>
                        <div className="flex gap-3 text-xs">
                          <span className="text-blue-600 font-medium">
                            P: {originalRecipe.macro_profile.protein_pct.toFixed(0)}%
                          </span>
                          <span className="text-amber-600 font-medium">
                            C: {originalRecipe.macro_profile.carbs_pct.toFixed(0)}%
                          </span>
                          <span className="text-rose-600 font-medium">
                            F: {originalRecipe.macro_profile.fat_pct.toFixed(0)}%
                          </span>
                        </div>
                        {originalRecipe.nutrition_per_serving && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            ({originalRecipe.nutrition_per_serving.protein_g?.toFixed(0) || 0}g / 
                            {originalRecipe.nutrition_per_serving.carbs_g?.toFixed(0) || 0}g / 
                            {originalRecipe.nutrition_per_serving.fat_g?.toFixed(0) || 0}g)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {alternatives && alternatives.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  {alternatives.length} Alternative{alternatives.length !== 1 ? 's' : ''} Found
                </h3>
                <span className="text-sm text-muted-foreground">
                  Target: {useTargetCalories && targetCalories 
                    ? `${targetCalories} kcal` 
                    : `${originalRecipe?.nutrition_per_serving?.calories || 0} kcal (original)`
                  }
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {alternatives.map(recipe => {
                  // Determine swap quality badge color
                  const swapQualityColors = {
                    excellent: 'bg-green-100 text-green-700 border-green-300',
                    good: 'bg-blue-100 text-blue-700 border-blue-300',
                    acceptable: 'bg-amber-100 text-amber-700 border-amber-300',
                    poor: 'bg-rose-100 text-rose-700 border-rose-300',
                  }
                  
                  return (
                    <Card key={recipe.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex gap-3">
                          <div className="w-16 h-16 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                            {recipe.image_url ? (
                              <Image
                                src={recipe.image_url}
                                alt={recipe.name}
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-medium text-sm truncate font-arabic">{recipe.name}</div>
                              {recipe.swap_quality && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${swapQualityColors[recipe.swap_quality]}`}>
                                  {recipe.swap_quality}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              {(recipe.prep_time_minutes || recipe.cook_time_minutes) && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="h-3 w-3" />
                                  {(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)}m
                                </span>
                              )}
                              {recipe.cuisine && <span>{recipe.cuisine}</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="flex items-center gap-1 text-xs font-medium text-primary">
                                <Scale className="h-3 w-3" />
                                {recipe.scale_factor}x
                              </span>
                              <span className="text-sm font-bold">
                                {recipe.scaled_calories} kcal
                              </span>
                            </div>
                            <div className="flex gap-1 mt-1">
                              {getDietaryBadges(recipe).slice(0, 2).map(badge => (
                                <span key={badge.label} className={`flex items-center gap-0.5 text-[10px] ${badge.color}`}>
                                  <badge.icon className="h-2.5 w-2.5" />
                                  {badge.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        {/* Macro Comparison Section */}
                        {recipe.macro_profile && (
                          <div className="mt-3 pt-3 border-t space-y-2">
                            {/* Macro Similarity Score */}
                            {recipe.macro_similarity_score !== undefined && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Target className="h-3 w-3" />
                                  Macro Match
                                </span>
                                <span className="text-xs font-bold text-primary">
                                  {recipe.macro_similarity_score.toFixed(0)}/100
                                </span>
                              </div>
                            )}
                            
                            {/* Macro Percentages */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">Macros:</span>
                              <div className="flex gap-2 text-[10px]">
                                <span className="text-blue-600 font-medium">
                                  P: {recipe.macro_profile.protein_pct.toFixed(0)}%
                                </span>
                                <span className="text-amber-600 font-medium">
                                  C: {recipe.macro_profile.carbs_pct.toFixed(0)}%
                                </span>
                                <span className="text-rose-600 font-medium">
                                  F: {recipe.macro_profile.fat_pct.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                            
                            {/* Protein Difference */}
                            {recipe.protein_diff_g !== undefined && recipe.protein_diff_g !== 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  Protein
                                </span>
                                <span className={`text-[10px] font-medium ${recipe.protein_diff_g > 0 ? 'text-green-600' : 'text-rose-600'}`}>
                                  {recipe.protein_diff_g > 0 ? '+' : ''}{recipe.protein_diff_g.toFixed(1)}g
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {alternatives && alternatives.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No alternatives found for this recipe with the current calorie target
                </p>
              </CardContent>
            </Card>
          )}

          {!alternatives && !error && (
            <Card className="min-h-[400px] flex items-center justify-center">
              <CardContent className="text-center">
                <RefreshCcw className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Select a recipe and click Find Alternatives to see swap options
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
