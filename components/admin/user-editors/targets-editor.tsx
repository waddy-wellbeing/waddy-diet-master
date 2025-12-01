'use client'

import { useState } from 'react'
import { Save, Loader2, Calculator } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateUserTargets, type UserWithProfile } from '@/lib/actions/users'
import { calculateTDEE } from '@/lib/utils/tdee'

interface TargetsEditorProps {
  user: UserWithProfile
  onUpdate: (user: UserWithProfile) => void
}

export function TargetsEditor({ user, onUpdate }: TargetsEditorProps) {
  const [saving, setSaving] = useState(false)
  const [dailyCalories, setDailyCalories] = useState(user.profile?.targets?.daily_calories?.toString() || '')
  const [proteinG, setProteinG] = useState(user.profile?.targets?.protein_g?.toString() || '')
  const [carbsG, setCarbsG] = useState(user.profile?.targets?.carbs_g?.toString() || '')
  const [fatG, setFatG] = useState(user.profile?.targets?.fat_g?.toString() || '')
  const [fiberG, setFiberG] = useState(user.profile?.targets?.fiber_g?.toString() || '')
  const [bmr, setBmr] = useState(user.profile?.targets?.bmr?.toString() || '')
  const [tdee, setTdee] = useState(user.profile?.targets?.tdee?.toString() || '')

  const handleCalculateTDEE = () => {
    const basicInfo = user.profile?.basic_info
    if (!basicInfo?.weight_kg || !basicInfo?.height_cm || !basicInfo?.age || !basicInfo?.sex || !basicInfo?.activity_level) {
      alert('Please fill in all basic info (weight, height, age, sex, activity level) first.')
      return
    }

    const goalType = (user.profile?.goals?.goal_type || 'maintain') as 'lose_weight' | 'maintain' | 'build_muscle'
    const pace = (user.profile?.goals?.pace || 'moderate') as 'slow' | 'moderate' | 'aggressive'

    const result = calculateTDEE({
      weight_kg: basicInfo.weight_kg,
      height_cm: basicInfo.height_cm,
      age: basicInfo.age,
      sex: basicInfo.sex as 'male' | 'female',
      activity_level: basicInfo.activity_level as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active',
      goal_type: goalType,
      pace: pace,
    })

    setBmr(result.bmr.toString())
    setTdee(result.tdee.toString())
    
    // Set daily calories to TDEE by default
    if (!dailyCalories) {
      setDailyCalories(result.tdee.toString())
    }
  }

  const handleSave = async () => {
    setSaving(true)
    
    const targets = {
      daily_calories: dailyCalories ? parseInt(dailyCalories) : undefined,
      protein_g: proteinG ? parseInt(proteinG) : undefined,
      carbs_g: carbsG ? parseInt(carbsG) : undefined,
      fat_g: fatG ? parseInt(fatG) : undefined,
      fiber_g: fiberG ? parseInt(fiberG) : undefined,
      bmr: bmr ? parseInt(bmr) : undefined,
      tdee: tdee ? parseInt(tdee) : undefined,
    }

    const result = await updateUserTargets(user.id, targets)
    
    if (result.success) {
      onUpdate({
        ...user,
        profile: user.profile ? {
          ...user.profile,
          targets: { ...user.profile.targets, ...targets },
        } : null,
      })
    }
    
    setSaving(false)
  }

  // Calculate macro percentages if daily calories is set
  const totalMacroCalories = 
    (proteinG ? parseInt(proteinG) * 4 : 0) +
    (carbsG ? parseInt(carbsG) * 4 : 0) +
    (fatG ? parseInt(fatG) * 9 : 0)
  const macroCaloriesDiff = dailyCalories ? parseInt(dailyCalories) - totalMacroCalories : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nutritional Targets</CardTitle>
        <CardDescription>
          Daily calorie and macronutrient goals
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* TDEE Calculator */}
        <div className="p-4 rounded-lg bg-muted/50 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">TDEE Calculator</p>
              <p className="text-sm text-muted-foreground">
                Calculate based on basic info
              </p>
            </div>
            <Button variant="outline" onClick={handleCalculateTDEE}>
              <Calculator className="h-4 w-4 mr-2" />
              Calculate
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">BMR</Label>
              <Input
                type="number"
                value={bmr}
                onChange={(e) => setBmr(e.target.value)}
                placeholder="Basal Metabolic Rate"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">TDEE</Label>
              <Input
                type="number"
                value={tdee}
                onChange={(e) => setTdee(e.target.value)}
                placeholder="Total Daily Energy"
              />
            </div>
          </div>
        </div>

        {/* Daily Calories */}
        <div className="space-y-2">
          <Label htmlFor="dailyCalories" className="text-base font-medium">Daily Calories Target</Label>
          <Input
            id="dailyCalories"
            type="number"
            min={800}
            max={10000}
            value={dailyCalories}
            onChange={(e) => setDailyCalories(e.target.value)}
            placeholder="e.g., 2000"
            className="text-lg"
          />
        </div>

        {/* Macros */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Macronutrient Targets (grams)</Label>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="protein" className="text-xs text-muted-foreground">
                Protein (g) <span className="text-blue-500">• 4 cal/g</span>
              </Label>
              <Input
                id="protein"
                type="number"
                min={0}
                value={proteinG}
                onChange={(e) => setProteinG(e.target.value)}
                placeholder="e.g., 150"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="carbs" className="text-xs text-muted-foreground">
                Carbs (g) <span className="text-green-500">• 4 cal/g</span>
              </Label>
              <Input
                id="carbs"
                type="number"
                min={0}
                value={carbsG}
                onChange={(e) => setCarbsG(e.target.value)}
                placeholder="e.g., 200"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fat" className="text-xs text-muted-foreground">
                Fat (g) <span className="text-orange-500">• 9 cal/g</span>
              </Label>
              <Input
                id="fat"
                type="number"
                min={0}
                value={fatG}
                onChange={(e) => setFatG(e.target.value)}
                placeholder="e.g., 65"
              />
            </div>
          </div>
          
          {/* Macro summary */}
          {dailyCalories && totalMacroCalories > 0 && (
            <div className={`text-sm p-2 rounded ${
              Math.abs(macroCaloriesDiff) < 50 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
            }`}>
              Macros = {totalMacroCalories} cal 
              ({macroCaloriesDiff >= 0 ? '+' : ''}{macroCaloriesDiff} from target)
            </div>
          )}
        </div>

        {/* Fiber */}
        <div className="space-y-2">
          <Label htmlFor="fiber">Fiber (g)</Label>
          <Input
            id="fiber"
            type="number"
            min={0}
            value={fiberG}
            onChange={(e) => setFiberG(e.target.value)}
            placeholder="e.g., 30"
            className="max-w-[200px]"
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
