'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Clock, 
  Users, 
  ChefHat,
  Flame,
  Leaf,
  Wheat,
  Milk,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  getUserIngredientSwaps, 
  type UserRecipeDetails, 
  type RecipeIngredientDetail,
  type IngredientSwapOption,
} from '@/lib/actions/recipes'
import { cn } from '@/lib/utils'

interface RecipeDetailsContentProps {
  recipe: UserRecipeDetails
  mealType: string | null
}

export function RecipeDetailsContent({ recipe, mealType }: RecipeDetailsContentProps) {
  const [expandedIngredient, setExpandedIngredient] = useState<string | null>(null)
  const [swaps, setSwaps] = useState<IngredientSwapOption[] | null>(null)
  const [loadingSwaps, setLoadingSwaps] = useState(false)
  const [selectedSwaps, setSelectedSwaps] = useState<Record<string, IngredientSwapOption>>({})
  
  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)

  const handleToggleSwaps = async (ingredient: RecipeIngredientDetail) => {
    if (!ingredient.ingredient_id) return
    
    const ingredientKey = ingredient.id
    
    if (expandedIngredient === ingredientKey) {
      setExpandedIngredient(null)
      return
    }
    
    setExpandedIngredient(ingredientKey)
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
    setSelectedSwaps(prev => ({
      ...prev,
      [ingredientId]: swap,
    }))
    setExpandedIngredient(null)
  }

  const handleClearSwap = (ingredientId: string) => {
    setSelectedSwaps(prev => {
      const updated = { ...prev }
      delete updated[ingredientId]
      return updated
    })
  }

  // Separate ingredients into main and spices
  const mainIngredients = recipe.recipe_ingredients.filter(i => !i.is_spice)
  const spices = recipe.recipe_ingredients.filter(i => i.is_spice)

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header Image */}
      <div className="relative h-64 bg-muted">
        {recipe.image_url ? (
          <Image
            src={recipe.image_url}
            alt={recipe.name}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <ChefHat className="w-20 h-20 text-primary/40" />
          </div>
        )}
        
        {/* Back button */}
        <Link 
          href="/dashboard"
          className="absolute top-4 left-4 p-2 bg-background/80 backdrop-blur-sm rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        {/* Meal type badge */}
        {mealType && (
          <Badge 
            variant="secondary" 
            className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm"
          >
            {mealType}
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="px-4 -mt-8 relative z-10">
        {/* Title Card */}
        <Card className="mb-4">
          <CardContent className="pt-6">
            <h1 className="text-2xl font-bold font-arabic mb-2">{recipe.name}</h1>
            
            {recipe.description && (
              <p className="text-muted-foreground text-sm mb-4">{recipe.description}</p>
            )}
            
            {/* Meta info */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {totalTime > 0 && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>{totalTime} min</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>{recipe.servings} serving{recipe.servings > 1 ? 's' : ''}</span>
              </div>
              {recipe.difficulty && (
                <div className="flex items-center gap-1.5">
                  <ChefHat className="w-4 h-4" />
                  <span className="capitalize">{recipe.difficulty}</span>
                </div>
              )}
            </div>

            {/* Dietary badges */}
            <div className="flex flex-wrap gap-2 mt-4">
              {recipe.is_vegetarian && (
                <Badge variant="outline" className="gap-1">
                  <Leaf className="w-3 h-3" /> Vegetarian
                </Badge>
              )}
              {recipe.is_vegan && (
                <Badge variant="outline" className="gap-1">
                  <Leaf className="w-3 h-3" /> Vegan
                </Badge>
              )}
              {recipe.is_gluten_free && (
                <Badge variant="outline" className="gap-1">
                  <Wheat className="w-3 h-3" /> Gluten-Free
                </Badge>
              )}
              {recipe.is_dairy_free && (
                <Badge variant="outline" className="gap-1">
                  <Milk className="w-3 h-3" /> Dairy-Free
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Nutrition Card */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Nutrition (per serving)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">
                  {recipe.scaled_calories}
                </div>
                <div className="text-xs text-muted-foreground">Calories</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {Math.round((recipe.nutrition_per_serving.protein_g || 0) * recipe.scale_factor)}g
                </div>
                <div className="text-xs text-muted-foreground">Protein</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {Math.round((recipe.nutrition_per_serving.carbs_g || 0) * recipe.scale_factor)}g
                </div>
                <div className="text-xs text-muted-foreground">Carbs</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {Math.round((recipe.nutrition_per_serving.fat_g || 0) * recipe.scale_factor)}g
                </div>
                <div className="text-xs text-muted-foreground">Fat</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ingredients Card */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Ingredients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {mainIngredients.map((ingredient) => {
              const swap = selectedSwaps[ingredient.id]
              const isExpanded = expandedIngredient === ingredient.id
              
              return (
                <div key={ingredient.id} className="space-y-2">
                  <div 
                    className={cn(
                      "flex items-center justify-between py-2 border-b border-border/50",
                      ingredient.ingredient_id && "cursor-pointer hover:bg-muted/50 -mx-2 px-2 rounded"
                    )}
                    onClick={() => ingredient.ingredient_id && handleToggleSwaps(ingredient)}
                  >
                    <div className="flex-1">
                      {swap ? (
                        <div className="flex items-center gap-2">
                          <span className="font-arabic font-medium">
                            {swap.name_ar || swap.name}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            swapped
                          </Badge>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleClearSwap(ingredient.id)
                            }}
                            className="p-0.5 hover:bg-destructive/20 rounded"
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
                          {ingredient.is_optional && <span className="text-xs ml-1">(optional)</span>}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-mono">
                        {swap?.suggested_amount || ingredient.scaled_quantity || ingredient.quantity || '—'}
                        {swap?.serving_unit || ingredient.unit || ''}
                      </span>
                      {ingredient.ingredient_id && (
                        <RefreshCw className={cn(
                          "w-4 h-4 transition-transform",
                          isExpanded && "rotate-180"
                        )} />
                      )}
                    </div>
                  </div>
                  
                  {/* Swaps panel */}
                  {isExpanded && (
                    <div className="ml-4 p-3 bg-muted/50 rounded-lg">
                      {loadingSwaps ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : swaps && swaps.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground mb-2">
                            Swap with similar ingredients:
                          </p>
                          {swaps.slice(0, 5).map((s) => (
                            <button
                              key={s.id}
                              className="w-full flex items-center justify-between p-2 hover:bg-background rounded text-left"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSelectSwap(ingredient.id, s)
                              }}
                            >
                              <span className="font-arabic text-sm">
                                {s.name_ar || s.name}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {s.suggested_amount}{s.serving_unit}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          No alternatives available
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            
            {/* Spices section */}
            {spices.length > 0 && (
              <div className="pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Spices & Seasonings</p>
                <div className="flex flex-wrap gap-2">
                  {spices.map((spice) => (
                    <Badge 
                      key={spice.id} 
                      variant="outline"
                      className="font-arabic"
                    >
                      {spice.ingredient?.name_ar || spice.ingredient?.name || spice.raw_name}
                      {spice.scaled_quantity && (
                        <span className="ml-1 opacity-70">
                          {spice.scaled_quantity}{spice.unit}
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions Card */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            {recipe.instructions.length > 0 ? (
              <ol className="space-y-4">
                {recipe.instructions.map((item, index) => (
                  <li key={index} className="flex gap-4">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
                    <p className="text-sm leading-relaxed">{item.instruction}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">
                No instructions available yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {recipe.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
