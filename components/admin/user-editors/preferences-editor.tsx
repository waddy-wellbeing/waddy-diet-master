'use client'

import { useState } from 'react'
import { Save, Loader2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateUserPreferences, type UserWithProfile } from '@/lib/actions/users'

interface PreferencesEditorProps {
  user: UserWithProfile
  onUpdate: (user: UserWithProfile) => void
}

const DIET_TYPES = [
  { value: 'omnivore', label: 'Omnivore' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'keto', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
]

const COOKING_SKILLS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

const COMMON_ALLERGIES = [
  'Dairy', 'Eggs', 'Peanuts', 'Tree nuts', 'Fish', 'Shellfish', 'Wheat', 'Soy', 'Gluten'
]

const COMMON_CUISINES = [
  'Egyptian', 'Lebanese', 'Mediterranean', 'Italian', 'Mexican', 'Asian', 'Indian', 'American'
]

export function PreferencesEditor({ user, onUpdate }: PreferencesEditorProps) {
  const [saving, setSaving] = useState(false)
  const [dietType, setDietType] = useState(user.profile?.preferences?.diet_type || '')
  const [cookingSkill, setCookingSkill] = useState(user.profile?.preferences?.cooking_skill || '')
  const [maxPrepTime, setMaxPrepTime] = useState(user.profile?.preferences?.max_prep_time_minutes?.toString() || '')
  const [allergies, setAllergies] = useState<string[]>(user.profile?.preferences?.allergies || [])
  const [dislikes, setDislikes] = useState<string[]>(user.profile?.preferences?.dislikes || [])
  const [cuisinePreferences, setCuisinePreferences] = useState<string[]>(user.profile?.preferences?.cuisine_preferences || [])
  
  // Input states for adding new items
  const [newAllergy, setNewAllergy] = useState('')
  const [newDislike, setNewDislike] = useState('')

  const addAllergy = (allergy: string) => {
    const trimmed = allergy.trim()
    if (trimmed && !allergies.includes(trimmed)) {
      setAllergies([...allergies, trimmed])
    }
    setNewAllergy('')
  }

  const removeAllergy = (allergy: string) => {
    setAllergies(allergies.filter(a => a !== allergy))
  }

  const addDislike = (dislike: string) => {
    const trimmed = dislike.trim()
    if (trimmed && !dislikes.includes(trimmed)) {
      setDislikes([...dislikes, trimmed])
    }
    setNewDislike('')
  }

  const removeDislike = (dislike: string) => {
    setDislikes(dislikes.filter(d => d !== dislike))
  }

  const toggleCuisine = (cuisine: string) => {
    if (cuisinePreferences.includes(cuisine)) {
      setCuisinePreferences(cuisinePreferences.filter(c => c !== cuisine))
    } else {
      setCuisinePreferences([...cuisinePreferences, cuisine])
    }
  }

  const handleSave = async () => {
    setSaving(true)
    
    const preferences = {
      diet_type: (dietType || undefined) as 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | undefined,
      cooking_skill: (cookingSkill || undefined) as 'beginner' | 'intermediate' | 'advanced' | undefined,
      max_prep_time_minutes: maxPrepTime ? parseInt(maxPrepTime) : undefined,
      allergies,
      dislikes,
      cuisine_preferences: cuisinePreferences,
    }

    const result = await updateUserPreferences(user.id, preferences)
    
    if (result.success) {
      onUpdate({
        ...user,
        profile: user.profile ? {
          ...user.profile,
          preferences: { ...user.profile.preferences, ...preferences },
        } : null,
      })
    }
    
    setSaving(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dietary Preferences</CardTitle>
        <CardDescription>
          Food preferences, restrictions, and cooking preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Diet Type and Cooking Skill */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dietType">Diet Type</Label>
            <Select value={dietType} onValueChange={setDietType}>
              <SelectTrigger id="dietType">
                <SelectValue placeholder="Select diet type" />
              </SelectTrigger>
              <SelectContent>
                {DIET_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cookingSkill">Cooking Skill</Label>
            <Select value={cookingSkill} onValueChange={setCookingSkill}>
              <SelectTrigger id="cookingSkill">
                <SelectValue placeholder="Select skill level" />
              </SelectTrigger>
              <SelectContent>
                {COOKING_SKILLS.map(skill => (
                  <SelectItem key={skill.value} value={skill.value}>
                    {skill.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxPrepTime">Max Prep Time (minutes)</Label>
            <Input
              id="maxPrepTime"
              type="number"
              min={5}
              max={180}
              step={5}
              value={maxPrepTime}
              onChange={(e) => setMaxPrepTime(e.target.value)}
              placeholder="e.g., 30"
            />
          </div>
        </div>

        {/* Allergies */}
        <div className="space-y-3">
          <Label>Allergies & Restrictions</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {allergies.map(allergy => (
              <Badge key={allergy} variant="destructive" className="gap-1">
                {allergy}
                <button onClick={() => removeAllergy(allergy)} className="ml-1 hover:bg-white/20 rounded">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newAllergy}
              onChange={(e) => setNewAllergy(e.target.value)}
              placeholder="Add allergy..."
              onKeyDown={(e) => e.key === 'Enter' && addAllergy(newAllergy)}
              className="max-w-xs"
            />
            <Button variant="outline" size="icon" onClick={() => addAllergy(newAllergy)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {COMMON_ALLERGIES.filter(a => !allergies.includes(a)).map(allergy => (
              <Button
                key={allergy}
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => addAllergy(allergy)}
              >
                + {allergy}
              </Button>
            ))}
          </div>
        </div>

        {/* Dislikes */}
        <div className="space-y-3">
          <Label>Food Dislikes</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {dislikes.map(dislike => (
              <Badge key={dislike} variant="secondary" className="gap-1">
                {dislike}
                <button onClick={() => removeDislike(dislike)} className="ml-1 hover:bg-black/10 rounded">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newDislike}
              onChange={(e) => setNewDislike(e.target.value)}
              placeholder="Add dislike..."
              onKeyDown={(e) => e.key === 'Enter' && addDislike(newDislike)}
              className="max-w-xs"
            />
            <Button variant="outline" size="icon" onClick={() => addDislike(newDislike)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Cuisine Preferences */}
        <div className="space-y-3">
          <Label>Cuisine Preferences</Label>
          <div className="flex flex-wrap gap-2">
            {COMMON_CUISINES.map(cuisine => (
              <Badge
                key={cuisine}
                variant={cuisinePreferences.includes(cuisine) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleCuisine(cuisine)}
              >
                {cuisine}
              </Badge>
            ))}
          </div>
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
