'use client'

import { Label } from '@/components/ui/label'
import { VisualSelectList, type VisualSelectOption } from '../visual-select'
import { ChipSelect, NoneToggle } from '../chip-select'

export interface DietaryPreferencesData {
  dietType: 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | ''
  allergies: string[]
  hasNoAllergies: boolean
  dislikes: string[]
}

interface DietaryPreferencesStepProps {
  data: DietaryPreferencesData
  onChange: (data: DietaryPreferencesData) => void
}

const dietTypeOptions: VisualSelectOption[] = [
  { value: 'omnivore', label: 'Omnivore', description: 'Eat everything', emoji: '🍖' },
  { value: 'vegetarian', label: 'Vegetarian', description: 'No meat or fish', emoji: '🥬' },
  { value: 'vegan', label: 'Vegan', description: 'No animal products', emoji: '🌱' },
  { value: 'pescatarian', label: 'Pescatarian', description: 'Fish but no meat', emoji: '🐟' },
  { value: 'keto', label: 'Keto', description: 'Low carb, high fat', emoji: '🥑' },
  { value: 'paleo', label: 'Paleo', description: 'Whole foods only', emoji: '🍗' },
]

const commonAllergies = [
  'Gluten',
  'Dairy',
  'Eggs',
  'Peanuts',
  'Tree Nuts',
  'Soy',
  'Shellfish',
  'Fish',
  'Sesame',
]

const commonDislikes = [
  'Onions',
  'Tomatoes',
  'Mushrooms',
  'Olives',
  'Cilantro',
  'Spicy food',
  'Seafood',
  'Liver',
  'Eggplant',
]

export function DietaryPreferencesStep({ data, onChange }: DietaryPreferencesStepProps) {
  const updateField = <K extends keyof DietaryPreferencesData>(
    field: K,
    value: DietaryPreferencesData[K]
  ) => {
    onChange({ ...data, [field]: value })
  }

  const handleNoAllergiesToggle = (checked: boolean) => {
    updateField('hasNoAllergies', checked)
    if (checked) {
      updateField('allergies', [])
    }
  }

  const handleAllergiesChange = (allergies: string[]) => {
    updateField('allergies', allergies)
    if (allergies.length > 0) {
      updateField('hasNoAllergies', false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Diet Type */}
      <div className="space-y-3">
        <Label>What type of diet do you follow?</Label>
        <VisualSelectList
          options={dietTypeOptions}
          value={data.dietType}
          onChange={(v) => updateField('dietType', v as DietaryPreferencesData['dietType'])}
        />
      </div>

      {/* Allergies - Commented out for now
      <div className="space-y-3">
        <Label>Any food allergies or intolerances?</Label>
        <p className="text-xs text-muted-foreground">
          We'll make sure to exclude these from your meal plans
        </p>
        
        <NoneToggle
          selected={data.hasNoAllergies}
          onChange={handleNoAllergiesToggle}
          label="I don't have any allergies"
        />
        
        {!data.hasNoAllergies && (
          <ChipSelect
            options={commonAllergies}
            selected={data.allergies}
            onChange={handleAllergiesChange}
            allowCustom
            customPlaceholder="Add other allergy..."
          />
        )}
      </div>
      */}

      {/* Dislikes - Commented out for now
      <div className="space-y-3">
        <Label>Any ingredients you dislike?</Label>
        <p className="text-xs text-muted-foreground">
          Optional - we'll try to minimize these in your plans
        </p>
        <ChipSelect
          options={commonDislikes}
          selected={data.dislikes}
          onChange={(v) => updateField('dislikes', v)}
          allowCustom
          customPlaceholder="Add other dislike..."
        />
      </div>
      */}
    </div>
  )
}
