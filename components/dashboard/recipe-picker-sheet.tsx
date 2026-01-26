/**
 * Recipe Picker Sheet Component
 * 
 * Nested sheet for selecting recipes when planning meals
 * Includes search and displays all available recipes
 */

'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronLeft, Clock, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { RecipeRecord } from '@/lib/types/nutri'

interface RecipePickerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipes: RecipeRecord[]
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks' | null
  onRecipeSelected: (recipeId: string) => void
}

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
}

export function RecipePickerSheet({
  open,
  onOpenChange,
  recipes,
  mealType,
  onRecipeSelected,
}: RecipePickerSheetProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter recipes based on meal type and search query
  const filteredRecipes = useMemo(() => {
    if (!mealType) return []

    // Meal type mapping (same logic as dashboard)
    // Strict meal-type mapping: only related categories per slot
    const mealTypeMapping: Record<string, string[]> = {
      breakfast: ['breakfast', 'smoothies'],
      lunch: ['lunch', 'one pot', 'side dishes'],
      dinner: ['dinner', 'one pot', 'side dishes'],
      snacks: ['snack', 'snacks & sweetes', 'smoothies'],
    }

    const acceptedTypes = mealTypeMapping[mealType] || []

    return recipes.filter(recipe => {
      // Filter by meal type
      const recipeMealTypes = recipe.meal_type || []
      const matchesMealType = acceptedTypes.some(t =>
        recipeMealTypes.some((rmt: string) => rmt.toLowerCase() === t.toLowerCase())
      )

      if (!matchesMealType) return false

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const name = recipe.name.toLowerCase()
        const description = recipe.description?.toLowerCase() || ''
        
        return name.includes(query) || description.includes(query)
      }

      return true
    })
  }, [recipes, mealType, searchQuery])

  const handleRecipeClick = (recipeId: string) => {
    onRecipeSelected(recipeId)
    setSearchQuery('') // Reset search
  }

  const handleBack = () => {
    onOpenChange(false)
    setSearchQuery('') // Reset search
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[90vh] max-h-[90vh] rounded-t-xl flex flex-col p-0 overflow-hidden"
      >
        <SheetHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <SheetTitle className="text-xl">
                Select {mealType ? MEAL_TYPE_LABELS[mealType] : 'Recipe'}
              </SheetTitle>
              <SheetDescription>
                Choose a recipe for your meal plan
              </SheetDescription>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {filteredRecipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-2">No recipes found</p>
              {searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredRecipes.map(recipe => (
                <button
                  key={recipe.id}
                  onClick={() => handleRecipeClick(recipe.id)}
                  className={cn(
                    'flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border border-border',
                    'bg-card hover:bg-muted/50 transition-colors',
                    'text-left touch-manipulation active:scale-[0.98]'
                  )}
                >
                  {recipe.image_url ? (
                    <img
                      src={recipe.image_url}
                      alt={recipe.name}
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-muted flex-shrink-0 flex items-center justify-center">
                      <span className="text-2xl">🍽️</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate mb-1">
                      {recipe.name}
                    </h3>

                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {recipe.nutrition_per_serving?.calories && (
                        <div className="flex items-center gap-1">
                          <Flame className="h-3.5 w-3.5" />
                          <span>{Math.round(recipe.nutrition_per_serving.calories)} kcal</span>
                        </div>
                      )}
                      {recipe.prep_time_minutes && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{recipe.prep_time_minutes} min</span>
                        </div>
                      )}
                    </div>

                    {/* Macros */}
                    {recipe.nutrition_per_serving && (
                      <div className="flex items-center gap-2 mt-2 text-xs">
                        {recipe.nutrition_per_serving.protein_g && (
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">
                            P: {Math.round(recipe.nutrition_per_serving.protein_g)}g
                          </span>
                        )}
                        {recipe.nutrition_per_serving.carbs_g && (
                          <span className="px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">
                            C: {Math.round(recipe.nutrition_per_serving.carbs_g)}g
                          </span>
                        )}
                        {recipe.nutrition_per_serving.fat_g && (
                          <span className="px-2 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full">
                            F: {Math.round(recipe.nutrition_per_serving.fat_g)}g
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-muted/20">
          <p className="text-xs text-center text-muted-foreground">
            {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
