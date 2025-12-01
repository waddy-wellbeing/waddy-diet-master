"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateUserGoals } from "@/lib/actions/users"
import type { UserWithProfile } from "@/lib/actions/users"
import { Loader2, Save, Target, TrendingDown, TrendingUp, Minus } from "lucide-react"

interface GoalsEditorProps {
  user: UserWithProfile
  onUpdate?: (user: UserWithProfile) => void
}

const GOAL_TYPES = [
  { value: "lose_weight", label: "Lose Weight", icon: TrendingDown, color: "text-blue-500" },
  { value: "maintain", label: "Maintain Weight", icon: Minus, color: "text-green-500" },
  { value: "build_muscle", label: "Build Muscle", icon: TrendingUp, color: "text-orange-500" },
] as const

const PACE_OPTIONS = [
  { value: "slow", label: "Slow (0.25 kg/week)", description: "Gradual and sustainable" },
  { value: "moderate", label: "Moderate (0.5 kg/week)", description: "Balanced approach" },
  { value: "aggressive", label: "Aggressive (0.75 kg/week)", description: "More aggressive" },
] as const

export function GoalsEditor({ user, onUpdate }: GoalsEditorProps) {
  const goals = user.profile?.goals || {}
  
  const [goalType, setGoalType] = useState(goals.goal_type || "")
  const [targetWeight, setTargetWeight] = useState(goals.target_weight_kg?.toString() || "")
  const [pace, setPace] = useState(goals.pace || "")
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    
    const updatedGoals = {
      goal_type: (goalType || undefined) as 'lose_weight' | 'maintain' | 'build_muscle' | undefined,
      target_weight_kg: targetWeight ? parseFloat(targetWeight) : undefined,
      pace: (pace || undefined) as 'slow' | 'moderate' | 'aggressive' | undefined,
    }

    const result = await updateUserGoals(user.id, updatedGoals)
    
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
            goals: { ...user.profile.goals, ...updatedGoals },
          } : null,
        })
      }
    }
  }

  const currentWeight = user.profile?.basic_info?.weight_kg

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Health Goals
        </CardTitle>
        <CardDescription>
          Configure the user&apos;s weight and health goals
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Goal Type Selection */}
        <div className="space-y-3">
          <Label>Goal Type</Label>
          <div className="grid grid-cols-3 gap-3">
            {GOAL_TYPES.map((goal) => {
              const Icon = goal.icon
              return (
                <button
                  key={goal.value}
                  type="button"
                  onClick={() => setGoalType(goal.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    goalType === goal.value
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50"
                  }`}
                >
                  <Icon className={`h-6 w-6 ${goal.color}`} />
                  <span className="text-sm font-medium">{goal.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Current vs Target Weight */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Current Weight</Label>
            <div className="p-3 bg-muted rounded-lg">
              <span className="text-lg font-medium">
                {currentWeight ? `${currentWeight} kg` : "Not set"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Edit in Basic Info tab
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetWeight">Target Weight (kg)</Label>
            <Input
              id="targetWeight"
              type="number"
              step="0.1"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              placeholder="e.g., 70"
            />
            {currentWeight && targetWeight && (
              <p className="text-xs text-muted-foreground">
                {parseFloat(targetWeight) < currentWeight 
                  ? `Lose ${(currentWeight - parseFloat(targetWeight)).toFixed(1)} kg`
                  : parseFloat(targetWeight) > currentWeight
                  ? `Gain ${(parseFloat(targetWeight) - currentWeight).toFixed(1)} kg`
                  : "At target weight"}
              </p>
            )}
          </div>
        </div>

        {/* Pace Selection */}
        {goalType && goalType !== "maintain" && (
          <div className="space-y-2">
            <Label>Pace</Label>
            <Select value={pace} onValueChange={setPace}>
              <SelectTrigger>
                <SelectValue placeholder="Select pace..." />
              </SelectTrigger>
              <SelectContent>
                {PACE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Summary */}
        {goalType && (
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <h4 className="font-medium text-sm">Goal Summary</h4>
            <p className="text-sm text-muted-foreground">
              {goalType === "maintain" && "Maintain current weight with balanced nutrition."}
              {goalType === "lose_weight" && pace && targetWeight && currentWeight && (
                <>
                  Lose {(currentWeight - parseFloat(targetWeight)).toFixed(1)} kg at a {pace} pace.
                  Estimated time: {Math.ceil((currentWeight - parseFloat(targetWeight)) / (
                    pace === "slow" ? 0.25 : pace === "moderate" ? 0.5 : 0.75
                  ))} weeks.
                </>
              )}
              {goalType === "build_muscle" && pace && targetWeight && currentWeight && (
                <>
                  Gain {(parseFloat(targetWeight) - currentWeight).toFixed(1)} kg at a {pace} pace.
                  Estimated time: {Math.ceil((parseFloat(targetWeight) - currentWeight) / (
                    pace === "slow" ? 0.25 : pace === "moderate" ? 0.5 : 0.75
                  ))} weeks.
                </>
              )}
            </p>
          </div>
        )}

        <Button 
          onClick={handleSave} 
          disabled={saving}
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
              Save Goals
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
