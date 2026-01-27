/**
 * Meal Planning Sheet Component
 * 
 * Mobile-first bottom sheet for planning meals on a specific date
 * Integrates with dashboard calendar
 */

'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Loader2, Plus, Trash2, X, ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { RecipePickerSheet } from './recipe-picker-sheet'
import { savePlanMeal, removePlanMeal, deletePlan, getPlan, type PlanRecipeInfo } from '@/lib/actions/meal-planning'
import { formatPlanDateHeader } from '@/lib/utils/meal-planning'
import type { DailyPlan, RecipeRecord } from '@/lib/types/nutri'

interface MealPlanSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: Date | null
  recipes: RecipeRecord[]
  onPlanUpdated: () => void
}

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

const MEAL_TYPES: { key: MealType; label: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { key: 'lunch', label: 'Lunch', emoji: '🍱' },
  { key: 'dinner', label: 'Dinner', emoji: '🍽️' },
  { key: 'snacks', label: 'Snacks', emoji: '🍎' },
]

export function MealPlanSheet({ open, onOpenChange, date, recipes, onPlanUpdated }: MealPlanSheetProps) {
  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [planRecipes, setPlanRecipes] = useState<Record<string, PlanRecipeInfo>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [activeMealType, setActiveMealType] = useState<MealType | null>(null)
  const [swapMode, setSwapMode] = useState(false)

  // Fetch plan when date changes
  useEffect(() => {
    if (!open || !date) return

    const fetchPlan = async () => {
      setLoading(true)
      const dateStr = format(date, 'yyyy-MM-dd')
      const result = await getPlan(dateStr)
      
      if (result.success) {
        setPlan(result.data.plan)
        setPlanRecipes(result.data.recipes)
      } else {
        toast.error('Failed to load plan')
      }
      setLoading(false)
    }

    fetchPlan()
  }, [open, date])

  // Computed flags
  const isPast = date ? (new Date(format(date, 'yyyy-MM-dd')) < new Date(format(new Date(), 'yyyy-MM-dd'))) : false
  const isReadOnly = isPast


  const handleAddRecipe = (mealType: MealType, replace = false) => {
    if (isReadOnly) {
      toast('This plan is read-only')
      return
    }
    setActiveMealType(mealType)
    setSwapMode(replace)
    setPickerOpen(true)
  }

  const handleRecipeSelected = async (recipeId: string) => {
    if (!date || !activeMealType) return

    setSaving(true)
    const dateStr = format(date, 'yyyy-MM-dd')
    const result = await savePlanMeal({
      date: dateStr,
      mealType: activeMealType,
      recipeId,
    })

    if (result.success) {
      // Refresh plan
      const updated = await getPlan(dateStr)
      
      if (updated.success) {
        setPlan(updated.data.plan)
        setPlanRecipes(updated.data.recipes)
      }

      toast.success(swapMode ? 'Meal replaced in plan' : 'Meal added to plan')
      
      // Notify parent to refresh week indicators
      onPlanUpdated()
    } else {
      toast.error(result.error)
    }

    setSaving(false)
    setPickerOpen(false)
    setActiveMealType(null)
    setSwapMode(false)
  }

  const handleRemoveRecipe = async (mealType: MealType) => {
    if (!date) return

    setSaving(true)
    const dateStr = format(date, 'yyyy-MM-dd')
    const result = await removePlanMeal({
      date: dateStr,
      mealType,
    })

    if (result.success) {
      // Refresh plan
      const updated = await getPlan(dateStr)
      if (updated.success) {
        setPlan(updated.data.plan)
        setPlanRecipes(updated.data.recipes)
      }
      toast.success('Meal removed from plan')
      onPlanUpdated()
    } else {
      toast.error(result.error)
    }

    setSaving(false)
  }

  const handleClearAll = async () => {
    if (isReadOnly) {
      toast('This plan is read-only')
      return
    }

    if (!date || !plan) return

    const confirmed = confirm('Are you sure you want to clear all meals from this plan?')
    if (!confirmed) return

    setSaving(true)
    const dateStr = format(date, 'yyyy-MM-dd')
    const result = await deletePlan(dateStr)

    if (result.success) {
      setPlan(null)
      toast.success('Plan cleared')
      onPlanUpdated()
    } else {
      toast.error(result.error)
    }

    setSaving(false)
  }

  // Get recipe for a meal slot
  // First checks planRecipes (fetched from DB with the plan), then falls back to props
  const getRecipeForMeal = (mealType: MealType): RecipeRecord | PlanRecipeInfo | null => {
    if (!plan) return null

    let recipeId: string | undefined

    if (mealType === 'snacks') {
      recipeId = plan.snacks?.[0]?.recipe_id
    } else {
      recipeId = plan[mealType]?.recipe_id
    }

    if (!recipeId) return null

    // First check planRecipes (from DB - includes admin-set recipes)
    if (planRecipes[recipeId]) {
      return planRecipes[recipeId]
    }

    // Fall back to props (user's personalized recipes)
    return recipes.find(r => r.id === recipeId) || null
  }

  // Check if plan has any meals
  const hasMeals = !!(
    plan?.breakfast?.recipe_id ||
    plan?.lunch?.recipe_id ||
    plan?.dinner?.recipe_id ||
    (plan?.snacks && plan.snacks[0]?.recipe_id)
  )

  if (!date) return null

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side="bottom" 
          className="h-[75vh] max-h-[75vh] rounded-t-xl flex flex-col overflow-hidden"
        >
          <SheetHeader className="flex-shrink-0 border-b border-border px-4 py-3 sm:px-6 sm:py-4 space-y-1">
            <div className="flex items-start gap-2 pr-10">
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-sm leading-snug sm:text-lg sm:leading-tight">
                  Plan Meals for {formatPlanDateHeader(date)}
                </SheetTitle>
                <SheetDescription className="text-xs leading-snug sm:text-sm mt-1">
                  Select recipes for each meal (1 serving each)
                </SheetDescription>
              </div>
              {hasMeals && !saving && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-6 w-6 p-0 flex-shrink-0"
                  aria-label="Clear all meals"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              MEAL_TYPES.map(({ key, label, emoji }) => {
                const recipe = getRecipeForMeal(key)

                return (
                  <div
                    key={key}
                    className="border border-border rounded-xl p-3 sm:p-4 bg-card"
                  >
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <h3 className="text-base sm:text-lg font-semibold flex items-center gap-1.5 sm:gap-2">
                        <span className="text-lg sm:text-xl">{emoji}</span>
                        <span>{label}</span>
                      </h3>
                      {recipe && !isReadOnly && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddRecipe(key, true)}
                          disabled={saving}
                          className="h-7 px-2 sm:px-3 py-1 flex items-center gap-2"
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                          <span className="hidden sm:inline">Exchange</span>
                        </Button>
                      )}

                      {isReadOnly && recipe && (
                        <span className="text-xs text-muted-foreground">Read-only</span>
                      )}
                    </div>

                    {recipe ? (
                      <div className="flex items-start gap-2 sm:gap-3">
                        {recipe.image_url && (
                          <img
                            src={recipe.image_url}
                            alt={recipe.name}
                            crossOrigin="anonymous"
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm sm:text-base line-clamp-2 leading-tight">{recipe.name}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                            {(recipe as any).scaled_calories || recipe.nutrition_per_serving?.calories} kcal • 1 serving
                          </p>
                        </div>
                      </div>
                    ) : (
                      !isReadOnly ? (
                        <Button
                          variant="outline"
                          className="w-full h-auto py-2.5 sm:py-3 border-dashed hover:border-primary hover:bg-primary/5 text-sm sm:text-base"
                          onClick={() => handleAddRecipe(key)}
                          disabled={saving}
                        >
                          <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" />
                          Add Recipe
                        </Button>
                      ) : (
                        <div className="w-full py-2 text-xs text-muted-foreground text-center">Read-only</div>
                      )
                    )}
                  </div>
                )
              })
            )}
          </div>

          {saving && (
            <div className="p-4 border-t border-border bg-muted/50">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <RecipePickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        recipes={recipes}
        mealType={activeMealType}
        onRecipeSelected={handleRecipeSelected}
      />
    </>
  )
}
