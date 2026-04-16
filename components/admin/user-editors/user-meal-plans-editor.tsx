"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pill,
  Plus,
  AlertCircle,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  getUserPlans,
  assignSuggestedPlansForUser,
  getScaledRecipesForMeal,
  updateUserMeal,
  updateMealSupplements,
  type AdminUserPlan,
} from "@/lib/actions/admin-plans"
import { assignMealStructure } from "@/lib/actions/users"
import {
  getSnackIndexForSlotName,
  isCoreRegularMealSlot,
} from "@/lib/utils/regular-meal-structure"
import type { UserWithProfile } from "@/lib/actions/users"
import type { MealSlot, MealSupplement, SupplementTiming } from "@/lib/types/nutri"

interface UserMealPlansEditorProps {
  user: UserWithProfile
  onUpdate?: (user: UserWithProfile) => void
}

interface EditableMealSlot extends MealSlot {
  tempId: number
}

interface SuggestedRecipe {
  id: string
  name: string
  image_url: string | null
  scale_factor: number
  scaled_calories: number
  macro_similarity_score: number
}

// Meal emoji mapping for regular and fasting modes
const MEAL_EMOJI: Record<string, string> = {
  breakfast: "\u{1F305}",
  lunch: "\u{1F37D}\uFE0F",
  dinner: "\u{1F319}",
  snacks: "\u{1F36A}",
  "pre-iftar": "\u{1F964}",
  iftar: "\u{1F54C}",
  "full-meal-taraweeh": "\u{1F56F}\uFE0F",
  "snack-taraweeh": "\u{1F36A}",
  suhoor: "\u23F0",
}

// Meal labels
const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
  "pre-iftar": "\u0643\u0633\u0631 \u0635\u064A\u0627\u0645",
  "iftar": "\u0625\u0641\u0637\u0627\u0631",
  "full-meal-taraweeh": "\u0648\u062C\u0628\u0629 \u0628\u0639\u062F \u0627\u0644\u062A\u0631\u0627\u0648\u064A\u062D",
  "snack-taraweeh": "\u0633\u0646\u0627\u0643 \u0628\u0639\u062F \u0627\u0644\u062A\u0631\u0627\u0648\u064A\u062D",
  "suhoor": "\u0633\u062D\u0648\u0631",
}

const FASTING_MEAL_ORDER = [
  "pre-iftar",
  "iftar",
  "full-meal-taraweeh",
  "snack-taraweeh",
  "suhoor",
]

const DEFAULT_STRUCTURES: Record<string, Omit<MealSlot, "target_calories">[]> = {
  "3-meals": [
    { name: "breakfast", label: "Breakfast", percentage: 25 },
    { name: "lunch", label: "Lunch", percentage: 40 },
    { name: "dinner", label: "Dinner", percentage: 35 },
  ],
  "3-meals-snack": [
    { name: "breakfast", label: "Breakfast", percentage: 25 },
    { name: "lunch", label: "Lunch", percentage: 35 },
    { name: "afternoon", label: "Afternoon Snack", percentage: 10 },
    { name: "dinner", label: "Dinner", percentage: 30 },
  ],
  "4-meals": [
    { name: "breakfast", label: "Breakfast", percentage: 20 },
    { name: "mid_morning", label: "Mid-Morning Snack", percentage: 15 },
    { name: "lunch", label: "Lunch", percentage: 30 },
    { name: "dinner", label: "Dinner", percentage: 35 },
  ],
  "5-meals": [
    { name: "breakfast", label: "Breakfast", percentage: 20 },
    { name: "mid_morning", label: "Mid-Morning Snack", percentage: 10 },
    { name: "lunch", label: "Lunch", percentage: 30 },
    { name: "afternoon", label: "Afternoon Snack", percentage: 10 },
    { name: "dinner", label: "Dinner", percentage: 30 },
  ],
}

const MEAL_OPTIONS = [
  { value: "breakfast", label: "Breakfast" },
  { value: "mid_morning", label: "Mid-Morning Snack" },
  { value: "lunch", label: "Lunch" },
  { value: "afternoon", label: "Afternoon Snack" },
  { value: "dinner", label: "Dinner" },
  { value: "evening", label: "Evening Snack" },
]

interface PlanData {
  plans: AdminUserPlan[]
  recipes: Record<string, any>
  isFastingMode: boolean
  fastingSelectedMeals: string[]
  dailyCalories: number
  targets: any
}

function normalizeStructure(structure: MealSlot[] = []): MealSlot[] {
  const total = structure.reduce((sum, meal) => sum + (meal.percentage || 0), 0)
  if (total > 0 && total <= 1.5) {
    return structure.map((meal) => ({ ...meal, percentage: meal.percentage * 100 }))
  }
  return structure
}

function getInitialStructure(user: UserWithProfile): EditableMealSlot[] {
  const existingStructure = user.profile?.preferences?.meal_structure
  const requestedMeals = user.profile?.preferences?.meals_per_day || 3
  const initialStructure = existingStructure
    ? normalizeStructure(existingStructure)
    : requestedMeals === 4
      ? DEFAULT_STRUCTURES["4-meals"]
      : requestedMeals === 5
        ? DEFAULT_STRUCTURES["5-meals"]
        : DEFAULT_STRUCTURES["3-meals"]

  return initialStructure.map((slot, idx) => ({
    ...slot,
    tempId: idx,
  }))
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
  const [mealSlots, setMealSlots] = useState<EditableMealSlot[]>(getInitialStructure(user))
  const [savingStructure, setSavingStructure] = useState(false)
  const [savingStructureSuccess, setSavingStructureSuccess] = useState(false)
  const [suggestionsByMeal, setSuggestionsByMeal] = useState<Record<string, SuggestedRecipe[]>>({})
  const [loadingSuggestionsMeal, setLoadingSuggestionsMeal] = useState<string | null>(null)
  const [assigningMealKey, setAssigningMealKey] = useState<string | null>(null)
  const [expandedSupplements, setExpandedSupplements] = useState<Record<string, boolean>>({})
  const [supplementEdits, setSupplementEdits] = useState<Record<string, MealSupplement[]>>({})
  const [savingSupplementsMeal, setSavingSupplementsMeal] = useState<string | null>(null)

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

  useEffect(() => {
    setMealSlots(getInitialStructure(user))
  }, [user.id, user.profile?.preferences?.meal_structure, user.profile?.preferences?.meals_per_day])

  const totalPercentage = mealSlots.reduce((sum, slot) => sum + (slot.percentage || 0), 0)
  const isStructureValid = totalPercentage === 100

  const handlePercentageChange = (index: number, value: string) => {
    const next = [...mealSlots]
    next[index] = { ...next[index], percentage: parseInt(value, 10) || 0 }
    setMealSlots(next)
  }

  const handleNameChange = (index: number, value: string) => {
    const option = MEAL_OPTIONS.find((o) => o.value === value)
    const next = [...mealSlots]
    next[index] = { ...next[index], name: value, label: option?.label }
    setMealSlots(next)
  }

  const applyPreset = (preset: string) => {
    const structure = DEFAULT_STRUCTURES[preset]
    if (!structure) return
    setMealSlots(
      structure.map((slot, idx) => ({
        ...slot,
        tempId: Date.now() + idx,
      }))
    )
  }

  const addSlot = () => {
    setMealSlots([
      ...mealSlots,
      {
        tempId: Date.now(),
        name: "afternoon",
        label: "Afternoon Snack",
        percentage: 0,
      },
    ])
  }

  const removeSlot = (index: number) => {
    if (mealSlots.length <= 2) return
    setMealSlots(mealSlots.filter((_, i) => i !== index))
  }

  const handleSaveStructure = async () => {
    if (!isStructureValid) return
    setSavingStructure(true)

    const cleanedSlots: MealSlot[] = mealSlots.map(({ name, label, percentage }) => ({
      name,
      label,
      percentage,
    }))

    const result = await assignMealStructure(user.id, cleanedSlots)
    setSavingStructure(false)

    if (!result.success) {
      toast.error(result.error || "Failed to save meal structure")
      return
    }

    setSavingStructureSuccess(true)
    setTimeout(() => setSavingStructureSuccess(false), 1800)

    onUpdate?.({
      ...user,
      profile: user.profile
        ? {
            ...user.profile,
            preferences: {
              ...user.profile.preferences,
              meals_per_day: cleanedSlots.length,
              meal_structure: cleanedSlots,
            },
          }
        : null,
    })

    toast.success("Meal distribution saved")
  }

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

  const handleLoadSuggestions = async (mealType: string) => {
    if (!planData) return
    setLoadingSuggestionsMeal(mealType)

    const result = await getScaledRecipesForMeal({
      userId: user.id,
      mealType,
      isFastingMode: planData.isFastingMode,
    })

    setLoadingSuggestionsMeal(null)

    if (!result.success || !result.data) {
      toast.error(result.error || "Failed to load suggested meals")
      return
    }

    const suggestions = result.data

    setSuggestionsByMeal((prev) => ({
      ...prev,
      [mealType]: suggestions.slice(0, 3).map((item) => ({
        id: item.id,
        name: item.name,
        image_url: item.image_url,
        scale_factor: item.scale_factor,
        scaled_calories: item.scaled_calories,
        macro_similarity_score: item.macro_similarity_score,
      })),
    }))
  }

  const handleQuickAssignMeal = async (mealType: string, recipeId: string) => {
    if (!planData) return
    const key = `${mealType}:${recipeId}`
    setAssigningMealKey(key)

    const snackIndex =
      !planData.isFastingMode && !isCoreRegularMealSlot(mealType)
        ? getSnackIndexForSlotName(mealType, mealSlots as MealSlot[])
        : undefined

    const result = await updateUserMeal({
      userId: user.id,
      planDate: selectedDate,
      mealType,
      recipeId,
      snackIndex: snackIndex !== undefined && snackIndex >= 0 ? snackIndex : undefined,
      isFastingMode: planData.isFastingMode,
    })

    setAssigningMealKey(null)

    if (!result.success) {
      toast.error(result.error || "Failed to assign meal")
      return
    }

    toast.success("Meal assigned")
    await loadPlans()
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

  // Inline meal data for selected date
  const dayPlan = planData.plans.find((p) => p.plan_date === selectedDate)

  const getMealData = (mealType: string): { recipe_id?: string; servings?: number } | null => {
    const plan = (dayPlan?.plan || {}) as Record<string, any>
    const fastingPlan = (dayPlan?.fasting_plan || {}) as Record<string, any>

    if (planData.isFastingMode && fastingPlan) {
      const value = fastingPlan[mealType]
      if (mealType === "snack-taraweeh" && Array.isArray(value)) {
        return value[0] || null
      }
      return value || null
    } else if (!planData.isFastingMode && plan) {
      if (!isCoreRegularMealSlot(mealType) && Array.isArray(plan.snacks)) {
        const snackIndex = getSnackIndexForSlotName(mealType, mealSlots as MealSlot[])
        return snackIndex >= 0 ? plan.snacks[snackIndex] || null : null
      }
      return plan[mealType] || null
    }
    return null
  }

  const getMealSupplements = (mealType: string): MealSupplement[] => {
    const plan = (dayPlan?.plan || {}) as Record<string, any>
    const fastingPlan = (dayPlan?.fasting_plan || {}) as Record<string, any>

    if (planData.isFastingMode && fastingPlan) {
      const value = fastingPlan[mealType]
      if (mealType === "snack-taraweeh" && Array.isArray(value)) {
        return Array.isArray(value[0]?.supplements) ? value[0].supplements : []
      }
      return Array.isArray(value?.supplements) ? value.supplements : []
    }

    if (!planData.isFastingMode && !isCoreRegularMealSlot(mealType) && Array.isArray(plan.snacks)) {
      const snackIndex = getSnackIndexForSlotName(mealType, mealSlots as MealSlot[])
      const snackSlot = snackIndex >= 0 ? plan.snacks[snackIndex] : null
      return Array.isArray(snackSlot?.supplements) ? snackSlot.supplements : []
    }

    return Array.isArray(plan[mealType]?.supplements) ? plan[mealType].supplements : []
  }

  const ensureSupplementDrafts = (mealType: string) => {
    setSupplementEdits((prev) => {
      if (prev[mealType]) return prev
      return {
        ...prev,
        [mealType]: [...getMealSupplements(mealType)],
      }
    })
  }

  const toggleSupplements = (mealType: string) => {
    ensureSupplementDrafts(mealType)
    setExpandedSupplements((prev) => ({
      ...prev,
      [mealType]: !prev[mealType],
    }))
  }

  const addSupplement = (mealType: string) => {
    ensureSupplementDrafts(mealType)
    setSupplementEdits((prev) => ({
      ...prev,
      [mealType]: [
        ...(prev[mealType] || []),
        {
          name: "",
          dosage: "",
          timing: "with",
        },
      ],
    }))
  }

  const updateSupplementField = (
    mealType: string,
    index: number,
    field: keyof MealSupplement,
    value: string | number | undefined,
  ) => {
    setSupplementEdits((prev) => {
      const items = [...(prev[mealType] || [])]
      const current = items[index]
      if (!current) return prev

      items[index] = {
        ...current,
        [field]: value,
      }

      return {
        ...prev,
        [mealType]: items,
      }
    })
  }

  const removeSupplement = (mealType: string, index: number) => {
    setSupplementEdits((prev) => ({
      ...prev,
      [mealType]: (prev[mealType] || []).filter((_, i) => i !== index),
    }))
  }

  const saveSupplements = async (mealType: string) => {
    if (!planData) return

    setSavingSupplementsMeal(mealType)

    const payload = (supplementEdits[mealType] || []).map((item) => ({
      name: item.name.trim(),
      dosage: item.dosage.trim(),
      timing: item.timing as SupplementTiming,
      after_minutes: item.after_minutes,
      note: item.note?.trim() || undefined,
    }))

    const snackIndex =
      !planData.isFastingMode && !isCoreRegularMealSlot(mealType)
        ? getSnackIndexForSlotName(mealType, mealSlots as MealSlot[])
        : undefined

    const result = await updateMealSupplements({
      userId: user.id,
      planDate: selectedDate,
      mealType,
      supplements: payload,
      snackIndex: snackIndex !== undefined && snackIndex >= 0 ? snackIndex : undefined,
      isFastingMode: planData.isFastingMode,
    })

    setSavingSupplementsMeal(mealType)

    if (!result.success) {
      toast.error(result.error || "Failed to save supplements")
      return
    }

    toast.success("Supplements saved")
    await loadPlans()
    setSavingSupplementsMeal(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Meals Composer</h3>
        <p className="text-sm text-muted-foreground">
          {planData.isFastingMode && "\u{1F319} "}
          Configure meal distribution and assign planned meals in one place
          {planData.isFastingMode && " (Ramadan Mode)"}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Quick Presets */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Quick Presets</Label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => applyPreset("3-meals")}>
                3 Meals
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset("3-meals-snack")}>
                3 Meals + Snack
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset("4-meals")}>
                4 Meals
              </Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset("5-meals")}>
                5 Meals
              </Button>
            </div>
          </div>

          {/* Date Navigator (compact inline) */}
          <DateNavigator
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            plans={planData.plans}
          />

          {/* Meal Slots (unified: distribution + assignment) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Meal Slots &middot; {planData.dailyCalories ? `${planData.dailyCalories} kcal target` : "No target"}
              </Label>
              <Button variant="ghost" size="sm" className="text-xs" onClick={addSlot}>
                <Plus className="mr-1 h-3 w-3" />
                Add Slot
              </Button>
            </div>

            {mealSlots.map((slot, index) => {
              const mealType = slot.name
              const mealData = getMealData(mealType)
              const recipe = mealData?.recipe_id ? planData.recipes[mealData.recipe_id] : null
              const servings = mealData?.servings ?? 1
              const mealSuggestions = suggestionsByMeal[mealType] || []
              const supplements = supplementEdits[mealType] || getMealSupplements(mealType)
              const slotCalories = planData.dailyCalories > 0
                ? Math.round((planData.dailyCalories * slot.percentage) / 100)
                : 0

              return (
                <div key={slot.tempId} className="rounded-lg border bg-muted/30 overflow-hidden">
                  {/* Distribution row */}
                  <div className="flex items-center gap-3 p-3">
                    <span className="text-xl">{MEAL_EMOJI[mealType] || "\u{1F37D}\uFE0F"}</span>
                    <select
                      value={mealType}
                      onChange={(e) => handleNameChange(index, e.target.value)}
                      className="flex-1 rounded-md border bg-background p-2 text-sm"
                    >
                      {MEAL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="w-16 text-center text-sm"
                        value={slot.percentage}
                        onChange={(e) => handlePercentageChange(index, e.target.value)}
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>

                    {slotCalories > 0 && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {slotCalories} cal
                      </span>
                    )}

                    <Badge variant={recipe ? "default" : "secondary"} className="text-[10px] whitespace-nowrap">
                      {recipe ? "Planned" : "Unassigned"}
                    </Badge>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={() => removeSlot(index)}
                      disabled={mealSlots.length <= 2}
                    >
                      x
                    </Button>
                  </div>

                  {/* Assignment details */}
                  <div className="border-t bg-background/50 px-3 py-2 space-y-2">
                    {recipe ? (
                      <div className="flex items-start gap-2 rounded-md bg-muted/40 p-2">
                        {recipe.image_url && (
                          <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded">
                            <Image src={recipe.image_url} alt={recipe.name} fill className="object-cover" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{recipe.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {mealData?.servings && `${mealData.servings} serving${mealData.servings !== 1 ? "s" : ""} \u00B7 `}
                            {recipe.nutrition_per_serving?.calories &&
                              `${Math.round(recipe.nutrition_per_serving.calories * servings)} kcal`}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No meal assigned</p>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleLoadSuggestions(mealType)}
                        disabled={loadingSuggestionsMeal === mealType}
                      >
                        {loadingSuggestionsMeal === mealType ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1 h-3 w-3" />
                        )}
                        Suggest
                      </Button>
                      {mealSuggestions.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">{mealSuggestions.length} options</span>
                      )}
                    </div>

                    rotate-180
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-2">
                      <button
                        type="button"
                        onClick={() => toggleSupplements(mealType)}
                        className="flex w-full items-center justify-between text-xs font-medium"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Pill className="h-3 w-3" />
                          Supplements
                          <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
                            {supplements.length}
                          </Badge>
                        </span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${expandedSupplements[mealType] ? "rotate-180" : ""}`}
                        />
                      </button>

                      {expandedSupplements[mealType] && (
                        <div className="mt-2 space-y-2">
                          {supplements.length === 0 && (
                            <p className="text-[11px] text-muted-foreground">No supplements assigned for this meal.</p>
                          )}

                          {supplements.map((supplement, supplementIndex) => (
                            <div key={`${mealType}-supp-${supplementIndex}`} className="space-y-2 rounded-md border bg-background p-2">
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <Input
                                  placeholder="Supplement name"
                                  value={supplement.name}
                                  onChange={(e) =>
                                    updateSupplementField(mealType, supplementIndex, "name", e.target.value)
                                  }
                                  className="h-8 text-xs"
                                />
                                <Input
                                  placeholder="Dosage (e.g., 500mg)"
                                  value={supplement.dosage}
                                  onChange={(e) =>
                                    updateSupplementField(mealType, supplementIndex, "dosage", e.target.value)
                                  }
                                  className="h-8 text-xs"
                                />
                              </div>

                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[130px_1fr_auto]">
                                <select
                                  value={supplement.timing}
                                  onChange={(e) =>
                                    updateSupplementField(mealType, supplementIndex, "timing", e.target.value as SupplementTiming)
                                  }
                                  className="h-8 rounded-md border bg-background px-2 text-xs"
                                >
                                  <option value="before">Before meal</option>
                                  <option value="with">With meal</option>
                                  <option value="after">After meal</option>
                                </select>

                                {supplement.timing === "after" ? (
                                  <Input
                                    placeholder="After minutes"
                                    type="number"
                                    min={0}
                                    value={supplement.after_minutes ?? ""}
                                    onChange={(e) =>
                                      updateSupplementField(
                                        mealType,
                                        supplementIndex,
                                        "after_minutes",
                                        e.target.value === "" ? undefined : Number(e.target.value),
                                      )
                                    }
                                    className="h-8 text-xs"
                                  />
                                ) : (
                                  <Input
                                    placeholder="Optional note"
                                    value={supplement.note || ""}
                                    onChange={(e) =>
                                      updateSupplementField(
                                        mealType,
                                        supplementIndex,
                                        "note",
                                        e.target.value || undefined,
                                      )
                                    }
                                    className="h-8 text-xs"
                                  />
                                )}

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => removeSupplement(mealType, supplementIndex)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => addSupplement(mealType)}
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              Add Supplement
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => saveSupplements(mealType)}
                              disabled={savingSupplementsMeal === mealType}
                            >
                              {savingSupplementsMeal === mealType ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : null}
                              Save Supplements
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Total + Save */}
          <div
            className={`flex items-center justify-between rounded-lg p-3 ${
              isStructureValid ? "bg-green-500/10" : "bg-destructive/10"
            }`}
          >
            <span className="text-sm font-medium">Total</span>
            <span className={`text-sm font-semibold ${isStructureValid ? "text-green-700" : "text-destructive"}`}>
              {totalPercentage}%
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSaveStructure} disabled={savingStructure || !isStructureValid}>
              {savingStructure ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {savingStructureSuccess ? "Saved \u2713" : "Save Distribution"}
            </Button>
          </div>

          {/* Bulk Quick Assign */}
          <div className="border-t pt-4 space-y-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Bulk Assign</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full sm:w-32">
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
                className="sm:min-w-[180px]"
              >
                {assigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Assign Suggested Meals
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
              />
              Overwrite existing plans
            </label>
          </div>
        </CardContent>
      </Card>

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
    <div className="rounded-lg bg-muted/50 p-3">
      <input
        ref={dateInputRef}
        type="date"
        value={selectedDate}
        onChange={(e) => onDateChange(e.target.value)}
        className="sr-only"
        aria-label="Choose date"
      />

      <div className="flex items-center justify-between gap-2">
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
              className="h-auto justify-start px-2 py-1.5 text-left"
              onClick={() => onDateChange(previousDateStr)}
            >
              <div className="flex w-full items-center justify-between gap-1">
                <span className="text-xs text-muted-foreground">{formatDayChip(previousDate)}</span>
                {hasPlannedPrev && <Badge className="text-[10px]">Planned</Badge>}
              </div>
            </Button>

            <div className="rounded-md border bg-background px-2 py-1.5">
              <div className="flex items-center justify-center gap-2 text-center">
                <span className="text-sm font-semibold">
                  {new Date(selectedDate).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                {selectedDate === toLocalDateString(new Date()) && (
                  <Badge variant="secondary" className="text-[10px]">
                    Today
                  </Badge>
                )}
                {hasPlanned && (
                  <Badge className="text-[10px]">
                    \u2713 Planned
                  </Badge>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              className="h-auto justify-end px-2 py-1.5 text-right"
              onClick={() => onDateChange(nextDateStr)}
            >
              <div className="flex w-full items-center justify-between gap-1">
                {hasPlannedNext && <Badge className="text-[10px]">Planned</Badge>}
                <span className="text-xs text-muted-foreground">{formatDayChip(nextDate)}</span>
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
    </div>
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
        <h3 className="text-lg font-semibold mb-2">Meals Composer</h3>
        <p className="text-sm text-muted-foreground">
          Loading meals setup...
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-full rounded-lg" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-6 rounded" />
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-40" />
        </CardContent>
      </Card>

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
