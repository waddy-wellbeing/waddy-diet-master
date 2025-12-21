'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ChefHat,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Info,
  X,
  Loader2,
  List,
  ShoppingBasket,
  Check,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { ShareRecipeButton } from '@/components/recipes/share-recipe-button'
import { cn } from '@/lib/utils'
import { getUserIngredientSwaps, type IngredientSwapOption } from '@/lib/actions/recipes'
import { saveMealToPlan } from '@/lib/actions/daily-plans'
import type { DailyPlan, PlanMealSlot, PlanSnackItem } from '@/lib/types/nutri'
import type { ScaledRecipeWithIngredients } from './page'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

interface MealBuilderContentProps {
  mealTargets: Record<MealType, { calories: number; protein: number; carbs: number; fat: number }>
  recipesByMealType: Record<MealType, ScaledRecipeWithIngredients[]>
  userId: string
  userRole?: string
  initialMeal?: MealType | null
  todaysPlan?: DailyPlan | null
}

const mealLabels: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
}

export function MealBuilderContent({
  mealTargets,
  recipesByMealType,
  initialMeal = null,
  todaysPlan,
  userRole = 'user',
}: MealBuilderContentProps) {
  const router = useRouter()

  type PlanMealSlotLike = PlanMealSlot & {
    swapped_ingredients?: PlanMealSlot['swapped_ingredients']
  }

  const getPlanMealSlot = (meal: MealType): (PlanMealSlotLike | PlanSnackItem) | null => {
    if (!todaysPlan) return null

    if (meal === 'snacks') {
      const snacks = todaysPlan.snacks
      if (Array.isArray(snacks) && snacks.length > 0) return snacks[0] || null
      return null
    }

    return (todaysPlan[meal] as PlanMealSlotLike | undefined) || null
  }

  const getPlanRecipeId = (meal: MealType): string | null => {
    const slot = getPlanMealSlot(meal)
    return slot?.recipe_id || null
  }

  const getSwapsFromPlan = (meal: MealType): Record<string, IngredientSwapOption> => {
    const swapsMap: Record<string, IngredientSwapOption> = {}
    const slot = getPlanMealSlot(meal)

    if (slot && 'swapped_ingredients' in slot && slot.swapped_ingredients) {
      type SwappedIngredient = NonNullable<PlanMealSlot['swapped_ingredients']>[string]

      Object.entries(slot.swapped_ingredients).forEach(([originalId, swapData]) => {
        const s = swapData as SwappedIngredient

        swapsMap[originalId] = {
          id: s.ingredient_id,
          name: s.name,
          name_ar: null,
          food_group: null,
          subgroup: null,
          serving_size: s.quantity,
          serving_unit: s.unit,
          macros: {
            calories: 0,
            protein_g: 0,
            carbs_g: 0,
            fat_g: 0,
          },
          suggested_amount: s.quantity,
          calorie_diff_percent: 0,
        }
      })
    }

    return swapsMap
  }

  const getIndexForRecipeId = (meal: MealType, recipeId: string | null) => {
    if (!recipeId) return 0
    const idx = recipesByMealType[meal]?.findIndex(r => r.id === recipeId) ?? -1
    return idx >= 0 ? idx : 0
  }

  // State - initialize with initialMeal if provided
  const [selectedMeal, setSelectedMeal] = useState<MealType | null>(initialMeal)
  const [recipeIndices, setRecipeIndices] = useState<Record<MealType, number>>(() => {
    return {
      breakfast: getIndexForRecipeId('breakfast', getPlanRecipeId('breakfast')),
      lunch: getIndexForRecipeId('lunch', getPlanRecipeId('lunch')),
      dinner: getIndexForRecipeId('dinner', getPlanRecipeId('dinner')),
      snacks: getIndexForRecipeId('snacks', getPlanRecipeId('snacks')),
    }
  })
  const [activeTab, setActiveTab] = useState<'ingredients' | 'instructions'>('ingredients')
  const [expandedIngredient, setExpandedIngredient] = useState<string | null>(null)
  const [swaps, setSwaps] = useState<IngredientSwapOption[] | null>(null)
  const [loadingSwaps, setLoadingSwaps] = useState(false)
  const [selectedSwaps, setSelectedSwaps] = useState<Record<string, IngredientSwapOption>>(
    initialMeal ? getSwapsFromPlan(initialMeal) : {}
  )
  const [swipeX, setSwipeX] = useState(0)
  const [showMacroLabels, setShowMacroLabels] = useState(false)
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [swapPaginationPage, setSwapPaginationPage] = useState<Record<string, number>>({})

  // Search
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 150)
    return () => clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    if (!searchOpen) return
    const t = setTimeout(() => searchInputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [searchOpen])

  const searchResults = useMemo(() => {
    if (!selectedMeal) return []

    const all = recipesByMealType[selectedMeal] || []
    const q = debouncedQuery.trim()

    if (!q) return all.slice(0, 20)

    // Normalize text for better matching (remove diacritics, handle both Arabic and English)
    const normalize = (text: string): string => {
      if (!text) return ''
      // Remove Arabic diacritics
      return text
        .replace(/ً|ٌ|ٍ|َ|ُ|ِ|ّ|ْ/g, '') // Remove Arabic diacritics
        .toLowerCase()
        .trim()
    }

    const score = (recipe: ScaledRecipeWithIngredients) => {
      let s = 0
      const qNorm = normalize(q)
      const qLower = q.toLowerCase()

      // Score recipe name (English)
      const recipeName = recipe.name?.toLowerCase() || ''
      const recipeNameNorm = normalize(recipe.name || '')
      if (recipeName === qLower) s += 50
      if (recipeNameNorm === qNorm) s += 50
      if (recipeName.startsWith(qLower)) s += 25
      if (recipeNameNorm.startsWith(qNorm)) s += 25
      if (recipeName.includes(qLower)) s += 15
      if (recipeNameNorm.includes(qNorm)) s += 15

      // Score tags
      const tags = (recipe.tags || []).join(' ').toLowerCase()
      const tagsNorm = normalize(tags)
      if (tags.includes(qLower)) s += 6
      if (tagsNorm.includes(qNorm)) s += 6

      // Score cuisine
      const cuisine = (recipe.cuisine || '').toLowerCase()
      const cuisineNorm = normalize(cuisine)
      if (cuisine.includes(qLower)) s += 4
      if (cuisineNorm.includes(qNorm)) s += 4

      // Score ingredients (highest priority after recipe name)
      const ingredientMatches = (recipe.recipe_ingredients || []).filter(i => {
        const rawName = i.raw_name?.toLowerCase() || ''
        const rawNameNorm = normalize(i.raw_name || '')
        const ingredientName = i.ingredient?.name?.toLowerCase() || ''
        const ingredientNameNorm = normalize(i.ingredient?.name || '')
        const ingredientNameAr = i.ingredient?.name_ar?.toLowerCase() || ''
        const ingredientNameArNorm = normalize(i.ingredient?.name_ar || '')

        // Check for exact or partial matches in ingredient names (English and Arabic)
        return (
          rawName.includes(qLower) ||
          rawNameNorm.includes(qNorm) ||
          ingredientName.includes(qLower) ||
          ingredientNameNorm.includes(qNorm) ||
          ingredientNameAr.includes(qLower) ||
          ingredientNameArNorm.includes(qNorm)
        )
      })

      // Boost score based on number of matching ingredients
      if (ingredientMatches.length > 0) {
        s += ingredientMatches.length * 5 // 5 points per matching ingredient
      }

      return s
    }

    return all
      .map(r => ({ r, s: score(r) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 50)
      .map(x => x.r)
  }, [debouncedQuery, recipesByMealType, selectedMeal])

  const renderHighlighted = (text: string, query: string) => {
    if (!query || !text) return text

    // Normalize text for matching (remove diacritics)
    const normalize = (str: string): string => {
      return str
        .replace(/ً|ٌ|ٍ|َ|ُ|ِ|ّ|ْ/g, '') // Remove Arabic diacritics
        .toLowerCase()
        .trim()
    }

    const lower = text.toLowerCase()
    const q = query.toLowerCase()
    const qNorm = normalize(query)
    const textNorm = normalize(text)

    // Try exact match first
    let idx = lower.indexOf(q)

    // If no match, try with normalized text (handles Arabic diacritics)
    if (idx < 0 && (textNorm !== lower || qNorm !== q)) {
      const normIdx = textNorm.indexOf(qNorm)
      // If normalized match found, highlight the corresponding part in original text
      // This is approximate - we highlight based on character position
      if (normIdx >= 0) {
        idx = Math.min(normIdx, text.length - query.length)
      }
    }

    if (idx < 0) return text

    const before = text.slice(0, idx)
    const match = text.slice(idx, idx + query.length)
    const after = text.slice(idx + query.length)

    return (
      <>
        {before}
        <span className="rounded bg-primary/15 px-1 text-primary font-medium">{match}</span>
        {after}
      </>
    )
  }

  const jumpToRecipe = (meal: MealType, recipeId: string) => {
    const idx = recipesByMealType[meal]?.findIndex(r => r.id === recipeId) ?? -1
    if (idx < 0) return

    setRecipeIndices(prev => ({ ...prev, [meal]: idx }))
    setExpandedIngredient(null)
    setActiveTab('ingredients')
    setSelectedSwaps({})
  }
  
  const SWAPS_PER_PAGE = 5
  
  // Get current recipe for selected meal
  const currentRecipe = selectedMeal 
    ? recipesByMealType[selectedMeal][recipeIndices[selectedMeal]] 
    : null
  const totalRecipes = selectedMeal ? recipesByMealType[selectedMeal].length : 0

  // Handlers
  const handleSelectMeal = (meal: MealType) => {
    setSelectedMeal(meal)
    setActiveTab('ingredients')
    setExpandedIngredient(null)

    // If this meal is already in today's plan, restore its swaps when opening it.
    // If the user later switches recipes, we clear swaps.
    setSelectedSwaps(getSwapsFromPlan(meal))
  }

  const handleBack = () => {
    setSelectedMeal(null)
    setExpandedIngredient(null)
    setSelectedSwaps({})
    setSearchOpen(false)
    setSearchQuery('')
    setDebouncedQuery('')
  }

  const handleNextRecipe = () => {
    if (!selectedMeal) return
    setRecipeIndices(prev => ({
      ...prev,
      [selectedMeal]: (prev[selectedMeal] + 1) % totalRecipes,
    }))
    setSelectedSwaps({})
    setExpandedIngredient(null)
  }

  const handlePrevRecipe = () => {
    if (!selectedMeal) return
    setRecipeIndices(prev => ({
      ...prev,
      [selectedMeal]: (prev[selectedMeal] - 1 + totalRecipes) % totalRecipes,
    }))
    setSelectedSwaps({})
    setExpandedIngredient(null)
  }

  const handleToggleSwaps = async (ingredient: NonNullable<typeof currentRecipe>['recipe_ingredients'][0]) => {
    if (!ingredient.ingredient_id) return
    
    if (expandedIngredient === ingredient.id) {
      setExpandedIngredient(null)
      return
    }
    
    setExpandedIngredient(ingredient.id)
    setLoadingSwaps(true)
    
    const { data } = await getUserIngredientSwaps({
      ingredientId: ingredient.ingredient_id,
      targetAmount: ingredient.scaled_quantity || ingredient.quantity || 100,
      targetUnit: ingredient.unit || 'g',
    })
    
    setSwaps(data)
    setLoadingSwaps(false)
  }

  const handleSelectSwap = (ingredientId: string, swap: IngredientSwapOption) => {
    setSelectedSwaps(prev => ({ ...prev, [ingredientId]: swap }))
    setExpandedIngredient(null)
    // Toast-like feedback (could be extended to show actual toast)
    console.log(`Swapped ingredient for ${ingredientId} to ${swap.name}`)
  }

  const handleClearSwap = (ingredientId: string) => {
    setSelectedSwaps(prev => {
      const updated = { ...prev }
      delete updated[ingredientId]
      return updated
    })
  }

  const handleSaveMeal = async () => {
    if (!selectedMeal || !currentRecipe) {
      console.error('Missing meal or recipe:', { selectedMeal, hasRecipe: !!currentRecipe })
      return
    }
    
    console.log('Saving meal:', {
      meal: selectedMeal,
      recipeId: currentRecipe.id,
      recipeName: currentRecipe.name,
      servings: currentRecipe.scale_factor,
    })
    
    setSaving(true)
    
    // Prepare swapped ingredients data
    const swappedIngredients: Record<string, { ingredient_id: string; name: string; name_ar?: string; quantity: number; unit: string }> = {}
    Object.entries(selectedSwaps).forEach(([ingredientId, swap]) => {
      swappedIngredients[ingredientId] = {
        ingredient_id: swap.id,
        name: swap.name,
        name_ar: swap.name_ar || undefined,
        quantity: swap.suggested_amount,
        unit: swap.serving_unit,
      }
    })
    
    const result = await saveMealToPlan({
      date: format(new Date(), 'yyyy-MM-dd'),
      mealType: selectedMeal,
      recipeId: currentRecipe.id,
      servings: currentRecipe.scale_factor,
      swappedIngredients: Object.keys(swappedIngredients).length > 0 ? swappedIngredients : undefined,
    })
    
    setSaving(false)
    
    if (result.success) {
      // Redirect to dashboard to show the saved meal
      router.push('/dashboard')
    } else {
      alert(result.error || "Failed to save meal. Please try again.")
    }
  }

  // Meal Selection View
  if (!selectedMeal) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-24">
        {/* Header */}
        <div className="px-4 pt-6 pb-4">
          <h1 className="text-2xl font-bold">Meal Builder</h1>
          <p className="text-muted-foreground text-sm">Tap a meal to customize</p>
        </div>

        {/* Meal Cards Grid */}
        <div className="px-4 grid grid-cols-2 gap-3">
          {(Object.keys(mealLabels) as MealType[]).map((meal) => {
            const recipes = recipesByMealType[meal]
            const firstRecipe = recipes[recipeIndices[meal]]
            const target = mealTargets[meal]

            return (
              <div
                key={meal}
                role="button"
                tabIndex={0}
                className="relative aspect-[4/5] rounded-2xl overflow-hidden group cursor-pointer active:scale-[0.97] transition-transform duration-75"
                onClick={() => handleSelectMeal(meal)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleSelectMeal(meal)
                  }
                }}
              >
                {/* Background Image */}
                <div className="absolute inset-0 bg-muted">
                  {firstRecipe?.image_url ? (
                    <Image
                      src={firstRecipe.image_url}
                      alt={mealLabels[meal]}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover"
                      priority={meal === 'breakfast' || meal === 'lunch'}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                      <ChefHat className="w-12 h-12 text-primary/50" />
                    </div>
                  )}
                </div>

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Content */}
                <div className="absolute inset-x-0 bottom-0 p-3 text-left text-white">
                  <h3 className="font-bold text-lg">{mealLabels[meal]}</h3>
                  <div className="flex items-center text-xs text-white/80 mt-1">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <motion.div 
                        className="flex items-center gap-1 shrink-0"
                        layout
                        transition={{ duration: 0.2 }}
                      >
                        <Flame className="w-3 h-3 shrink-0" />
                        <span>{target.calories}</span>
                        <AnimatePresence mode="popLayout">
                          {showMacroLabels && (
                            <motion.span
                              initial={{ width: 0, opacity: 0 }}
                              animate={{ width: 'auto', opacity: 1 }}
                              exit={{ width: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="text-white/60 overflow-hidden whitespace-nowrap"
                            >
                              cal
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.div>
                      <span className="text-white/40">•</span>
                      <motion.div 
                        className="flex items-center gap-1 shrink-0"
                        layout
                        transition={{ duration: 0.2 }}
                      >
                        <Beef className="w-3 h-3 shrink-0" />
                        <span>{target.protein}g</span>
                        <AnimatePresence mode="popLayout">
                          {showMacroLabels && (
                            <motion.span
                              initial={{ width: 0, opacity: 0 }}
                              animate={{ width: 'auto', opacity: 1 }}
                              exit={{ width: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="text-white/60 overflow-hidden whitespace-nowrap"
                            >
                              protein
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.div>
                      <span className="text-white/40">•</span>
                      <motion.div 
                        className="flex items-center gap-1 shrink-0"
                        layout
                        transition={{ duration: 0.2 }}
                      >
                        <Wheat className="w-3 h-3 shrink-0" />
                        <span>{target.carbs}g</span>
                        <AnimatePresence mode="popLayout">
                          {showMacroLabels && (
                            <motion.span
                              initial={{ width: 0, opacity: 0 }}
                              animate={{ width: 'auto', opacity: 1 }}
                              exit={{ width: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="text-white/60 overflow-hidden whitespace-nowrap"
                            >
                              carbs
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.div>
                      <span className="text-white/40">•</span>
                      <motion.div 
                        className="flex items-center gap-1 shrink-0"
                        layout
                        transition={{ duration: 0.2 }}
                      >
                        <Droplet className="w-3 h-3 shrink-0" />
                        <span>{target.fat}g</span>
                        <AnimatePresence mode="popLayout">
                          {showMacroLabels && (
                            <motion.span
                              initial={{ width: 0, opacity: 0 }}
                              animate={{ width: 'auto', opacity: 1 }}
                              exit={{ width: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="text-white/60 overflow-hidden whitespace-nowrap"
                            >
                              fat
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowMacroLabels(!showMacroLabels)
                      }}
                      className="ml-2 p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors shrink-0"
                    >
                      <Info className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-[10px] text-white/60 mt-1">
                    {recipes.length} recipes
                  </p>
                </div>

                {/* Hover indicator */}
                <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-4 h-4 text-white" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Recipe Builder View
  if (!currentRecipe) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="text-center py-12">
          <ChefHat className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg">No recipes available</h3>
          <p className="text-muted-foreground text-sm">
            No recipes match your {mealLabels[selectedMeal].toLowerCase()} calorie target.
          </p>
        </div>
      </div>
    )
  }

  const mainIngredients = currentRecipe.recipe_ingredients.filter(i => !i.is_spice)
  const spices = currentRecipe.recipe_ingredients.filter(i => i.is_spice)
  const scaledProtein = Math.round((currentRecipe.nutrition_per_serving?.protein_g || 0) * currentRecipe.scale_factor)
  const scaledCarbs = Math.round((currentRecipe.nutrition_per_serving?.carbs_g || 0) * currentRecipe.scale_factor)
  const scaledFat = Math.round((currentRecipe.nutrition_per_serving?.fat_g || 0) * currentRecipe.scale_factor)

  // Swipe handlers for recipe navigation
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = 50
    const velocityThreshold = 300
    
    if (Math.abs(info.offset.x) > threshold || Math.abs(info.velocity.x) > velocityThreshold) {
      if (info.offset.x > 0) {
        handlePrevRecipe()
      } else {
        handleNextRecipe()
      }
    }
    setSwipeX(0)
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Search Sheet */}
      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetContent side="bottom" className="h-[88vh] p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Find a recipe</SheetTitle>
            <SheetDescription>
              Search by recipe name, ingredients, tags, or cuisine.
            </SheetDescription>
            <div className="pt-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${selectedMeal ? mealLabels[selectedMeal].toLowerCase() : 'recipes'}...`}
                  className="h-11 pl-9"
                  autoComplete="off"
                />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {debouncedQuery ? (
                  <span>
                    {searchResults.length} result{searchResults.length === 1 ? '' : 's'}
                  </span>
                ) : (
                  <span>Showing top picks</span>
                )}
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {selectedMeal && searchResults.length === 0 ? (
                <div className="text-center py-12">
                  <ChefHat className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium">No matches</p>
                  <p className="text-xs text-muted-foreground mt-1">Try a different keyword.</p>
                </div>
              ) : (
                searchResults.map((r) => {
                  const currentId = selectedMeal ? recipesByMealType[selectedMeal][recipeIndices[selectedMeal]]?.id : null
                  const isCurrent = !!currentId && currentId === r.id

                  const protein = Math.round((r.nutrition_per_serving?.protein_g || 0) * r.scale_factor)
                  const carbs = Math.round((r.nutrition_per_serving?.carbs_g || 0) * r.scale_factor)
                  const fat = Math.round((r.nutrition_per_serving?.fat_g || 0) * r.scale_factor)

                  return (
                    <button
                      key={r.id}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors active:scale-[0.99]',
                        'hover:bg-muted/40',
                        isCurrent && 'border-primary bg-primary/5'
                      )}
                      onClick={() => {
                        if (!selectedMeal) return
                        jumpToRecipe(selectedMeal, r.id)
                        setSearchOpen(false)
                      }}
                    >
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {r.image_url ? (
                          <Image
                            src={r.image_url}
                            alt={r.name}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full grid place-items-center">
                            <ChefHat className="w-6 h-6 text-muted-foreground/60" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium truncate">
                            {renderHighlighted(r.name, debouncedQuery)}
                          </div>
                          {isCurrent && (
                            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full shrink-0">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Flame className="w-3 h-3" />
                            {r.scaled_calories} cal
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Beef className="w-3 h-3" />
                            {protein}g
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Wheat className="w-3 h-3" />
                            {carbs}g
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Droplet className="w-3 h-3" />
                            {fat}g
                          </span>
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Hero Section with Recipe Image - Swipeable */}
      <motion.div 
        className="relative w-full bg-gradient-to-br from-muted to-muted/50 cursor-grab active:cursor-grabbing touch-pan-y overflow-hidden"
        style={{ aspectRatio: '4/3', x: swipeX * 0.3 }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDrag={(_, info) => setSwipeX(info.offset.x)}
        onDragEnd={handleDragEnd}
        animate={{ x: 0 }}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        whileDrag={{ scale: 0.98 }}
      >
        {currentRecipe.image_url ? (
          <>
            <Image
              src={currentRecipe.image_url}
              alt={currentRecipe.name}
              fill
              className="object-cover pointer-events-none"
              sizes="100vw"
              priority
              quality={90}
            />
            {/* Enhanced gradient overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/25 via-primary/15 to-muted flex items-center justify-center relative">
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
              backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(0,0,0,0.1) 0%, transparent 50%)',
            }} />
            <ChefHat className="w-24 h-24 text-primary/40" />
          </div>
        )}
        
        {/* Swipe indicators - Enhanced visibility */}
        {totalRecipes > 1 && (
          <>
            <motion.div 
              className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-sm text-white/80 pointer-events-none"
              animate={{ opacity: swipeX > 30 ? 1 : 0.3, x: swipeX > 30 ? 5 : 0 }}
            >
              <motion.div animate={{ x: swipeX > 30 ? -2 : 0 }} transition={{ duration: 0.1 }}>
                <ChevronLeft className="w-6 h-6" />
              </motion.div>
              <span className="hidden sm:inline font-medium">Previous</span>
            </motion.div>
            <motion.div 
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-sm text-white/80 pointer-events-none"
              animate={{ opacity: swipeX < -30 ? 1 : 0.3, x: swipeX < -30 ? -5 : 0 }}
            >
              <span className="hidden sm:inline font-medium">Next</span>
              <motion.div animate={{ x: swipeX < -30 ? 2 : 0 }} transition={{ duration: 0.1 }}>
                <ChevronRight className="w-6 h-6" />
              </motion.div>
            </motion.div>
          </>
        )}
        
        {/* Back button - Enhanced styling */}
        <motion.button
          onClick={handleBack}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="absolute top-4 left-4 w-11 h-11 rounded-full bg-white dark:bg-background backdrop-blur-md hover:bg-gray-100 dark:hover:bg-background/90 flex items-center justify-center z-10 border-2 border-gray-200 dark:border-border/40 shadow-lg"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-foreground" />
        </motion.button>

        {/* Recipe counter + search + share - Enhanced styling */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <ShareRecipeButton
            recipeId={currentRecipe.id}
            recipeName={currentRecipe.name}
            variant="secondary"
            size="icon"
            className="w-11 h-11 rounded-full bg-white dark:bg-background backdrop-blur-md hover:bg-gray-100 dark:hover:bg-background/90 flex items-center justify-center border-2 border-gray-200 dark:border-border/40 shadow-lg"
          />

          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setSearchOpen(true)
              setSearchQuery('')
              setDebouncedQuery('')
            }}
            className="w-11 h-11 rounded-full bg-white dark:bg-background backdrop-blur-md hover:bg-gray-100 dark:hover:bg-background/90 flex items-center justify-center border-2 border-gray-200 dark:border-border/40 shadow-lg"
            aria-label="Search recipes"
          >
            <Search className="w-5 h-5 text-gray-700 dark:text-foreground" />
          </motion.button>

          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-3 py-1.5 rounded-full bg-white dark:bg-background/85 backdrop-blur-md text-sm font-semibold border-2 border-gray-200 dark:border-border/40 shadow-lg"
          >
            {recipeIndices[selectedMeal] + 1} / {totalRecipes}
          </motion.div>
        </div>

        {/* Recipe info overlay - Better positioning and styling */}
        <div className="absolute bottom-0 left-0 right-0 p-5 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Badge variant="secondary" className="mb-3 shadow-md">
              {mealLabels[selectedMeal]}
            </Badge>
            <h1 className="text-3xl font-bold font-arabic text-white drop-shadow-lg mb-2">{currentRecipe.name}</h1>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center mt-3 text-sm pointer-events-auto"
          >
            <div className="flex items-center gap-4 bg-background/70 backdrop-blur-md rounded-lg px-3 py-2 border border-border/30">
              <motion.div 
                className="flex items-center gap-1.5 font-semibold text-primary"
                layout
                transition={{ duration: 0.2 }}
              >
                <Flame className="w-4 h-4 shrink-0" />
                <span>{currentRecipe.scaled_calories}</span>
                <AnimatePresence mode="popLayout">
                  {showMacroLabels && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 'auto', opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="font-normal text-muted-foreground overflow-hidden whitespace-nowrap"
                    >
                      cal
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
              <div className="h-4 w-px bg-border/30" />
              <motion.div 
                className="flex items-center gap-1.5 text-foreground"
                layout
                transition={{ duration: 0.2 }}
              >
                <Beef className="w-4 h-4 shrink-0 text-orange-500" />
                <span>{scaledProtein}g</span>
                <AnimatePresence mode="popLayout">
                  {showMacroLabels && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 'auto', opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-muted-foreground overflow-hidden whitespace-nowrap"
                    >
                      protein
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
              <div className="h-4 w-px bg-border/30" />
              <motion.div 
                className="flex items-center gap-1.5 text-foreground"
                layout
                transition={{ duration: 0.2 }}
              >
                <Wheat className="w-4 h-4 shrink-0 text-blue-500" />
                <span>{scaledCarbs}g</span>
                <AnimatePresence mode="popLayout">
                  {showMacroLabels && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 'auto', opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-muted-foreground overflow-hidden whitespace-nowrap"
                    >
                      carbs
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
              <div className="h-4 w-px bg-border/30" />
              <motion.div 
                className="flex items-center gap-1.5 text-foreground"
                layout
                transition={{ duration: 0.2 }}
              >
                <Droplet className="w-4 h-4 shrink-0 text-amber-500" />
                <span>{scaledFat}g</span>
                <AnimatePresence mode="popLayout">
                  {showMacroLabels && (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 'auto', opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-muted-foreground overflow-hidden whitespace-nowrap"
                    >
                      fat
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowMacroLabels(!showMacroLabels)}
              className="ml-2 p-2 rounded-full bg-background/70 backdrop-blur-md hover:bg-background border border-border/30 transition-colors shrink-0"
            >
              <Info className="w-4 h-4 text-muted-foreground" />
            </motion.button>
            
            {/* Admin Debug Button */}
            {(userRole === 'admin' || userRole === 'moderator') && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowDebugInfo(!showDebugInfo)}
                className="ml-2 p-2 rounded-full bg-background/70 backdrop-blur-md hover:bg-background border border-border/30 transition-colors shrink-0"
                title="Toggle Debug Info"
              >
                <span className="text-xs">🐛</span>
              </motion.button>
            )}
          </motion.div>
          
          {/* Debug Info (Admin Only) */}
          {showDebugInfo && (userRole === 'admin' || userRole === 'moderator') && (() => {
            const target = mealTargets[selectedMeal]
            const proteinDiff = scaledProtein - target.protein
            const carbsDiff = scaledCarbs - target.carbs
            const proteinOnTrack = Math.abs(proteinDiff) <= 5
            const carbsOnTrack = Math.abs(carbsDiff) <= 10
            const allOnTrack = proteinOnTrack && carbsOnTrack
            
            // Calculate macro quality rating
            const macroScore = currentRecipe.macro_similarity_score || 0
            const macroQuality = macroScore >= 80 
              ? { label: '✨ Excellent', color: 'text-green-600' }
              : macroScore >= 60 
                ? { label: '✅ Good', color: 'text-blue-600' }
                : macroScore >= 40 
                  ? { label: '⚠️ Acceptable', color: 'text-amber-600' }
                  : { label: '❌ Poor', color: 'text-red-600' }
            
            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30"
              >
                <div className="text-xs space-y-2">
                  <div className="font-semibold text-red-600 mb-2">🐛 Debug Info (Admin Only)</div>
                  
                  {/* Macro Match Quality */}
                  <div className="pb-2 border-b border-red-500/30">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground font-semibold">Macro Match Quality:</span>
                      <span className={cn("font-semibold", macroQuality.color)}>
                        {macroQuality.label} ({macroScore})
                      </span>
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      How well this recipe&apos;s macros match your daily targets
                    </div>
                  </div>
                  
                  {/* Target Details */}
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <div className="text-muted-foreground">Target Calories:</div>
                      <div className="font-semibold">{target.calories} kcal</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Target Protein:</div>
                      <div className="font-semibold">{target.protein}g ({proteinOnTrack ? '✓' : proteinDiff > 0 ? '+' + proteinDiff : proteinDiff}g)</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Target Carbs:</div>
                      <div className="font-semibold">{target.carbs}g ({carbsOnTrack ? '✓' : carbsDiff > 0 ? '+' + carbsDiff : carbsDiff}g)</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Target Fat:</div>
                      <div className="font-semibold">{target.fat}g</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-muted-foreground">Macro Tolerance Status:</div>
                      <div className={cn(
                        "font-semibold",
                        allOnTrack ? "text-green-600" : "text-amber-600"
                      )}>
                        {allOnTrack ? '✓ Within Tolerance' : '⚠ Outside Tolerance'} (±5g P, ±10g C)
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })()}
        </div>
      </motion.div>

      {/* Swipe hint for mobile */}
      {totalRecipes > 1 && (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <ChevronLeft className="w-4 h-4" />
            <span>Swipe to change recipe</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="sticky top-0 z-20 bg-background border-b border-border">
        <div className="flex">
          <button
            className={cn(
              "flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors",
              activeTab === 'ingredients' 
                ? "border-primary text-primary" 
                : "border-transparent text-muted-foreground"
            )}
            onClick={() => setActiveTab('ingredients')}
          >
            <ShoppingBasket className="w-4 h-4" />
            Ingredients
          </button>
          <button
            className={cn(
              "flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors",
              activeTab === 'instructions' 
                ? "border-primary text-primary" 
                : "border-transparent text-muted-foreground"
            )}
            onClick={() => setActiveTab('instructions')}
          >
            <List className="w-4 h-4" />
            Instructions
          </button>
        </div>
      </div>

      {/* Save to Plan Button */}
      <div className="px-4 pt-4 pb-2">
        <Button 
          onClick={handleSaveMeal} 
          disabled={saving}
          className="w-full h-12 text-base font-semibold"
          size="lg"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-5 h-5 mr-2" />
              Save to Today&apos;s Plan
            </>
          )}
        </Button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'ingredients' ? (
          <motion.div
            key="ingredients"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="p-4"
          >
            {/* Swap Summary - show if there are active swaps */}
            {Object.keys(selectedSwaps).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-primary mb-2">
                      🔄 {Object.keys(selectedSwaps).length} ingredient swap{Object.keys(selectedSwaps).length > 1 ? 's' : ''} active
                    </p>
                    <div className="space-y-1">
                      {Object.entries(selectedSwaps).map(([ingredId, swap]) => {
                        const original = mainIngredients.find(i => i.id === ingredId)
                        return (
                          <div key={ingredId} className="text-xs text-muted-foreground">
                            <span className="line-through">{original?.ingredient?.name_ar || original?.ingredient?.name}</span>
                            <span className="mx-1">→</span>
                            <span className="font-medium text-primary">{swap.name_ar || swap.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs px-2 hover:bg-destructive/20 text-destructive"
                    onClick={() => setSelectedSwaps({})}
                  >
                    Clear All
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Main Ingredients */}
            <div className="space-y-2">
              {mainIngredients.map((ingredient) => {
                const swap = selectedSwaps[ingredient.id]
                const isExpanded = expandedIngredient === ingredient.id
                
                return (
                  <div key={ingredient.id}>
                    <button
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-xl transition-all",
                        ingredient.ingredient_id 
                          ? "bg-muted/50 hover:bg-muted active:scale-[0.99]" 
                          : "bg-muted/30",
                        isExpanded && "ring-2 ring-primary",
                        swap && "bg-gradient-to-r from-primary/10 to-primary/5 border-l-2 border-primary"
                      )}
                      onClick={() => ingredient.ingredient_id && handleToggleSwaps(ingredient)}
                      disabled={!ingredient.ingredient_id}
                    >
                      <div className="flex-1 text-left">
                        {swap ? (
                          <motion.div 
                            className="flex items-center gap-2"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ type: 'spring', stiffness: 200 }}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-arabic font-semibold text-primary">
                                  ✓ {swap.name_ar || swap.name}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Replaces: {ingredient.ingredient?.name_ar || ingredient.ingredient?.name}
                              </p>
                            </div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation()
                                handleClearSwap(ingredient.id)
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.stopPropagation()
                                  e.preventDefault()
                                  handleClearSwap(ingredient.id)
                                }
                              }}
                              className="p-1.5 hover:bg-destructive/20 rounded-full cursor-pointer transition-colors flex-shrink-0"
                              title="Remove this swap"
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </div>
                          </motion.div>
                        ) : (
                          <span className={cn(
                            "font-arabic",
                            ingredient.is_optional && "text-muted-foreground"
                          )}>
                            {ingredient.ingredient?.name_ar || ingredient.ingredient?.name || ingredient.raw_name}
                            {ingredient.is_optional && (
                              <span className="text-xs ml-1 text-muted-foreground">(optional)</span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-muted-foreground">
                          {swap?.suggested_amount || ingredient.scaled_quantity || ingredient.quantity || '—'}
                          {swap?.serving_unit || ingredient.unit || ''}
                        </span>
                        {ingredient.ingredient_id && (
                          <RefreshCw className={cn(
                            "w-4 h-4 text-muted-foreground transition-transform",
                            isExpanded && "rotate-180 text-primary"
                          )} />
                        )}
                      </div>
                    </button>
                    
                    {/* Swaps Panel */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-3 mt-1 bg-muted/30 rounded-xl border border-border">
                            {loadingSwaps ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                              </div>
                            ) : swaps && swaps.length > 0 ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between mb-3 px-1">
                                  <p className="text-xs text-muted-foreground font-medium">
                                    Available alternatives: {swaps.length}
                                  </p>
                                  {swaps.length > SWAPS_PER_PAGE && (
                                    <span className="text-xs text-muted-foreground">
                                      {(swapPaginationPage[ingredient.id] || 0) * SWAPS_PER_PAGE + 1}–{Math.min((swapPaginationPage[ingredient.id] || 0) * SWAPS_PER_PAGE + SWAPS_PER_PAGE, swaps.length)} of {swaps.length}
                                    </span>
                                  )}
                                </div>
                                {(() => {
                                  const page = swapPaginationPage[ingredient.id] || 0
                                  const startIdx = page * SWAPS_PER_PAGE
                                  const endIdx = startIdx + SWAPS_PER_PAGE
                                  const paginatedSwaps = swaps.slice(startIdx, endIdx)
                                  const totalPages = Math.ceil(swaps.length / SWAPS_PER_PAGE)

                                  return (
                                    <div className="space-y-2">
                                      {paginatedSwaps.map((s, idx) => {
                                        const swapMacros = s.macros || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
                                        
                                        const swapProtein = Math.round((swapMacros.protein_g ?? 0) * 10) / 10
                                        const proteinSimilar = swapProtein >= 10 // High protein if >= 10g
                                        
                                        const caloriesDiff = Math.round(swapMacros.calories ?? 0)
                                        const isHealthier = (swapMacros.calories ?? 0) < 100
                                        const isHighProtein = swapProtein >= 15
                                        
                                        return (
                                          <motion.button
                                            key={s.id}
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className={cn(
                                              "w-full flex items-start gap-3 p-3 rounded-lg transition-all active:scale-95",
                                              "bg-background/60 hover:bg-background border border-border/50",
                                              proteinSimilar && "border-primary/40 hover:bg-primary/5 ring-1 ring-primary/20",
                                              isHealthier && !proteinSimilar && "border-green-400/40 hover:bg-green-500/5",
                                              isHighProtein && !isHealthier && !proteinSimilar && "border-blue-400/40 hover:bg-blue-500/5",
                                            )}
                                            onClick={() => handleSelectSwap(ingredient.id, s)}
                                          >
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="font-arabic text-sm font-medium truncate">
                                                  {s.name_ar || s.name}
                                                </span>
                                                {proteinSimilar && (
                                                  <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                    ⚡ Similar Protein
                                                  </span>
                                                )}
                                                {isHealthier && !proteinSimilar && (
                                                  <span className="text-[10px] font-semibold text-green-600 bg-green-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                    💚 Low Cal
                                                  </span>
                                                )}
                                                {isHighProtein && !isHealthier && !proteinSimilar && (
                                                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                    💪 High Protein
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span className="font-mono">{s.suggested_amount}{s.serving_unit}</span>
                                                <span>•</span>
                                                <span className={cn(
                                                  'font-medium',
                                                  isHealthier ? 'text-green-600' : isHighProtein ? 'text-blue-600' : 'text-foreground'
                                                )}>
                                                  {caloriesDiff} kcal
                                                </span>
                                                {swapProtein > 0 && (
                                                  <>
                                                    <span>•</span>
                                                    <span className={cn(
                                                      'font-medium',
                                                      isHighProtein ? 'text-blue-600' : proteinSimilar ? 'text-primary' : 'text-muted-foreground'
                                                    )}>
                                                      P: {swapProtein}g
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex-shrink-0 text-muted-foreground/40">
                                              <ChevronRight className="w-4 h-4" />
                                            </div>
                                          </motion.button>
                                        )
                                      })}
                                      
                                      {/* Pagination Controls */}
                                      {totalPages > 1 && (
                                        <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-border/30">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 text-xs"
                                            disabled={page === 0}
                                            onClick={() => setSwapPaginationPage(prev => ({
                                              ...prev,
                                              [ingredient.id]: Math.max(0, (prev[ingredient.id] || 0) - 1)
                                            }))}
                                          >
                                            <ChevronLeft className="w-3 h-3 mr-1" />
                                            Prev
                                          </Button>
                                          
                                          <div className="flex items-center gap-1">
                                            {Array.from({ length: totalPages }, (_, i) => (
                                              <button
                                                key={i}
                                                onClick={() => setSwapPaginationPage(prev => ({
                                                  ...prev,
                                                  [ingredient.id]: i
                                                }))}
                                                className={cn(
                                                  "w-6 h-6 rounded text-[10px] font-medium transition-colors",
                                                  page === i
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                                )}
                                              >
                                                {i + 1}
                                              </button>
                                            ))}
                                          </div>
                                          
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2 text-xs"
                                            disabled={page === totalPages - 1}
                                            onClick={() => setSwapPaginationPage(prev => ({
                                              ...prev,
                                              [ingredient.id]: Math.min(totalPages - 1, (prev[ingredient.id] || 0) + 1)
                                            }))}
                                          >
                                            Next
                                            <ChevronRight className="w-3 h-3 ml-1" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No alternatives available
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>

            {/* Spices */}
            {spices.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Spices & Seasonings
                </h3>
                <div className="flex flex-wrap gap-2">
                  {spices.map((spice) => (
                    <Badge
                      key={spice.id}
                      variant="outline"
                      className="font-arabic py-1.5 px-3"
                    >
                      {spice.ingredient?.name_ar || spice.ingredient?.name || spice.raw_name}
                      {spice.scaled_quantity && (
                        <span className="ml-1.5 opacity-60 font-mono text-[10px]">
                          {spice.scaled_quantity}{spice.unit}
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="instructions"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="p-4"
          >
            {currentRecipe.parsed_instructions.length > 0 ? (
              <div className="space-y-4">
                {currentRecipe.parsed_instructions.map((item, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
                    <p className="text-sm leading-relaxed text-foreground/90">
                      {item.instruction}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <List className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No instructions available</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
