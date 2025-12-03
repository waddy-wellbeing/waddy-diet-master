'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VisualSelect } from '../visual-select'
import { UnitToggle } from '../unit-toggle'

export interface BasicInfoData {
  name: string
  age: string
  sex: 'male' | 'female' | 'other' | ''
  height: string
  heightUnit: 'cm' | 'ft'
  weight: string
  weightUnit: 'kg' | 'lbs'
  mobile?: string
}

interface BasicInfoStepProps {
  data: BasicInfoData
  onChange: (data: BasicInfoData) => void
}

const sexOptions = [
  { value: 'male', label: 'Male', emoji: '👨' },
  { value: 'female', label: 'Female', emoji: '👩' },
  { value: 'other', label: 'Other', emoji: '🧑' },
]

export function BasicInfoStep({ data, onChange }: BasicInfoStepProps) {
  const updateField = <K extends keyof BasicInfoData>(
    field: K,
    value: BasicInfoData[K]
  ) => {
    onChange({ ...data, [field]: value })
  }

  // Convert height based on unit
  const getHeightDisplay = () => {
    if (!data.height) return ''
    if (data.heightUnit === 'cm') return data.height
    // Convert stored cm to feet and inches for display
    const cm = parseFloat(data.height)
    if (isNaN(cm)) return ''
    const totalInches = cm / 2.54
    const feet = Math.floor(totalInches / 12)
    const inches = Math.round(totalInches % 12)
    return `${feet}'${inches}"`
  }

  // Convert weight based on unit
  const getWeightDisplay = () => {
    if (!data.weight) return ''
    if (data.weightUnit === 'kg') return data.weight
    // Convert stored kg to lbs for display
    const kg = parseFloat(data.weight)
    if (isNaN(kg)) return ''
    return Math.round(kg * 2.205).toString()
  }

  const handleHeightChange = (value: string) => {
    // Always store in cm
    if (data.heightUnit === 'cm') {
      updateField('height', value)
    } else {
      // Parse feet'inches" format or just number
      const match = value.match(/^(\d+)'?(\d*)?"?$/)
      if (match) {
        const feet = parseInt(match[1]) || 0
        const inches = parseInt(match[2]) || 0
        const cm = Math.round((feet * 12 + inches) * 2.54)
        updateField('height', cm.toString())
      } else if (!isNaN(parseFloat(value))) {
        // Assume it's total inches
        const cm = Math.round(parseFloat(value) * 2.54)
        updateField('height', cm.toString())
      }
    }
  }

  const handleWeightChange = (value: string) => {
    // Always store in kg
    if (data.weightUnit === 'kg') {
      updateField('weight', value)
    } else {
      const lbs = parseFloat(value)
      if (!isNaN(lbs)) {
        const kg = (lbs / 2.205).toFixed(1)
        updateField('weight', kg)
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">What should we call you?</Label>
        <Input
          id="name"
          type="text"
          placeholder="Your name"
          value={data.name}
          onChange={(e) => updateField('name', e.target.value)}
          className="h-12 text-base"
        />
        <p className="text-xs text-muted-foreground">
          This is just for personalization
        </p>
      </div>

      {/* Mobile number */}
      <div className="space-y-2">
        <Label htmlFor="mobile">Mobile number</Label>
        <Input
          id="mobile"
          type="tel"
          placeholder="e.g., +971 50 123 4567"
          value={data.mobile || ''}
          onChange={(e) => updateField('mobile', e.target.value)}
          className="h-12 text-base"
        />
        <p className="text-xs text-muted-foreground">We may use this for account verification and SMS notifications</p>
      </div>

      {/* Age */}
      <div className="space-y-2">
        <Label htmlFor="age">How old are you?</Label>
        <Input
          id="age"
          type="number"
          inputMode="numeric"
          placeholder="Age"
          min={13}
          max={120}
          value={data.age}
          onChange={(e) => updateField('age', e.target.value)}
          className="h-12 text-base"
        />
      </div>

      {/* Sex */}
      <div className="space-y-2">
        <Label>Biological sex</Label>
        <p className="text-xs text-muted-foreground mb-3">
          Used for accurate calorie calculations
        </p>
        <VisualSelect
          options={sexOptions}
          value={data.sex}
          onChange={(value) => updateField('sex', value as BasicInfoData['sex'])}
          columns={3}
        />
      </div>

      {/* Height */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="height">Height</Label>
          <UnitToggle
            options={[
              { value: 'cm', label: 'cm' },
              { value: 'ft', label: 'ft/in' },
            ]}
            value={data.heightUnit}
            onChange={(value) => updateField('heightUnit', value as 'cm' | 'ft')}
          />
        </div>
        <Input
          id="height"
          type={data.heightUnit === 'cm' ? 'number' : 'text'}
          inputMode={data.heightUnit === 'cm' ? 'numeric' : 'text'}
          placeholder={data.heightUnit === 'cm' ? '175' : "5'10\""}
          value={data.heightUnit === 'cm' ? data.height : getHeightDisplay()}
          onChange={(e) => handleHeightChange(e.target.value)}
          className="h-12 text-base"
        />
      </div>

      {/* Weight */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="weight">Current weight</Label>
          <UnitToggle
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lbs', label: 'lbs' },
            ]}
            value={data.weightUnit}
            onChange={(value) => updateField('weightUnit', value as 'kg' | 'lbs')}
          />
        </div>
        <Input
          id="weight"
          type="number"
          inputMode="decimal"
          placeholder={data.weightUnit === 'kg' ? '70' : '154'}
          step="0.1"
          value={data.weightUnit === 'kg' ? data.weight : getWeightDisplay()}
          onChange={(e) => handleWeightChange(e.target.value)}
          className="h-12 text-base"
        />
      </div>
    </div>
  )
}
