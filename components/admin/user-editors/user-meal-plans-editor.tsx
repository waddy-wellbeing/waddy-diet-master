"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  AlertCircle,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { getUserPlans, assignSuggestedPlansForUser, type AdminUserPlan } from "@/lib/actions/admin-plans"
import type { UserWithProfile } from "@/lib/actions/users"

interface UserMealPlansEditorProps {
  user: UserWithProfile
  onUpdate?: (user: UserWithProfile) => void
}

// Meal emoji mapping for regular and fasting modes
const MEAL_EMOJI: Record<string, string> = {
  breakfast: "🌅",
  lunch: "🍽️",
  dinner: "🌙",
  snacks: "🍪",
  "pre-iftar": "🥤",
  iftar: "🕌",
  "full-meal-taraweeh": "🕯️",
  "snack-taraweeh": "🍪",
  suhoor: "⏰",
}

// Meal labels - matching exactly what users see in dashboard
const MEAL_LABELS: Record<string, string> = {
  // Regular meal labels (English - shown when not in Ramadan mode)
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
  // Fasting meal labels (Arabic - matching dashboard when Ramadan is enabled)
  "pre-iftar": "كسر صيام",
  "iftar": "إفطار",
  "full-meal-taraweeh": "وجبة بعد التراويح",
  "snack-taraweeh": "سناك بعد التراويح",
  "suhoor": "سحور",
}

const FASTING_MEAL_ORDER = [
  "pre-iftar",
  "iftar",
  "full-meal-taraweeh",
  "snack-taraweeh",
  "suhoor",
]

interface PlanData {
  plans: AdminUserPlan[]
  recipes: Record<string, any>
  isFastingMode: boolean
  fastingSelectedMeals: string[]
  dailyCalories: number
  targets: any
}

export function UserMealPlansEditor({ user, onUpdate }: UserMealPlansEditorProps) {
  const [planData, setPlanData] = useState<PlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [daysToAssign, setDaysToAssign] = useState(7)
  const [overwriteExisting, setOverwriteExisting] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  )

  const loadPlans = async () => {
    setLoading(true)
    setError(null)
    const result = await getUserPlans(user.id, 30, 30)
    if (result.success && result.data) {
      setPlanData({
        plans: result.data.plans,
        recipes: result.data.recipes,
        isFastingMode: result.data.isFastingMode,
        fastingSelectedMeals: result.data.fastingSelectedMeals,
        dailyCalories: result.data.dailyCalories,
        targets: result.data.targets,
      })
    } else {
      setError(result.error || "Failed to load meal plans")
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPlans()
  }, [user.id])

  const handleAssignSuggestions = async () => {
    setAssigning(true)

    const safeDays = Math.min(Math.max(daysToAssign || 7, 3), 14)
    const result = await assignSuggestedPlansForUser({
      userId: user.id,
      days: safeDays,
      overwriteExisting,
    })

    if (!result.success) {
      toast.error(result.error || "Failed to assign suggested plans")
      setAssigning(false)
      return
    }

    const assigned = result.data?.assignedDays || 0
    const skipped = result.data?.skippedDays || 0
    toast.success(`Assigned ${assigned} day(s)${skipped > 0 ? `, skipped ${skipped}` : ""}`)

    await loadPlans()
    setAssigning(false)
  }

  if (loading) {
    return <MealPlansLoadingSkeleton />
  }

  if (error) {
    return (
      <Card className="border-destructive/40 bg-destructive/10">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!planData) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No meal planning data available
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Meal Plans Calendar</h3>
        <p className="text-sm text-muted-foreground">
          {planData.isFastingMode && "🌙 "}
          View and manage user's meal plans
          {planData.isFastingMode && " (Ramadan Mode)"}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assign Suggested Plan</CardTitle>
          <CardDescription>
            Default is 7 days. Admin can change to 3-14 days.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-40">
              <p className="mb-1 text-xs text-muted-foreground">Days</p>
              <Input
                type="number"
                min={3}
                max={14}
                value={daysToAssign}
                onChange={(e) => setDaysToAssign(Number(e.target.value || 7))}
              />
            </div>
            <Button
              onClick={handleAssignSuggestions}
              disabled={assigning}
              className="sm:min-w-[220px]"
            >
              {assigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Assign Suggested Meals
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={overwriteExisting}
              onChange={(e) => setOverwriteExisting(e.target.checked)}
            />
            Overwrite existing plans in this range
          </label>
        </CardContent>
      </Card>

      {/* Date Navigator */}
      <DateNavigator
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        plans={planData.plans}
      />

      {/* Meal Plan for Selected Date */}
      <MealPlanDayView
        date={selectedDate}
        plans={planData.plans}
        recipes={planData.recipes}
        isFastingMode={planData.isFastingMode}
        fastingSelectedMeals={planData.fastingSelectedMeals}
        dailyCalories={planData.dailyCalories}
        targets={planData.targets}
      />

      {/* Plan Summary Stats */}
      <PlannedDaysSummary
        plans={planData.plans}
        isFastingMode={planData.isFastingMode}
      />
    </div>
  )
}

function DateNavigator({
  selectedDate,
  onDateChange,
  plans,
}: {
  selectedDate: string
  onDateChange: (date: string) => void
  plans: AdminUserPlan[]
}) {
  const dateInputRef = useRef<HTMLInputElement | null>(null)
  const plannedDates = new Set(plans.map((p) => p.plan_date))
  const selected = new Date(selectedDate)

  const toLocalDateString = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const addDays = (date: Date, amount: number): Date => {
    const updated = new Date(date)
    updated.setDate(updated.getDate() + amount)
    return updated
  }

  const formatDayChip = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  const previousDate = addDays(selected, -1)
  const nextDate = addDays(selected, 1)
  const previousDateStr = toLocalDateString(previousDate)
  const nextDateStr = toLocalDateString(nextDate)

  const goToPreviousDay = () => {
    onDateChange(previousDateStr)
  }

  const goToNextDay = () => {
    onDateChange(nextDateStr)
  }

  const openDatePicker = () => {
    if (!dateInputRef.current) return
    const inputEl = dateInputRef.current as HTMLInputElement & {
      showPicker?: () => void
    }
    if (typeof inputEl.showPicker === "function") {
      inputEl.showPicker()
      return
    }
    inputEl.focus()
    inputEl.click()
  }

  const hasPlanned =
    plannedDates.has(selectedDate) &&
    plans.some((p) => p.plan_date === selectedDate)

  const hasPlannedPrev = plannedDates.has(previousDateStr)
  const hasPlannedNext = plannedDates.has(nextDateStr)

  return (
    <Card className="bg-muted/50">
      <CardContent className="pt-6">
        <input
          ref={dateInputRef}
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="sr-only"
          aria-label="Choose date"
        />

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousDay}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Button
                variant="outline"
                className="h-auto justify-start px-3 py-2 text-left"
                onClick={() => onDateChange(previousDateStr)}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{formatDayChip(previousDate)}</span>
                  {hasPlannedPrev && <Badge className="text-[10px]">Planned</Badge>}
                </div>
              </Button>

              <div className="rounded-md border bg-background px-3 py-2">
                <div className="flex items-center justify-center gap-2 text-center">
                  <span className="font-semibold">
                    {new Date(selectedDate).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  {selectedDate === toLocalDateString(new Date()) && (
                    <Badge variant="secondary" className="text-xs">
                      Today
                    </Badge>
                  )}
                  {hasPlanned && (
                    <Badge className="text-xs">
                      ✓ Planned
                    </Badge>
                  )}
                </div>
              </div>

              <Button
                variant="outline"
                className="h-auto justify-end px-3 py-2 text-right"
                onClick={() => onDateChange(nextDateStr)}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  {hasPlannedNext && <Badge className="text-[10px]">Planned</Badge>}
                  <span className="text-sm text-muted-foreground">{formatDayChip(nextDate)}</span>
                </div>
              </Button>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={openDatePicker}
            className="h-8 w-8 p-0"
            aria-label="Open date picker"
          >
            <Calendar className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={goToNextDay}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function MealPlanDayView({
  date,
  plans,
  recipes,
  isFastingMode,
  fastingSelectedMeals,
  dailyCalories,
  targets,
}: {
  date: string
  plans: AdminUserPlan[]
  recipes: Record<string, any>
  isFastingMode: boolean
  fastingSelectedMeals: string[]
  dailyCalories: number
  targets: any
}) {
  const dayPlan = plans.find((p) => p.plan_date === date)

  if (!dayPlan) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-center text-muted-foreground">
          <Plus className="mx-auto mb-2 h-5 w-5 opacity-50" />
          No meal plan for this date
        </CardContent>
      </Card>
    )
  }

  // Determine meal order based on mode
  const mealSlots = isFastingMode
    ? (fastingSelectedMeals && fastingSelectedMeals.length > 0
        ? fastingSelectedMeals.sort(
            (a, b) =>
              FASTING_MEAL_ORDER.indexOf(a) -
              FASTING_MEAL_ORDER.indexOf(b)
          )
        : FASTING_MEAL_ORDER)
    : ["breakfast", "lunch", "dinner", "snacks"]

  // Get meals from plan or fasting_plan
  const getMealData = (mealType: string): { recipe_id?: string; servings?: number } | null => {
    const plan = dayPlan.plan as Record<string, any>
    const fastingPlan = dayPlan.fasting_plan as Record<string, any>

    if (isFastingMode && fastingPlan) {
      return fastingPlan[mealType] || null
    } else if (!isFastingMode && plan) {
      if (mealType === "snacks" && Array.isArray(plan.snacks)) {
        return plan.snacks[0] || null
      }
      return plan[mealType] || null
    }
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">Daily Meals</CardTitle>
            <CardDescription className="text-xs">
              {dailyCalories ? `${dailyCalories} kcal target` : "No calorie target set"}
            </CardDescription>
          </div>
          {isFastingMode && (
            <Badge className="ml-2">🌙 Ramadan</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {mealSlots.map((mealType) => {
          const mealData = getMealData(mealType)
          const recipe = mealData?.recipe_id ? recipes[mealData.recipe_id] : null
          const servings = mealData?.servings ?? 1

          return (
            <div key={mealType} className="flex items-start gap-3 rounded-lg border p-3">
              <div className="text-2xl">{MEAL_EMOJI[mealType] || "🍽️"}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {MEAL_LABELS[mealType]}
                </p>
                {recipe ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-start gap-2">
                      {recipe.image_url && (
                        <div className="relative h-12 w-12 flex-shrink-0 rounded overflow-hidden">
                          <Image
                            src={recipe.image_url}
                            alt={recipe.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {recipe.name}
                        </p>
                        {mealData?.servings && (
                          <p className="text-xs text-muted-foreground">
                            {mealData.servings} serving{mealData.servings !== 1 ? "s" : ""}
                          </p>
                        )}
                        {recipe.nutrition_per_serving?.calories && (
                          <p className="text-xs text-muted-foreground">
                            {Math.round(
                              recipe.nutrition_per_serving.calories *
                                servings
                            )}{" "}
                            kcal
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    No meal assigned
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function PlannedDaysSummary({
  plans,
  isFastingMode,
}: {
  plans: AdminUserPlan[]
  isFastingMode: boolean
}) {
  const plannedDates = new Set(plans.map((p) => p.plan_date))
  const now = new Date()
  const futureCount = plans.filter(
    (p) => new Date(p.plan_date) >= now
  ).length

  return (
    <Card className="bg-muted/50">
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Planned Days</p>
            <p className="text-2xl font-bold">{plannedDates.size}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Upcoming Plans</p>
            <p className="text-2xl font-bold">{futureCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MealPlansLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Meal Plans Calendar</h3>
        <p className="text-sm text-muted-foreground">
          Loading meal plans...
        </p>
      </div>

      {/* Date Navigator Skeleton */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-6 flex-1 max-w-xs" />
            <Skeleton className="h-8 w-8" />
          </div>
        </CardContent>
      </Card>

      {/* Meals Skeleton */}
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
              <Skeleton className="h-8 w-8 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Summary Skeleton */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
