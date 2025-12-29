'use client'

import { useState, useTransition } from 'react'
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns'
import { 
  ShoppingCart, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Trash2,
  Download,
  Share2,
  Calendar,
  CheckCircle2,
  Circle,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  generateShoppingList, 
  toggleShoppingListItem, 
  deleteShoppingList,
  getShoppingList,
  getWeekPlanCount 
} from '@/lib/actions/shopping-lists'
import type { ShoppingListRecord, ShoppingListItems } from '@/lib/types/nutri'
import { cn } from '@/lib/utils'

interface ShoppingListContentProps {
  initialShoppingList: ShoppingListRecord | null
  initialPlanCount: number
}

// Food group emojis for better UX
const FOOD_GROUP_ICONS: Record<string, string> = {
  'Proteins': '🥩',
  'Grains & Carbs': '🌾',
  'Vegetables': '🥬',
  'Fruits': '🍎',
  'Dairy': '🥛',
  'Fats & Oils': '🫒',
  'Nuts & Seeds': '🥜',
  'Legumes': '🫘',
  'Beverages': '☕',
  'Condiments & Sauces': '🧂',
  'Supplements': '💊',
  'Uncategorized': '📦'
}

export function ShoppingListContent({ 
  initialShoppingList,
  initialPlanCount 
}: ShoppingListContentProps) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [shoppingList, setShoppingList] = useState<ShoppingListRecord | null>(initialShoppingList)
  const [planCount, setPlanCount] = useState(initialPlanCount)
  const [isPending, startTransition] = useTransition()
  const [isGenerating, setIsGenerating] = useState(false)

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekEnd = addWeeks(weekStart, 1)

  const handlePreviousWeek = () => {
    const newDate = subWeeks(selectedDate, 1)
    setSelectedDate(newDate)
    loadWeekData(newDate)
  }

  const handleNextWeek = () => {
    const newDate = addWeeks(selectedDate, 1)
    setSelectedDate(newDate)
    loadWeekData(newDate)
  }

  const loadWeekData = async (date: Date) => {
    startTransition(async () => {
      const [listResult, countResult] = await Promise.all([
        getShoppingList(date),
        getWeekPlanCount(date)
      ])

      if (listResult.success) {
        setShoppingList(listResult.data)
      }
      if (countResult.success) {
        setPlanCount(countResult.data)
      }
    })
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    const result = await generateShoppingList(selectedDate)
    setIsGenerating(false)

    if (result.success) {
      setShoppingList(result.data)
      toast.success('Shopping list generated successfully!')
    } else {
      toast.error(result.error || 'Failed to generate shopping list')
    }
  }

  const handleToggleItem = async (ingredientId: string, currentlyChecked: boolean) => {
    if (!shoppingList) return

    // Optimistic update
    const newCheckedItems = currentlyChecked
      ? shoppingList.checked_items.filter(id => id !== ingredientId)
      : [...shoppingList.checked_items, ingredientId]

    setShoppingList({
      ...shoppingList,
      checked_items: newCheckedItems
    })

    const result = await toggleShoppingListItem(shoppingList.id, ingredientId, !currentlyChecked)

    if (!result.success) {
      // Revert on error
      setShoppingList(shoppingList)
      toast.error('Failed to update item')
    }
  }

  const handleDelete = async () => {
    if (!shoppingList) return

    if (!confirm('Are you sure you want to delete this shopping list?')) {
      return
    }

    const result = await deleteShoppingList(shoppingList.id)

    if (result.success) {
      setShoppingList(null)
      toast.success('Shopping list deleted')
    } else {
      toast.error('Failed to delete shopping list')
    }
  }

  const handleExport = () => {
    if (!shoppingList) return

    const items = shoppingList.items as ShoppingListItems
    let text = `Shopping List - Week of ${format(weekStart, 'MMM d, yyyy')}\n\n`

    for (const [group, groupItems] of Object.entries(items)) {
      text += `${FOOD_GROUP_ICONS[group] || '📦'} ${group}\n`
      for (const item of groupItems) {
        const checked = shoppingList.checked_items.includes(item.ingredient_id) ? '✓' : '○'
        text += `  ${checked} ${item.ingredient_name} - ${item.total_quantity}${item.unit}\n`
      }
      text += '\n'
    }

    // Copy to clipboard
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const handleShare = async () => {
    if (!shoppingList) return

    const items = shoppingList.items as ShoppingListItems
    let text = `Shopping List - Week of ${format(weekStart, 'MMM d, yyyy')}\n\n`

    for (const [group, groupItems] of Object.entries(items)) {
      text += `${FOOD_GROUP_ICONS[group] || '📦'} ${group}\n`
      for (const item of groupItems) {
        text += `  • ${item.ingredient_name} - ${item.total_quantity}${item.unit}\n`
      }
      text += '\n'
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Shopping List',
          text: text
        })
      } catch (err) {
        console.error('Share failed:', err)
      }
    } else {
      // Fallback to copy
      handleExport()
    }
  }

  const items = shoppingList ? (shoppingList.items as ShoppingListItems) : {}
  const totalItems = Object.values(items).reduce((sum, group) => sum + group.length, 0)
  const checkedCount = shoppingList ? shoppingList.checked_items.length : 0

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-8 w-8" />
            Shopping List
          </h1>
          <p className="text-muted-foreground mt-1">
            Your weekly grocery list from meal plans
          </p>
        </div>
      </div>

      {/* Week Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePreviousWeek}
              disabled={isPending}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-center">
              <div className="flex items-center gap-2 justify-center">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {format(weekStart, 'MMM d')} - {format(addWeeks(weekStart, 1), 'MMM d, yyyy')}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {planCount} day{planCount !== 1 ? 's' : ''} planned this week
              </div>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={handleNextWeek}
              disabled={isPending}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {planCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {!shoppingList ? (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              size="lg"
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Generate Shopping List
                </>
              )}
            </Button>
          ) : (
            <>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                variant="outline"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isGenerating && "animate-spin")} />
                Regenerate
              </Button>
              <Button
                onClick={handleExport}
                variant="outline"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                onClick={handleShare}
                variant="outline"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button
                onClick={handleDelete}
                variant="outline"
                className="ml-auto text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </>
          )}
        </div>
      )}

      {/* Shopping List Content */}
      {planCount === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Meal Plans This Week</h3>
            <p className="text-muted-foreground mb-4">
              You need to have meal plans for this week to generate a shopping list.
            </p>
            <Button asChild>
              <a href="/dashboard">Go to Dashboard</a>
            </Button>
          </CardContent>
        </Card>
      ) : !shoppingList ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ready to Shop?</h3>
            <p className="text-muted-foreground mb-4">
              Generate your shopping list from this week's meal plans.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Progress */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    {checkedCount} / {totalItems}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Items purchased
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Complete
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-2 mt-4">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Grouped Items */}
          <div className="space-y-4">
            {Object.entries(items).sort(([a], [b]) => a.localeCompare(b)).map(([group, groupItems]) => {
              const groupCheckedCount = groupItems.filter(item => 
                shoppingList.checked_items.includes(item.ingredient_id)
              ).length

              return (
                <Card key={group}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl">{FOOD_GROUP_ICONS[group] || '📦'}</span>
                      <span>{group}</span>
                      <span className="text-sm font-normal text-muted-foreground ml-auto">
                        {groupCheckedCount} / {groupItems.length}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {groupItems.map((item) => {
                      const isChecked = shoppingList.checked_items.includes(item.ingredient_id)

                      return (
                        <button
                          key={item.ingredient_id}
                          onClick={() => handleToggleItem(item.ingredient_id, isChecked)}
                          className={cn(
                            "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors hover:bg-muted/50",
                            isChecked && "opacity-50"
                          )}
                        >
                          {isChecked ? (
                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className={cn(
                              "font-medium",
                              isChecked && "line-through"
                            )}>
                              {item.ingredient_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {item.total_quantity}{item.unit}
                            </div>
                            {item.used_in_recipes.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Used in: {item.used_in_recipes.join(', ')}
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
