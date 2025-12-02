'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { 
  ArrowLeft, 
  CalendarDays, 
  UtensilsCrossed, 
  RefreshCw, 
  ChevronDown,
  ChevronUp,
  Clock,
  Scale,
  AlertCircle,
  CheckCircle2,
  Filter,
  Apple,
  Sparkles,
  X,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  generateTestMealPlan, 
  getRecipeAlternatives,
  getIngredientSwaps,
  type RecipeForMealPlan 
} from '@/lib/actions/test-console'
import type { MealSlot } from '@/lib/types/nutri'

const PAGE_SIZE = 12 // Items per page for infinite scroll

// Meal structure templates
const MEAL_TEMPLATES: Record<string, MealSlot[]> = {
  '3_meals': [
    { name: 'breakfast', percentage: 0.30, target_calories: 0 },
    { name: 'lunch', percentage: 0.40, target_calories: 0 },
    { name: 'dinner', percentage: 0.30, target_calories: 0 },
  ],
  '3_meals_1_snack': [
    { name: 'breakfast', percentage: 0.25, target_calories: 0 },
    { name: 'lunch', percentage: 0.35, target_calories: 0 },
    { name: 'snack', percentage: 0.10, target_calories: 0 },
    { name: 'dinner', percentage: 0.30, target_calories: 0 },
  ],
  '3_meals_2_snacks': [
    { name: 'breakfast', percentage: 0.25, target_calories: 0 },
    { name: 'snack_1', percentage: 0.10, target_calories: 0 },
    { name: 'lunch', percentage: 0.30, target_calories: 0 },
    { name: 'snack_2', percentage: 0.10, target_calories: 0 },
    { name: 'dinner', percentage: 0.25, target_calories: 0 },
  ],
}

const MEAL_SLOT_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  snack_1: 'Snack 1',
  snack_2: 'Snack 2',
  snack_3: 'Snack 3',
}

interface MealPlanResult {
  slot: MealSlot
  recipe: RecipeForMealPlan | null
  alternativeCount: number
}

interface SwapOption {
  id: string
  name: string
  name_ar: string | null
  food_group: string | null
  subgroup: string | null
  serving_size: number
  serving_unit: string
  macros: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number }
  suggested_amount?: number
  calorie_diff_percent?: number
}

export default function FullTesterPage() {
  // Plan state
  const [dailyCalories, setDailyCalories] = useState(2000)
  const [selectedTemplate, setSelectedTemplate] = useState('3_meals_2_snacks')
  const [dietaryFilters, setDietaryFilters] = useState({
    vegetarian: false,
    vegan: false,
    gluten_free: false,
    dairy_free: false,
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [mealPlan, setMealPlan] = useState<MealPlanResult[] | null>(null)
  const [totalCalories, setTotalCalories] = useState(0)

  // Alternatives state with pagination
  const [selectedMealIndex, setSelectedMealIndex] = useState<number | null>(null)
  const [alternatives, setAlternatives] = useState<RecipeForMealPlan[] | null>(null)
  const [alternativesTotal, setAlternativesTotal] = useState(0)
  const [alternativesHasMore, setAlternativesHasMore] = useState(false)
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false)
  const [isLoadingMoreAlternatives, setIsLoadingMoreAlternatives] = useState(false)
  const [currentRecipeId, setCurrentRecipeId] = useState<string | null>(null)
  const [currentTargetCalories, setCurrentTargetCalories] = useState<number>(0)

  // Ingredient swaps state with pagination
  const [selectedIngredient, setSelectedIngredient] = useState<{
    id: string
    name: string
    amount: number
    unit: string
  } | null>(null)
  const [ingredientSwaps, setIngredientSwaps] = useState<SwapOption[] | null>(null)
  const [swapsTotal, setSwapsTotal] = useState(0)
  const [swapsHasMore, setSwapsHasMore] = useState(false)
  const [isLoadingSwaps, setIsLoadingSwaps] = useState(false)
  const [isLoadingMoreSwaps, setIsLoadingMoreSwaps] = useState(false)

  // UI state
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null)
  
  // Refs for scroll detection
  const alternativesRef = useRef<HTMLDivElement>(null)
  const swapsRef = useRef<HTMLDivElement>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setMealPlan(null)
    setAlternatives(null)
    setAlternativesTotal(0)
    setAlternativesHasMore(false)
    setSelectedMealIndex(null)
    setIngredientSwaps(null)
    setSwapsTotal(0)
    setSwapsHasMore(false)
    setSelectedIngredient(null)
    
    const mealStructure = MEAL_TEMPLATES[selectedTemplate]
    
    const { data, totalCalories: total } = await generateTestMealPlan({
      dailyCalories,
      mealStructure,
      dietaryFilters: Object.entries(dietaryFilters).some(([, v]) => v) 
        ? dietaryFilters 
        : undefined,
    })

    setMealPlan(data)
    setTotalCalories(total)
    setIsGenerating(false)
  }

  const handleViewAlternatives = async (index: number, recipe: RecipeForMealPlan, targetCalories: number) => {
    if (selectedMealIndex === index) {
      setSelectedMealIndex(null)
      setAlternatives(null)
      setAlternativesTotal(0)
      setAlternativesHasMore(false)
      return
    }

    setSelectedMealIndex(index)
    setIsLoadingAlternatives(true)
    setAlternatives(null)
    setAlternativesTotal(0)
    setAlternativesHasMore(false)
    setIngredientSwaps(null)
    setSwapsTotal(0)
    setSwapsHasMore(false)
    setSelectedIngredient(null)
    setCurrentRecipeId(recipe.id)
    setCurrentTargetCalories(targetCalories)

    const { data, total, hasMore } = await getRecipeAlternatives({
      recipeId: recipe.id,
      targetCalories,
      limit: PAGE_SIZE,
      offset: 0,
    })

    setAlternatives(data)
    setAlternativesTotal(total)
    setAlternativesHasMore(hasMore)
    setIsLoadingAlternatives(false)
  }

  const handleLoadMoreAlternatives = async () => {
    if (!currentRecipeId || isLoadingMoreAlternatives || !alternativesHasMore) return
    
    setIsLoadingMoreAlternatives(true)
    const currentOffset = alternatives?.length || 0
    
    const { data, hasMore } = await getRecipeAlternatives({
      recipeId: currentRecipeId,
      targetCalories: currentTargetCalories,
      limit: PAGE_SIZE,
      offset: currentOffset,
    })

    if (data) {
      setAlternatives(prev => [...(prev || []), ...data])
    }
    setAlternativesHasMore(hasMore)
    setIsLoadingMoreAlternatives(false)
  }

  // Scroll handler for alternatives - load more when near bottom
  const handleAlternativesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight
    // Load more when within 100px of bottom
    if (scrollBottom < 100 && alternativesHasMore && !isLoadingMoreAlternatives) {
      handleLoadMoreAlternatives()
    }
  }, [alternativesHasMore, isLoadingMoreAlternatives])

  const handleSwapRecipe = (newRecipe: RecipeForMealPlan) => {
    if (selectedMealIndex === null || !mealPlan) return

    const updatedPlan = [...mealPlan]
    updatedPlan[selectedMealIndex] = {
      ...updatedPlan[selectedMealIndex],
      recipe: newRecipe,
    }
    setMealPlan(updatedPlan)
    
    // Recalculate total
    const newTotal = updatedPlan.reduce((sum, m) => sum + (m.recipe?.scaled_calories || 0), 0)
    setTotalCalories(newTotal)
    
    setAlternatives(null)
    setAlternativesTotal(0)
    setAlternativesHasMore(false)
    setSelectedMealIndex(null)
  }

  const handleViewIngredientSwaps = async (ingredientId: string, name: string, amount: number, unit: string) => {
    if (selectedIngredient?.id === ingredientId) {
      setSelectedIngredient(null)
      setIngredientSwaps(null)
      setSwapsTotal(0)
      setSwapsHasMore(false)
      return
    }

    setSelectedIngredient({ id: ingredientId, name, amount, unit })
    setIsLoadingSwaps(true)
    setIngredientSwaps(null)
    setSwapsTotal(0)
    setSwapsHasMore(false)

    const { data, total, hasMore } = await getIngredientSwaps({
      ingredientId,
      targetAmount: amount,
      limit: PAGE_SIZE,
      offset: 0,
    })

    setIngredientSwaps(data)
    setSwapsTotal(total)
    setSwapsHasMore(hasMore)
    setIsLoadingSwaps(false)
  }

  const handleLoadMoreSwaps = async () => {
    if (!selectedIngredient || isLoadingMoreSwaps || !swapsHasMore) return
    
    setIsLoadingMoreSwaps(true)
    const currentOffset = ingredientSwaps?.length || 0
    
    const { data, hasMore } = await getIngredientSwaps({
      ingredientId: selectedIngredient.id,
      targetAmount: selectedIngredient.amount,
      limit: PAGE_SIZE,
      offset: currentOffset,
    })

    if (data) {
      setIngredientSwaps(prev => [...(prev || []), ...data])
    }
    setSwapsHasMore(hasMore)
    setIsLoadingMoreSwaps(false)
  }

  // Scroll handler for swaps - load more when near bottom
  const handleSwapsScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight
    if (scrollBottom < 100 && swapsHasMore && !isLoadingMoreSwaps) {
      handleLoadMoreSwaps()
    }
  }, [swapsHasMore, isLoadingMoreSwaps])

  const calorieVariance = mealPlan ? totalCalories - dailyCalories : 0
  const variancePercent = mealPlan ? Math.round((calorieVariance / dailyCalories) * 100) : 0

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
          <h1 className="text-2xl font-bold">Full Plan Tester</h1>
          <p className="text-muted-foreground">
            Generate a meal plan, swap recipes, and test ingredient alternatives - all in one place
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Config Panel */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="calories" className="text-xs">Daily Calories</Label>
              <Input
                id="calories"
                type="number"
                min={1200}
                max={5000}
                step={50}
                value={dailyCalories}
                onChange={(e) => setDailyCalories(parseInt(e.target.value) || 2000)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Meal Structure</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                <option value="3_meals">3 Meals</option>
                <option value="3_meals_1_snack">3 Meals + 1 Snack</option>
                <option value="3_meals_2_snacks">3 Meals + 2 Snacks</option>
              </select>
            </div>

            {/* Quick calorie preview */}
            <div className="rounded-lg bg-muted/50 p-2 space-y-1 text-xs">
              {MEAL_TEMPLATES[selectedTemplate].map(slot => (
                <div key={slot.name} className="flex justify-between">
                  <span className="text-muted-foreground">{MEAL_SLOT_LABELS[slot.name] || slot.name}</span>
                  <span className="font-mono">{Math.round(dailyCalories * slot.percentage)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Dietary Filters
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'vegetarian', label: 'Veg' },
                  { key: 'vegan', label: 'Vegan' },
                  { key: 'gluten_free', label: 'GF' },
                  { key: 'dairy_free', label: 'DF' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={dietaryFilters[key as keyof typeof dietaryFilters]}
                      onChange={(e) => setDietaryFilters(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="h-3 w-3 rounded"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleGenerate} 
              className="w-full" 
              disabled={isGenerating}
            >
              {isGenerating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate Plan
            </Button>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          {mealPlan && (
            <>
              {/* Summary Bar */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div>
                        <div className="text-xs text-muted-foreground">Total</div>
                        <div className="text-2xl font-bold">{totalCalories} kcal</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Target</div>
                        <div className="text-lg font-medium text-muted-foreground">{dailyCalories} kcal</div>
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                      Math.abs(variancePercent) <= 2 
                        ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                        : Math.abs(variancePercent) <= 5
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                    }`}>
                      {Math.abs(variancePercent) <= 2 ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <span className="font-medium">
                        {calorieVariance >= 0 ? '+' : ''}{calorieVariance} ({variancePercent >= 0 ? '+' : ''}{variancePercent}%)
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Meal Cards */}
              <div className="space-y-3">
                {mealPlan.map(({ slot, recipe, alternativeCount }, index) => (
                  <Card 
                    key={slot.name} 
                    className={`transition-all ${selectedMealIndex === index ? 'ring-2 ring-primary' : ''}`}
                  >
                    <CardContent className="py-4">
                      {/* Main meal row */}
                      <div className="flex items-center gap-4">
                        {/* Slot label */}
                        <div className="w-20 flex-shrink-0">
                          <div className="font-medium text-sm">{MEAL_SLOT_LABELS[slot.name] || slot.name}</div>
                          <div className="text-xs text-muted-foreground">{slot.target_calories} kcal</div>
                        </div>

                        {/* Recipe card */}
                        {recipe ? (
                          <>
                            <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                              {recipe.image_url ? (
                                <Image
                                  src={recipe.image_url}
                                  alt={recipe.name}
                                  width={56}
                                  height={56}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate font-arabic">{recipe.name}</div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                <span className="flex items-center gap-1 text-primary font-medium">
                                  <Scale className="h-3 w-3" />
                                  {recipe.scale_factor}x
                                </span>
                                <span className="font-medium text-foreground">{recipe.scaled_calories} kcal</span>
                                {recipe.nutrition_per_serving?.protein_g && (
                                  <span>{Math.round(recipe.nutrition_per_serving.protein_g * (recipe.scale_factor || 1))}g protein</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant={selectedMealIndex === index ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleViewAlternatives(index, recipe, slot.target_calories || 0)}
                                disabled={isLoadingAlternatives && selectedMealIndex === index}
                              >
                                {isLoadingAlternatives && selectedMealIndex === index ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    {alternativeCount}
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedMeal(expandedMeal === index ? null : index)}
                              >
                                {expandedMeal === index ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="flex-1 flex items-center text-muted-foreground text-sm">
                            <AlertCircle className="h-4 w-4 mr-2" />
                            No suitable recipe found
                          </div>
                        )}
                      </div>

                      {/* Expanded: Ingredients */}
                      {expandedMeal === index && recipe && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="text-xs font-medium text-muted-foreground mb-2">
                            Ingredients (click to see swaps)
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {recipe.recipe_ingredients && recipe.recipe_ingredients.length > 0 ? (
                              recipe.recipe_ingredients
                                .filter((ing) => ing.ingredient_id) // Only show ingredients with valid IDs
                                .map((ing) => (
                                <button
                                  key={ing.id}
                                  onClick={() => handleViewIngredientSwaps(
                                    ing.ingredient_id!,
                                    ing.ingredient?.name || ing.raw_name || 'Unknown',
                                    ing.quantity || 1,
                                    ing.unit || 'g'
                                  )}
                                  className={`px-2 py-1 rounded-full text-xs transition-colors ${
                                    selectedIngredient?.id === ing.ingredient_id
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted hover:bg-muted/80'
                                  }`}
                                >
                                  <Apple className="h-3 w-3 inline mr-1" />
                                  {ing.ingredient?.name || ing.raw_name || 'Unknown'} ({ing.quantity || '?'}{ing.unit || ''})
                                </button>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">No ingredients data available</span>
                            )}
                          </div>

                          {/* Ingredient swaps */}
                          {selectedIngredient && expandedMeal === index && (
                            <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-xs font-medium">
                                  Swaps for {selectedIngredient.name} ({ingredientSwaps?.length || 0} of {swapsTotal})
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => {
                                    setSelectedIngredient(null)
                                    setIngredientSwaps(null)
                                    setSwapsTotal(0)
                                    setSwapsHasMore(false)
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                              {isLoadingSwaps ? (
                                <div className="flex items-center justify-center py-4">
                                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                              ) : ingredientSwaps && ingredientSwaps.length > 0 ? (
                                <div 
                                  className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto"
                                  onScroll={handleSwapsScroll}
                                  ref={swapsRef}
                                >
                                  {ingredientSwaps.map((swap) => (
                                    <div 
                                      key={swap.id}
                                      className="p-2 bg-background rounded border text-xs"
                                    >
                                      <div className="font-medium truncate">{swap.name}</div>
                                      <div className="text-muted-foreground">
                                        {swap.suggested_amount} {swap.serving_unit}
                                        {swap.calorie_diff_percent !== undefined && (
                                          <span className={`ml-1 ${
                                            Math.abs(swap.calorie_diff_percent) <= 5 
                                              ? 'text-green-600' 
                                              : 'text-yellow-600'
                                          }`}>
                                            ({swap.calorie_diff_percent >= 0 ? '+' : ''}{swap.calorie_diff_percent}%)
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                  {/* Loading more indicator */}
                                  {isLoadingMoreSwaps && (
                                    <div className="col-span-full flex items-center justify-center py-2">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      <span className="ml-2 text-xs text-muted-foreground">Loading...</span>
                                    </div>
                                  )}
                                  {/* Load more button */}
                                  {swapsHasMore && !isLoadingMoreSwaps && (
                                    <div className="col-span-full text-center py-1">
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={handleLoadMoreSwaps}
                                        className="text-xs h-6"
                                      >
                                        +{swapsTotal - (ingredientSwaps?.length || 0)} more
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground text-center py-2">
                                  No swaps available
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Alternatives panel */}
                      {selectedMealIndex === index && (alternatives || isLoadingAlternatives) && (
                        <div className="mt-4 pt-4 border-t border-primary/20 bg-primary/5 -mx-6 px-6 pb-2 rounded-b-lg">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-sm font-medium text-primary">
                              🔄 Alternative Recipes (click to swap)
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {alternatives?.length || 0} of {alternativesTotal} options
                            </span>
                          </div>
                          {isLoadingAlternatives ? (
                            <div className="flex items-center justify-center py-8">
                              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                            </div>
                          ) : alternatives && alternatives.length > 0 ? (
                            <div 
                              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pb-2"
                              onScroll={handleAlternativesScroll}
                              ref={alternativesRef}
                            >
                              {alternatives.map((alt) => (
                                <button
                                  key={alt.id}
                                  onClick={() => handleSwapRecipe(alt)}
                                  className="p-2 rounded-lg border-2 border-transparent bg-card hover:border-primary hover:bg-primary/5 transition-all text-left shadow-sm"
                                >
                                  <div className="w-full aspect-square rounded bg-muted mb-2 overflow-hidden">
                                    {alt.image_url ? (
                                      <Image
                                        src={alt.image_url}
                                        alt={alt.name}
                                        width={100}
                                        height={100}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-xs font-medium truncate">{alt.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {alt.scale_factor}x • {alt.scaled_calories} kcal
                                  </div>
                                </button>
                              ))}
                              {/* Loading more indicator */}
                              {isLoadingMoreAlternatives && (
                                <div className="col-span-full flex items-center justify-center py-4">
                                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                  <span className="ml-2 text-sm text-muted-foreground">Loading more...</span>
                                </div>
                              )}
                              {/* Load more trigger area */}
                              {alternativesHasMore && !isLoadingMoreAlternatives && (
                                <div className="col-span-full text-center py-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={handleLoadMoreAlternatives}
                                    className="text-xs"
                                  >
                                    Load more ({alternativesTotal - (alternatives?.length || 0)} remaining)
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground text-center py-4">
                              No alternative recipes found
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {!mealPlan && (
            <Card className="min-h-[400px] flex items-center justify-center">
              <CardContent className="text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-1">Ready to Test</p>
                <p className="text-muted-foreground text-sm">
                  Configure your plan and click Generate to start testing
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
