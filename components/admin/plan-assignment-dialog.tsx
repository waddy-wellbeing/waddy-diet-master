'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  Calculator,
  Check,
} from 'lucide-react'
import { assignMealStructure, UserWithProfile } from '@/lib/actions/users'
import { MEAL_SLOT_OPTIONS, type MealSlot } from '@/lib/types/nutri'
import { cn } from '@/lib/utils'

interface PlanAssignmentDialogProps {
  user: UserWithProfile | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (userId: string, mealCount: number) => void
}

// Predefined templates
const mealTemplates = [
  {
    name: '3 Meals (Classic)',
    meals: [
      { name: 'breakfast', label: 'Breakfast', percentage: 0.25 },
      { name: 'lunch', label: 'Lunch', percentage: 0.40 },
      { name: 'dinner', label: 'Dinner', percentage: 0.35 },
    ],
  },
  {
    name: '3 Meals + 2 Snacks',
    meals: [
      { name: 'breakfast', label: 'Breakfast', percentage: 0.25 },
      { name: 'mid_morning', label: 'Mid-Morning', percentage: 0.10 },
      { name: 'lunch', label: 'Lunch', percentage: 0.30 },
      { name: 'afternoon', label: 'Afternoon', percentage: 0.10 },
      { name: 'dinner', label: 'Dinner', percentage: 0.25 },
    ],
  },
  {
    name: '5 Equal Meals',
    meals: [
      { name: 'breakfast', label: 'Breakfast', percentage: 0.20 },
      { name: 'mid_morning', label: 'Mid-Morning', percentage: 0.20 },
      { name: 'lunch', label: 'Lunch', percentage: 0.20 },
      { name: 'afternoon', label: 'Afternoon', percentage: 0.20 },
      { name: 'dinner', label: 'Dinner', percentage: 0.20 },
    ],
  },
  {
    name: '6 Small Meals',
    meals: [
      { name: 'breakfast', label: 'Breakfast', percentage: 0.18 },
      { name: 'mid_morning', label: 'Mid-Morning', percentage: 0.14 },
      { name: 'lunch', label: 'Lunch', percentage: 0.20 },
      { name: 'afternoon', label: 'Afternoon', percentage: 0.14 },
      { name: 'dinner', label: 'Dinner', percentage: 0.20 },
      { name: 'evening', label: 'Evening', percentage: 0.14 },
    ],
  },
  {
    name: 'Intermittent Fasting (2 Meals)',
    meals: [
      { name: 'lunch', label: 'Lunch', percentage: 0.50 },
      { name: 'dinner', label: 'Dinner', percentage: 0.50 },
    ],
  },
]

export function PlanAssignmentDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: PlanAssignmentDialogProps) {
  const [meals, setMeals] = useState<MealSlot[]>([])
  const [dailyCalories, setDailyCalories] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize from user data when dialog opens
  useEffect(() => {
    if (user && open) {
      const existingStructure = user.profile?.preferences?.meal_structure
      if (existingStructure && existingStructure.length > 0) {
        setMeals(existingStructure)
      } else {
        // Default based on user's requested meal count
        const requestedMeals = user.profile?.preferences?.meals_per_day || 3
        const template = mealTemplates.find(t => t.meals.length === requestedMeals) || mealTemplates[0]
        setMeals(template.meals)
      }
      setDailyCalories(user.profile?.targets?.daily_calories || user.profile?.targets?.tdee || 2000)
      setError(null)
    }
  }, [user, open])

  // Calculate total percentage
  const totalPercentage = meals.reduce((sum, m) => sum + m.percentage, 0)
  const isValidPercentage = Math.abs(totalPercentage - 1.0) < 0.01

  function applyTemplate(template: typeof mealTemplates[0]) {
    setMeals(template.meals)
  }

  function addMeal() {
    // Find an unused meal slot
    const usedNames = meals.map(m => m.name)
    const available = MEAL_SLOT_OPTIONS.find(opt => !usedNames.includes(opt.value))
    
    if (available) {
      setMeals([...meals, {
        name: available.value,
        label: available.label,
        percentage: 0,
      }])
    }
  }

  function removeMeal(index: number) {
    if (meals.length > 1) {
      setMeals(meals.filter((_, i) => i !== index))
    }
  }

  function updateMeal(index: number, field: keyof MealSlot, value: string | number) {
    setMeals(meals.map((m, i) => {
      if (i !== index) return m
      if (field === 'name') {
        const option = MEAL_SLOT_OPTIONS.find(opt => opt.value === value)
        return { ...m, name: value as string, label: option?.label || value as string }
      }
      if (field === 'percentage') {
        return { ...m, percentage: Math.min(1, Math.max(0, Number(value))) }
      }
      return { ...m, [field]: value }
    }))
  }

  function distributeEvenly() {
    const evenPercentage = 1 / meals.length
    setMeals(meals.map(m => ({ ...m, percentage: evenPercentage })))
  }

  async function handleSubmit() {
    if (!user || !isValidPercentage) return

    setIsSubmitting(true)
    setError(null)

    const result = await assignMealStructure(user.id, meals, dailyCalories)

    if (!result.success) {
      setError(result.error || 'Failed to assign meal plan')
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    onSuccess(user.id, meals.length)
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Meal Plan</DialogTitle>
          <DialogDescription>
            Configure the meal structure for{' '}
            <span className="font-medium">{user.profile?.basic_info?.name || 'this user'}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* User Info Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Weight</p>
              <p className="font-medium">
                {user.profile?.basic_info?.weight_kg 
                  ? `${user.profile.basic_info.weight_kg} kg` 
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Height</p>
              <p className="font-medium">
                {user.profile?.basic_info?.height_cm 
                  ? `${user.profile.basic_info.height_cm} cm` 
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Activity</p>
              <p className="font-medium capitalize">
                {user.profile?.basic_info?.activity_level?.replace('_', ' ') || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Goal</p>
              <p className="font-medium capitalize">
                {user.profile?.goals?.goal_type?.replace('_', ' ') || '-'}
              </p>
            </div>
          </div>

          {/* Daily Calories */}
          <div className="space-y-2">
            <Label htmlFor="calories">Daily Calories Target</Label>
            <div className="flex gap-2">
              <Input
                id="calories"
                type="number"
                value={dailyCalories}
                onChange={(e) => setDailyCalories(Number(e.target.value))}
                className="max-w-32"
              />
              <span className="text-sm text-muted-foreground self-center">cal/day</span>
              {user.profile?.targets?.tdee && (
                <Badge variant="outline" className="ml-auto">
                  TDEE: {user.profile.targets.tdee} cal
                </Badge>
              )}
            </div>
          </div>

          {/* Quick Templates */}
          <div className="space-y-2">
            <Label>Quick Templates</Label>
            <div className="flex flex-wrap gap-2">
              {mealTemplates.map((template) => (
                <Button
                  key={template.name}
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(template)}
                  className={cn(
                    meals.length === template.meals.length && 
                    meals.every((m, i) => m.name === template.meals[i].name) &&
                    'border-primary'
                  )}
                >
                  {template.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Meal Structure */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Meal Structure</Label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={distributeEvenly}
                  className="text-xs"
                >
                  <Calculator className="h-3 w-3 mr-1" />
                  Distribute Evenly
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addMeal}
                  disabled={meals.length >= MEAL_SLOT_OPTIONS.length}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {meals.map((meal, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-3 p-3 border rounded-lg bg-background"
                >
                  <Select
                    value={meal.name}
                    onValueChange={(v) => updateMeal(index, 'name', v)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEAL_SLOT_OPTIONS.map((opt) => (
                        <SelectItem 
                          key={opt.value} 
                          value={opt.value}
                          disabled={meals.some((m, i) => i !== index && m.name === opt.value)}
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        value={Math.round(meal.percentage * 100)}
                        onChange={(e) => updateMeal(index, 'percentage', Number(e.target.value) / 100)}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                      
                      {/* Visual bar */}
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${meal.percentage * 100}%` }}
                        />
                      </div>

                      <span className="text-sm font-medium w-20 text-right">
                        {dailyCalories ? Math.round(dailyCalories * meal.percentage) : 0} cal
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMeal(index)}
                    disabled={meals.length <= 1}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className={cn(
              "flex items-center justify-between p-3 rounded-lg border-2",
              isValidPercentage 
                ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950" 
                : "border-destructive/50 bg-destructive/10"
            )}>
              <span className="font-medium">Total</span>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-bold",
                  isValidPercentage ? "text-green-600 dark:text-green-400" : "text-destructive"
                )}>
                  {Math.round(totalPercentage * 100)}%
                </span>
                {isValidPercentage ? (
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm text-muted-foreground ml-2">
                  = {dailyCalories} cal
                </span>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !isValidPercentage}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Assign Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
