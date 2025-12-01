'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VisualSelect, VisualSelectList } from '../visual-select'
import { UnitToggle } from '../unit-toggle'

export interface GoalsData {
  goalType: 'lose_weight' | 'maintain' | 'build_muscle' | ''
  targetWeight: string
  targetWeightUnit: 'kg' | 'lbs'
  pace: 'slow' | 'moderate' | 'aggressive' | ''
}

interface GoalsStepProps {
  data: GoalsData
  currentWeight: string
  weightUnit: 'kg' | 'lbs'
  onChange: (data: GoalsData) => void
}

const goalTypeOptions = [
  {
    value: 'lose_weight',
    label: 'Lose Weight',
    description: 'Burn fat while preserving muscle',
    emoji: '📉',
  },
  {
    value: 'maintain',
    label: 'Maintain',
    description: 'Stay at your current weight',
    emoji: '⚖️',
  },
  {
    value: 'build_muscle',
    label: 'Build Muscle',
    description: 'Gain strength and muscle mass',
    emoji: '💪',
  },
]

const paceOptions = [
  {
    value: 'slow',
    label: 'Slow & Steady',
    description: '~0.25 kg/week • Sustainable approach',
    emoji: '🐢',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    description: '~0.5 kg/week • Balanced pace',
    emoji: '🚶',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    description: '~0.75 kg/week • Faster results',
    emoji: '🚀',
  },
]

export function GoalsStep({ data, currentWeight, weightUnit, onChange }: GoalsStepProps) {
  const updateField = <K extends keyof GoalsData>(field: K, value: GoalsData[K]) => {
    onChange({ ...data, [field]: value })
  }

  const showTargetWeight = data.goalType === 'lose_weight' || data.goalType === 'build_muscle'
  const showPace = data.goalType === 'lose_weight' || data.goalType === 'build_muscle'

  // Display weight in selected unit
  const getDisplayWeight = (kgValue: string) => {
    if (!kgValue) return ''
    const kg = parseFloat(kgValue)
    if (isNaN(kg)) return kgValue
    if (data.targetWeightUnit === 'lbs') {
      return Math.round(kg * 2.205).toString()
    }
    return kgValue
  }

  const handleWeightChange = (value: string) => {
    // Always store in kg
    if (data.targetWeightUnit === 'kg') {
      updateField('targetWeight', value)
    } else {
      const lbs = parseFloat(value)
      if (!isNaN(lbs)) {
        const kg = (lbs / 2.205).toFixed(1)
        updateField('targetWeight', kg)
      } else {
        updateField('targetWeight', '')
      }
    }
  }

  // Calculate weight difference
  const getWeightDiff = () => {
    if (!currentWeight || !data.targetWeight) return null
    const current = parseFloat(currentWeight)
    const target = parseFloat(data.targetWeight)
    if (isNaN(current) || isNaN(target)) return null
    
    const diff = target - current
    const displayDiff = data.targetWeightUnit === 'lbs' 
      ? Math.round(diff * 2.205) 
      : diff.toFixed(1)
    const unit = data.targetWeightUnit
    
    if (diff > 0) return `+${displayDiff} ${unit} to gain`
    if (diff < 0) return `${displayDiff} ${unit} to lose`
    return 'At target weight'
  }

  return (
    <div className="space-y-6">
      {/* Goal Type */}
      <div className="space-y-3">
        <Label>What's your main goal?</Label>
        <VisualSelect
          options={goalTypeOptions}
          value={data.goalType}
          onChange={(v) => updateField('goalType', v as GoalsData['goalType'])}
          columns={3}
        />
      </div>

      {/* Target Weight - only show for lose/gain */}
      {showTargetWeight && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="targetWeight">Target weight</Label>
            <UnitToggle
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lbs', label: 'lbs' },
              ]}
              value={data.targetWeightUnit}
              onChange={(v) => updateField('targetWeightUnit', v as 'kg' | 'lbs')}
            />
          </div>
          <Input
            id="targetWeight"
            type="number"
            inputMode="decimal"
            placeholder={data.targetWeightUnit === 'kg' ? '65' : '143'}
            step="0.1"
            value={getDisplayWeight(data.targetWeight)}
            onChange={(e) => handleWeightChange(e.target.value)}
            className="h-12 text-base"
          />
          {getWeightDiff() && (
            <p className="text-sm text-muted-foreground">{getWeightDiff()}</p>
          )}
        </div>
      )}

      {/* Pace - only show for lose/gain */}
      {showPace && (
        <div className="space-y-3">
          <Label>Choose your pace</Label>
          <p className="text-xs text-muted-foreground">
            Slower pace is generally more sustainable long-term
          </p>
          <VisualSelectList
            options={paceOptions}
            value={data.pace}
            onChange={(v) => updateField('pace', v as GoalsData['pace'])}
          />
        </div>
      )}
    </div>
  )
}
