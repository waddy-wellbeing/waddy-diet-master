'use client'

import { Label } from '@/components/ui/label'
import { VisualSelectList, VisualSelect, type VisualSelectOption } from '../visual-select'
import { Slider } from '@/components/ui/slider'

export interface LifestyleData {
  cookingSkill: 'beginner' | 'intermediate' | 'advanced' | ''
  maxPrepTime: number
}

interface LifestyleStepProps {
  data: LifestyleData
  onChange: (data: LifestyleData) => void
}

const cookingSkillOptions: VisualSelectOption[] = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'Simple recipes with basic techniques',
    emoji: '🍳',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'Comfortable with most recipes',
    emoji: '👨‍🍳',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'Love complex and challenging dishes',
    emoji: '⭐',
  },
]

const prepTimeLabels: Record<number, string> = {
  15: 'Quick (15 min)',
  30: 'Standard (30 min)',
  45: 'Extended (45 min)',
  60: 'Leisurely (60+ min)',
}

export function LifestyleStep({ data, onChange }: LifestyleStepProps) {
  const updateField = <K extends keyof LifestyleData>(
    field: K,
    value: LifestyleData[K]
  ) => {
    onChange({ ...data, [field]: value })
  }

  const getPrepTimeLabel = (value: number) => {
    if (value <= 15) return 'Quick meals (under 15 min)'
    if (value <= 30) return 'Standard cooking (15-30 min)'
    if (value <= 45) return 'Extended prep (30-45 min)'
    return 'Leisurely cooking (45+ min)'
  }

  return (
    <div className="space-y-8">
      {/* Cooking Skill */}
      <div className="space-y-3">
        <Label>What's your cooking skill level?</Label>
        <p className="text-xs text-muted-foreground">
          We'll recommend recipes that match your comfort level
        </p>
        <VisualSelect
          options={cookingSkillOptions}
          value={data.cookingSkill}
          onChange={(v) => updateField('cookingSkill', v as LifestyleData['cookingSkill'])}
          columns={3}
        />
      </div>

      {/* Max Prep Time */}
      <div className="space-y-4">
        <Label>How much time can you spend on cooking?</Label>
        <p className="text-xs text-muted-foreground">
          This is the maximum prep time per meal
        </p>
        
        <div className="pt-4 pb-2">
          <Slider
            value={[data.maxPrepTime || 30]}
            onValueChange={(v: number[]) => updateField('maxPrepTime', v[0])}
            min={15}
            max={60}
            step={15}
            className="w-full"
          />
        </div>
        
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>15 min</span>
          <span>30 min</span>
          <span>45 min</span>
          <span>60 min</span>
        </div>
        
        <div className="text-center py-4 px-6 bg-muted/50 rounded-xl">
          <span className="text-lg font-semibold text-primary">
            {data.maxPrepTime || 30} minutes
          </span>
          <p className="text-sm text-muted-foreground mt-1">
            {getPrepTimeLabel(data.maxPrepTime || 30)}
          </p>
        </div>
      </div>
    </div>
  )
}
