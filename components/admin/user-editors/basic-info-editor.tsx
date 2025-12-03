'use client'

import { useState } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PhoneInput } from '@/components/onboarding/phone-input'
import { updateUserBasicInfo, type UserWithProfile } from '@/lib/actions/users'

interface BasicInfoEditorProps {
  user: UserWithProfile
  onUpdate: (user: UserWithProfile) => void
}

export function BasicInfoEditor({ user, onUpdate }: BasicInfoEditorProps) {
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(user.profile?.name || user.profile?.basic_info?.name || '')
  const [age, setAge] = useState(user.profile?.basic_info?.age?.toString() || '')
  const [heightCm, setHeightCm] = useState(user.profile?.basic_info?.height_cm?.toString() || '')
  const [weightKg, setWeightKg] = useState(user.profile?.basic_info?.weight_kg?.toString() || '')
  const [sex, setSex] = useState(user.profile?.basic_info?.sex || '')
  const [activityLevel, setActivityLevel] = useState(user.profile?.basic_info?.activity_level || '')
  const [mobile, setMobile] = useState(user.profile?.mobile || '')

  const handleSave = async () => {
    setSaving(true)
    
    const basicInfo = {
      name,
      age: age ? parseInt(age) : undefined,
      height_cm: heightCm ? parseFloat(heightCm) : undefined,
      weight_kg: weightKg ? parseFloat(weightKg) : undefined,
      sex: (sex || undefined) as 'male' | 'female' | 'other' | undefined,
      activity_level: (activityLevel || undefined) as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | undefined,
    }

    const result = await updateUserBasicInfo(user.id, basicInfo, name, mobile || undefined)
    
    if (result.success) {
      onUpdate({
        ...user,
        profile: user.profile ? {
          ...user.profile,
          name,
          mobile: mobile || null,
          basic_info: { ...user.profile.basic_info, ...basicInfo },
        } : null,
      })
    }
    
    setSaving(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
        <CardDescription>
          User's personal details used for calculating nutritional needs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="User's name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              min={1}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Years"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="height">Height (cm)</Label>
            <Input
              id="height"
              type="number"
              min={50}
              max={300}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="Height in cm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input
              id="weight"
              type="number"
              min={20}
              max={500}
              step={0.1}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="Weight in kg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobile">Mobile</Label>
            <PhoneInput
              value={mobile}
              onChange={setMobile}
              placeholder="e.g., +971 50 123 4567"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sex">Sex</Label>
            <Select value={sex} onValueChange={setSex}>
              <SelectTrigger id="sex">
                <SelectValue placeholder="Select sex" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="activity">Activity Level</Label>
            <Select value={activityLevel} onValueChange={setActivityLevel}>
              <SelectTrigger id="activity">
                <SelectValue placeholder="Select activity level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">Sedentary (little or no exercise)</SelectItem>
                <SelectItem value="light">Light (1-3 days/week)</SelectItem>
                <SelectItem value="moderate">Moderate (3-5 days/week)</SelectItem>
                <SelectItem value="active">Active (6-7 days/week)</SelectItem>
                <SelectItem value="very_active">Very Active (hard exercise daily)</SelectItem>
              </SelectContent>
            </Select>
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
