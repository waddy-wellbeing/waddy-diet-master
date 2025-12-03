'use client'

import { useState } from 'react'
import Image from 'next/image'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getUserIngredientSwaps, type IngredientSwapOption } from '@/lib/actions/recipes'
import type { ScaledRecipeWithIngredients } from './page'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

interface MealBuilderContentProps {
  mealTargets: Record<MealType, { calories: number; protein: number; carbs: number; fat: number }>
  recipesByMealType: Record<MealType, ScaledRecipeWithIngredients[]>
  userId: string
  initialMeal?: MealType | null
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
}: MealBuilderContentProps) {
  // State - initialize with initialMeal if provided
  const [selectedMeal, setSelectedMeal] = useState<MealType | null>(initialMeal)
  const [recipeIndices, setRecipeIndices] = useState<Record<MealType, number>>({
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    snacks: 0,
  })
  const [activeTab, setActiveTab] = useState<'ingredients' | 'instructions'>('ingredients')
  const [expandedIngredient, setExpandedIngredient] = useState<string | null>(null)
  const [swaps, setSwaps] = useState<IngredientSwapOption[] | null>(null)
  const [loadingSwaps, setLoadingSwaps] = useState(false)
  const [selectedSwaps, setSelectedSwaps] = useState<Record<string, IngredientSwapOption>>({})
  const [swipeX, setSwipeX] = useState(0)
  const [showMacroLabels, setShowMacroLabels] = useState(false)
  
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
    setSelectedSwaps({})
  }

  const handleBack = () => {
    setSelectedMeal(null)
    setExpandedIngredient(null)
    setSelectedSwaps({})
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
  }

  const handleClearSwap = (ingredientId: string) => {
    setSelectedSwaps(prev => {
      const updated = { ...prev }
      delete updated[ingredientId]
      return updated
    })
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
              <motion.div
                key={meal}
                role="button"
                tabIndex={0}
                className="relative aspect-[4/5] rounded-2xl overflow-hidden group cursor-pointer"
                whileTap={{ scale: 0.97 }}
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
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
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
              </motion.div>
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
      {/* Hero Section with Recipe Image - Swipeable */}
      <motion.div 
        className="relative h-72 cursor-grab active:cursor-grabbing touch-pan-y"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDrag={(_, info) => setSwipeX(info.offset.x)}
        onDragEnd={handleDragEnd}
        animate={{ x: 0 }}
        style={{ x: swipeX * 0.3 }}
        whileDrag={{ scale: 0.98 }}
      >
        {currentRecipe.image_url ? (
          <Image
            src={currentRecipe.image_url}
            alt={currentRecipe.name}
            fill
            className="object-cover pointer-events-none"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
            <ChefHat className="w-20 h-20 text-primary/40" />
          </div>
        )}
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent pointer-events-none" />
        
        {/* Swipe indicators */}
        {totalRecipes > 1 && (
          <>
            <motion.div 
              className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-sm text-muted-foreground pointer-events-none"
              animate={{ opacity: swipeX > 30 ? 1 : 0.4, x: swipeX > 30 ? 5 : 0 }}
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Previous</span>
            </motion.div>
            <motion.div 
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-sm text-muted-foreground pointer-events-none"
              animate={{ opacity: swipeX < -30 ? 1 : 0.4, x: swipeX < -30 ? -5 : 0 }}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-5 h-5" />
            </motion.div>
          </>
        )}
        
        {/* Back button */}
        <button
          onClick={handleBack}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center z-10"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Recipe counter */}
        <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm text-sm font-medium">
          {recipeIndices[selectedMeal] + 1} / {totalRecipes}
        </div>

        {/* Recipe info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
          <Badge variant="secondary" className="mb-2">
            {mealLabels[selectedMeal]}
          </Badge>
          <h1 className="text-2xl font-bold font-arabic">{currentRecipe.name}</h1>
          <div className="flex items-center mt-2 text-sm pointer-events-auto">
            <div className="flex items-center gap-3">
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
              <motion.div 
                className="flex items-center gap-1.5"
                layout
                transition={{ duration: 0.2 }}
              >
                <Beef className="w-4 h-4 shrink-0" />
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
              <motion.div 
                className="flex items-center gap-1.5"
                layout
                transition={{ duration: 0.2 }}
              >
                <Wheat className="w-4 h-4 shrink-0" />
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
              <motion.div 
                className="flex items-center gap-1.5"
                layout
                transition={{ duration: 0.2 }}
              >
                <Droplet className="w-4 h-4 shrink-0" />
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
            <button
              onClick={() => setShowMacroLabels(!showMacroLabels)}
              className="ml-3 p-1.5 rounded-full bg-muted/30 hover:bg-muted/50 transition-colors shrink-0"
            >
              <Info className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
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
                        isExpanded && "ring-2 ring-primary"
                      )}
                      onClick={() => ingredient.ingredient_id && handleToggleSwaps(ingredient)}
                      disabled={!ingredient.ingredient_id}
                    >
                      <div className="flex-1 text-left">
                        {swap ? (
                          <div className="flex items-center gap-2">
                            <span className="font-arabic font-medium">
                              {swap.name_ar || swap.name}
                            </span>
                            <Badge variant="secondary" className="text-[10px] px-1.5">
                              swapped
                            </Badge>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleClearSwap(ingredient.id)
                              }}
                              className="p-1 hover:bg-destructive/20 rounded-full"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
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
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground mb-2 px-1">
                                  Tap to swap with:
                                </p>
                                {swaps.slice(0, 6).map((s) => (
                                  <button
                                    key={s.id}
                                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-background transition-colors"
                                    onClick={() => handleSelectSwap(ingredient.id, s)}
                                  >
                                    <span className="font-arabic text-sm">
                                      {s.name_ar || s.name}
                                    </span>
                                    <span className="text-sm text-muted-foreground font-mono">
                                      {s.suggested_amount}{s.serving_unit}
                                    </span>
                                  </button>
                                ))}
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
