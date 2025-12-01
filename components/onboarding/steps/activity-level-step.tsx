'use client'

import { VisualSelectList, type VisualSelectOption } from '../visual-select'

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | ''

interface ActivityLevelStepProps {
  value: ActivityLevel
  onChange: (value: ActivityLevel) => void
}

const activityOptions: VisualSelectOption[] = [
  {
    value: 'sedentary',
    label: 'Sedentary',
    description: 'Little or no exercise, desk job',
    emoji: '🛋️',
  },
  {
    value: 'light',
    label: 'Lightly Active',
    description: 'Light exercise 1-3 days/week',
    emoji: '🚶',
  },
  {
    value: 'moderate',
    label: 'Moderately Active',
    description: 'Moderate exercise 3-5 days/week',
    emoji: '🏃',
  },
  {
    value: 'active',
    label: 'Very Active',
    description: 'Hard exercise 6-7 days/week',
    emoji: '💪',
  },
  {
    value: 'very_active',
    label: 'Extra Active',
    description: 'Very intense exercise or physical job',
    emoji: '🔥',
  },
]

export function ActivityLevelStep({ value, onChange }: ActivityLevelStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This helps us calculate your daily calorie needs more accurately.
      </p>
      
      <VisualSelectList
        options={activityOptions}
        value={value}
        onChange={(v) => onChange(v as ActivityLevel)}
      />
    </div>
  )
}
