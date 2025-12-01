"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { assignMealStructure } from "@/lib/actions/users"
import type { UserWithProfile } from "@/lib/actions/users"
import type { MealSlot } from "@/lib/types/nutri"
import { Loader2, Save, Utensils, Plus, Trash2, AlertCircle } from "lucide-react"

interface MealStructureEditorProps {
  user: UserWithProfile
  onUpdate?: (user: UserWithProfile) => void
}

// Local type for editing meal slots with a temp id for React keys
interface EditableMealSlot extends MealSlot {
  tempId: number
}

const DEFAULT_STRUCTURES: Record<string, Omit<MealSlot, 'target_calories'>[]> = {
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
]

export function MealStructureEditor({ user, onUpdate }: MealStructureEditorProps) {
  const existingStructure = user.profile?.preferences?.meal_structure
  const initialStructure = existingStructure || DEFAULT_STRUCTURES["3-meals"]
  
  const [mealSlots, setMealSlots] = useState<EditableMealSlot[]>(
    initialStructure.map((slot, idx) => ({ ...slot, tempId: idx }))
  )
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const totalPercentage = mealSlots.reduce((sum, slot) => sum + (slot.percentage || 0), 0)
  const isValid = totalPercentage === 100

  const handlePercentageChange = (index: number, value: string) => {
    const newSlots = [...mealSlots]
    newSlots[index] = { ...newSlots[index], percentage: parseInt(value) || 0 }
    setMealSlots(newSlots)
  }

  const handleNameChange = (index: number, value: string) => {
    const option = MEAL_OPTIONS.find(o => o.value === value)
    const newSlots = [...mealSlots]
    newSlots[index] = { ...newSlots[index], name: value, label: option?.label }
    setMealSlots(newSlots)
  }

  const addSlot = () => {
    setMealSlots([...mealSlots, { 
      tempId: Date.now(),
      name: "afternoon",
      label: "Afternoon Snack",
      percentage: 0 
    }])
  }

  const removeSlot = (index: number) => {
    if (mealSlots.length <= 2) return
    const newSlots = mealSlots.filter((_, i) => i !== index)
    setMealSlots(newSlots)
  }

  const applyPreset = (preset: string) => {
    const structure = DEFAULT_STRUCTURES[preset]
    if (structure) {
      setMealSlots(structure.map((slot, idx) => ({ ...slot, tempId: idx })))
    }
  }

  const handleSave = async () => {
    if (!isValid) return
    
    setSaving(true)
    
    // Remove the temporary id before saving
    const cleanedSlots: MealSlot[] = mealSlots.map(({ name, label, percentage }) => ({
      name,
      label,
      percentage,
    }))

    const result = await assignMealStructure(user.id, cleanedSlots)
    
    setSaving(false)
    if (result.success) {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
      // Notify parent of update
      if (onUpdate) {
        onUpdate({
          ...user,
          profile: user.profile ? {
            ...user.profile,
            preferences: {
              ...user.profile.preferences,
              meals_per_day: cleanedSlots.length,
              meal_structure: cleanedSlots,
            },
          } : null,
        })
      }
    }
  }

  const dailyCalories = user.profile?.targets?.daily_calories || 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Utensils className="h-5 w-5" />
          Meal Structure
        </CardTitle>
        <CardDescription>
          Configure how daily calories are distributed across meals
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Presets */}
        <div className="space-y-2">
          <Label>Quick Presets</Label>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => applyPreset("3-meals")}
            >
              3 Meals
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => applyPreset("3-meals-snack")}
            >
              3 Meals + Snack
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => applyPreset("4-meals")}
            >
              4 Meals
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => applyPreset("5-meals")}
            >
              5 Meals
            </Button>
          </div>
        </div>

        {/* Meal Slots */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Meal Distribution</Label>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={addSlot}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Slot
            </Button>
          </div>
          
          {mealSlots.map((slot, index) => (
            <div key={slot.tempId} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <select
                value={slot.name}
                onChange={(e) => handleNameChange(index, e.target.value)}
                className="flex-1 p-2 rounded-md border bg-background"
              >
                {MEAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={slot.percentage}
                  onChange={(e) => handlePercentageChange(index, e.target.value)}
                  className="w-20 text-center"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              
              {dailyCalories > 0 && (
                <span className="text-sm text-muted-foreground w-20 text-right">
                  {Math.round(dailyCalories * slot.percentage / 100)} cal
                </span>
              )}
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeSlot(index)}
                disabled={mealSlots.length <= 2}
                className="h-8 w-8"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Total Indicator */}
        <div className={`flex items-center justify-between p-3 rounded-lg ${
          isValid ? "bg-green-500/10" : "bg-red-500/10"
        }`}>
          <div className="flex items-center gap-2">
            {!isValid && <AlertCircle className="h-4 w-4 text-red-500" />}
            <span className="text-sm font-medium">Total</span>
          </div>
          <span className={`text-sm font-bold ${
            isValid ? "text-green-600" : "text-red-600"
          }`}>
            {totalPercentage}%
            {!isValid && ` (${totalPercentage < 100 ? "needs" : "over by"} ${Math.abs(100 - totalPercentage)}%)`}
          </span>
        </div>

        {/* Daily Calories Reference */}
        {dailyCalories > 0 && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Calorie Distribution</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Based on {dailyCalories} daily calories:
            </p>
            <div className="space-y-1">
              {mealSlots.map((slot) => (
                <div key={slot.tempId} className="flex justify-between text-sm">
                  <span>{slot.label || slot.name}</span>
                  <span className="font-medium">
                    {Math.round(dailyCalories * slot.percentage / 100)} calories
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button 
          onClick={handleSave} 
          disabled={saving || !isValid}
          className="w-full"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : success ? (
            <>
              <Save className="mr-2 h-4 w-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Meal Structure
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
