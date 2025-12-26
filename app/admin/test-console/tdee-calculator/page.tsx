'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Calculator, Info, Flame, Dumbbell, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  calculateTDEE,
  ACTIVITY_LABELS,
  GOAL_LABELS,
  PACE_LABELS,
  type TDEEInput,
  type TDEEResult,
  type Sex,
  type ActivityLevel,
  type GoalType,
  type Pace,
} from '@/lib/utils/tdee'

const sexOptions: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

const activityOptions: { value: ActivityLevel; label: string; description: string }[] = [
  { value: 'sedentary', label: ACTIVITY_LABELS.sedentary.label, description: ACTIVITY_LABELS.sedentary.description },
  { value: 'light', label: ACTIVITY_LABELS.light.label, description: ACTIVITY_LABELS.light.description },
  { value: 'moderate', label: ACTIVITY_LABELS.moderate.label, description: ACTIVITY_LABELS.moderate.description },
  { value: 'active', label: ACTIVITY_LABELS.active.label, description: ACTIVITY_LABELS.active.description },
  { value: 'very_active', label: ACTIVITY_LABELS.very_active.label, description: ACTIVITY_LABELS.very_active.description },
]

const goalOptions: { value: GoalType; label: string; description: string }[] = [
  { value: 'lose_weight', label: GOAL_LABELS.lose_weight.label, description: GOAL_LABELS.lose_weight.description },
  { value: 'maintain', label: GOAL_LABELS.maintain.label, description: GOAL_LABELS.maintain.description },
  { value: 'build_muscle', label: GOAL_LABELS.build_muscle.label, description: GOAL_LABELS.build_muscle.description },
  { value: 'recomposition', label: GOAL_LABELS.recomposition.label, description: GOAL_LABELS.recomposition.description },
]

const paceOptions: { value: Pace; label: string }[] = [
  { value: 'slow', label: PACE_LABELS.slow.label },
  { value: 'moderate', label: PACE_LABELS.moderate.label },
  { value: 'aggressive', label: PACE_LABELS.aggressive.label },
]

export default function TDEECalculatorPage() {
  const [input, setInput] = useState<TDEEInput>({
    age: 30,
    sex: 'male',
    weight_kg: 75,
    height_cm: 175,
    activity_level: 'moderate',
    goal_type: 'maintain',
    pace: 'moderate',
  })

  const [result, setResult] = useState<TDEEResult | null>(null)

  const handleCalculate = () => {
    const tdeeResult = calculateTDEE(input)
    setResult(tdeeResult)
  }

  const handleInputChange = (field: keyof TDEEInput, value: string | number) => {
    setInput(prev => ({ ...prev, [field]: value }))
    setResult(null) // Clear result when input changes
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/test-console">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">TDEE Calculator</h1>
          <p className="text-muted-foreground">
            Calculate Total Daily Energy Expenditure and macro targets
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              User Profile
            </CardTitle>
            <CardDescription>
              Enter user details to calculate their daily calorie needs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  min={15}
                  max={100}
                  value={input.age}
                  onChange={(e) => handleInputChange('age', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sex">Biological Sex</Label>
                <select
                  id="sex"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={input.sex}
                  onChange={(e) => handleInputChange('sex', e.target.value as Sex)}
                >
                  {sexOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  min={30}
                  max={300}
                  step={0.1}
                  value={input.weight_kg}
                  onChange={(e) => handleInputChange('weight_kg', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  min={100}
                  max={250}
                  value={input.height_cm}
                  onChange={(e) => handleInputChange('height_cm', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Activity Level */}
            <div className="space-y-3">
              <Label>Activity Level</Label>
              <div className="grid gap-2">
                {activityOptions.map(opt => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      input.activity_level === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="activity"
                      value={opt.value}
                      checked={input.activity_level === opt.value}
                      onChange={(e) => handleInputChange('activity_level', e.target.value as ActivityLevel)}
                      className="sr-only"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-sm text-muted-foreground">{opt.description}</div>
                    </div>
                    {input.activity_level === opt.value && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Goal */}
            <div className="space-y-3">
              <Label>Goal</Label>
              <div className="grid grid-cols-2 gap-2">
                {goalOptions.map(opt => (
                  <label
                    key={opt.value}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 cursor-pointer transition-colors text-center ${
                      input.goal_type === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="goal"
                      value={opt.value}
                      checked={input.goal_type === opt.value}
                      onChange={(e) => handleInputChange('goal_type', e.target.value as GoalType)}
                      className="sr-only"
                    />
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.description}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* Pace (only for non-maintenance goals) */}
            {input.goal_type !== 'maintain' && (
              <div className="space-y-3">
                <Label>Pace</Label>
                {input.goal_type === 'recomposition' && (
                  <p className="text-xs text-muted-foreground">
                    Recomposition: Slow = -5% deficit, Moderate = maintenance, Aggressive = +5% surplus (all with high protein)
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {paceOptions.map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-center justify-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                        input.pace === opt.value
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pace"
                        value={opt.value}
                        checked={input.pace === opt.value}
                        onChange={(e) => handleInputChange('pace', e.target.value as Pace)}
                        className="sr-only"
                      />
                      <span className="font-medium text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleCalculate} className="w-full" size="lg">
              <Calculator className="h-4 w-4 mr-2" />
              Calculate TDEE
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Main Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-500" />
                    Energy Expenditure
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-muted/50 p-4">
                      <div className="text-sm text-muted-foreground">BMR</div>
                      <div className="text-2xl font-bold">{result.bmr}</div>
                      <div className="text-xs text-muted-foreground">kcal/day at rest</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-4">
                      <div className="text-sm text-muted-foreground">TDEE</div>
                      <div className="text-2xl font-bold">{result.tdee}</div>
                      <div className="text-xs text-muted-foreground">kcal/day maintenance</div>
                    </div>
                  </div>

                  <div className="rounded-lg border-2 border-primary bg-primary/5 p-4 text-center">
                    <div className="text-sm text-muted-foreground mb-1">Target Daily Calories</div>
                    <div className="text-4xl font-bold text-primary">{result.daily_calories}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {result.goal_adjustment_percent === 0 
                        ? 'Maintenance'
                        : `${result.goal_adjustment_percent > 0 ? '+' : ''}${result.goal_adjustment_percent}% from maintenance`
                      }
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Macros */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Dumbbell className="h-5 w-5 text-blue-500" />
                    Macro Targets
                  </CardTitle>
                  <CardDescription>
                    Based on 2g protein/kg body weight, 25% fat, remaining carbs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-4 text-center">
                      <div className="text-sm text-muted-foreground">Protein</div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {result.protein_g}g
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round((result.protein_g * 4 / result.daily_calories) * 100)}% of calories
                      </div>
                    </div>
                    <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 p-4 text-center">
                      <div className="text-sm text-muted-foreground">Fat</div>
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {result.fat_g}g
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round((result.fat_g * 9 / result.daily_calories) * 100)}% of calories
                      </div>
                    </div>
                    <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-4 text-center">
                      <div className="text-sm text-muted-foreground">Carbs</div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {result.carbs_g}g
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round((result.carbs_g * 4 / result.daily_calories) * 100)}% of calories
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Formula Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    Calculation Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Formula</span>
                    <span className="font-mono">Mifflin-St Jeor</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Activity Multiplier</span>
                    <span className="font-mono">{result.activity_multiplier}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Goal Adjustment</span>
                    <span className="font-mono">{result.goal_adjustment_percent}%</span>
                  </div>
                  <hr />
                  <div className="text-xs text-muted-foreground">
                    <strong>BMR Formula ({input.sex}):</strong>
                    <br />
                    {input.sex === 'male' 
                      ? '(10 × weight) + (6.25 × height) − (5 × age) + 5'
                      : '(10 × weight) + (6.25 × height) − (5 × age) − 161'
                    }
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <CardContent className="text-center">
                <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Enter user details and click Calculate to see TDEE results
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
