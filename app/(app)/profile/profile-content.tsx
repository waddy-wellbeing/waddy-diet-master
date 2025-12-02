'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Mail,
  Ruler,
  Weight,
  Activity,
  Target,
  Utensils,
  Clock,
  ChefHat,
  Flame,
  Beef,
  Wheat,
  Droplet,
  ChevronRight,
  Edit3,
  Check,
  X,
  Calendar,
  TrendingUp,
  Zap,
  Settings,
  LogOut,
  Moon,
  Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Profile } from '@/lib/types/nutri'
import { updateProfile } from '@/lib/actions/profile'
import { ACTIVITY_LABELS, GOAL_LABELS } from '@/lib/utils/tdee'

interface ProfileContentProps {
  profile: Profile
  userEmail: string
}

type EditSection = 'basic' | 'goals' | 'activity' | 'preferences' | null

// Section Card Component
function SectionCard({
  title,
  icon: Icon,
  children,
  onEdit,
  isEditing,
  onSave,
  onCancel,
  isSaving,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  onEdit?: () => void
  isEditing?: boolean
  onSave?: () => void
  onCancel?: () => void
  isSaving?: boolean
}) {
  return (
    <motion.div
      className="bg-card rounded-2xl border border-border overflow-hidden"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold">{title}</h3>
        </div>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSaving}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              className="h-8 px-3"
            >
              {isSaving ? (
                <motion.div
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </Button>
          </div>
        ) : onEdit ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
          >
            <Edit3 className="w-4 h-4" />
          </Button>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </motion.div>
  )
}

// Info Row Component
function InfoRow({
  icon: Icon,
  label,
  value,
  color = 'text-muted-foreground',
}: {
  icon: React.ElementType
  label: string
  value: string | number | undefined
  color?: string
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <Icon className={cn('w-4 h-4', color)} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="font-medium">{value || '—'}</span>
    </div>
  )
}

// Macro Display Component
function MacroDisplay({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number | undefined
  unit: string
  color: string
}) {
  return (
    <div className="flex flex-col items-center p-3 bg-muted/30 rounded-xl">
      <Icon className={cn('w-5 h-5 mb-1', color)} />
      <p className="text-lg font-bold">{Math.round(value || 0)}{unit}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  )
}

// Select Option Component
function SelectOption({
  value,
  label,
  description,
  selected,
  onClick,
}: {
  value: string
  label: string
  description?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full p-3 rounded-xl border text-left transition-all',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50'
      )}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{label}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-3 h-3 text-primary-foreground" />
          </div>
        )}
      </div>
    </motion.button>
  )
}

export function ProfileContent({ profile, userEmail }: ProfileContentProps) {
  const [editSection, setEditSection] = useState<EditSection>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [basicInfo, setBasicInfo] = useState({
    name: profile.basic_info?.name || '',
    age: profile.basic_info?.age?.toString() || '',
    height_cm: profile.basic_info?.height_cm?.toString() || '',
    weight_kg: profile.basic_info?.weight_kg?.toString() || '',
    sex: profile.basic_info?.sex || 'male',
  })

  const [activityLevel, setActivityLevel] = useState(
    profile.basic_info?.activity_level || 'moderate'
  )

  const [goals, setGoals] = useState({
    goal_type: profile.goals?.goal_type || 'maintain',
    target_weight_kg: profile.goals?.target_weight_kg?.toString() || '',
    pace: profile.goals?.pace || 'moderate',
  })

  const [preferences, setPreferences] = useState({
    cooking_skill: profile.preferences?.cooking_skill || 'beginner',
    max_prep_time_minutes: profile.preferences?.max_prep_time_minutes || 30,
    meals_per_day: profile.preferences?.meals_per_day || 3,
  })

  const handleSave = async (section: EditSection) => {
    if (!section) return
    
    setIsSaving(true)
    setError(null)

    try {
      let updateData: Parameters<typeof updateProfile>[0] = {}

      switch (section) {
        case 'basic':
          updateData = {
            basic_info: {
              name: basicInfo.name,
              age: parseInt(basicInfo.age) || undefined,
              height_cm: parseFloat(basicInfo.height_cm) || undefined,
              weight_kg: parseFloat(basicInfo.weight_kg) || undefined,
              sex: basicInfo.sex as 'male' | 'female' | 'other',
            },
          }
          break
        case 'activity':
          updateData = { activity_level: activityLevel }
          break
        case 'goals':
          updateData = {
            goals: {
              goal_type: goals.goal_type as 'lose_weight' | 'maintain' | 'build_muscle' | 'recomposition',
              target_weight_kg: parseFloat(goals.target_weight_kg) || undefined,
              pace: goals.pace as 'slow' | 'moderate' | 'aggressive',
            },
          }
          break
        case 'preferences':
          updateData = {
            preferences: {
              cooking_skill: preferences.cooking_skill as 'beginner' | 'intermediate' | 'advanced',
              max_prep_time_minutes: preferences.max_prep_time_minutes,
              meals_per_day: preferences.meals_per_day as 3 | 4 | 5,
            },
          }
          break
      }

      const result = await updateProfile(updateData)
      
      if (!result.success) {
        setError(result.error || 'Failed to save')
        return
      }

      setEditSection(null)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  const cancelEdit = () => {
    // Reset to original values
    setBasicInfo({
      name: profile.basic_info?.name || '',
      age: profile.basic_info?.age?.toString() || '',
      height_cm: profile.basic_info?.height_cm?.toString() || '',
      weight_kg: profile.basic_info?.weight_kg?.toString() || '',
      sex: profile.basic_info?.sex || 'male',
    })
    setActivityLevel(profile.basic_info?.activity_level || 'moderate')
    setGoals({
      goal_type: profile.goals?.goal_type || 'maintain',
      target_weight_kg: profile.goals?.target_weight_kg?.toString() || '',
      pace: profile.goals?.pace || 'moderate',
    })
    setPreferences({
      cooking_skill: profile.preferences?.cooking_skill || 'beginner',
      max_prep_time_minutes: profile.preferences?.max_prep_time_minutes || 30,
      meals_per_day: profile.preferences?.meals_per_day || 3,
    })
    setEditSection(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 pb-24">
      {/* Header with Avatar */}
      <div className="relative pt-8 pb-6 px-4">
        <div className="flex flex-col items-center">
          <motion.div
            className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-4 shadow-lg"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-4xl font-bold text-primary-foreground">
                {(profile.basic_info?.name || userEmail || 'U').charAt(0).toUpperCase()}
              </span>
            )}
          </motion.div>
          <motion.h1
            className="text-2xl font-bold"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {profile.basic_info?.name || 'User'}
          </motion.h1>
          <motion.p
            className="text-muted-foreground flex items-center gap-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Mail className="w-3 h-3" />
            {userEmail}
          </motion.p>
        </div>
      </div>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-4 mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="px-4 space-y-4">
        {/* Daily Targets Card - Read Only */}
        <SectionCard title="Daily Targets" icon={Target}>
          <div className="grid grid-cols-4 gap-2">
            <MacroDisplay
              icon={Flame}
              label="Calories"
              value={profile.targets?.daily_calories}
              unit=""
              color="text-primary"
            />
            <MacroDisplay
              icon={Beef}
              label="Protein"
              value={profile.targets?.protein_g}
              unit="g"
              color="text-primary"
            />
            <MacroDisplay
              icon={Wheat}
              label="Carbs"
              value={profile.targets?.carbs_g}
              unit="g"
              color="text-amber-500"
            />
            <MacroDisplay
              icon={Droplet}
              label="Fat"
              value={profile.targets?.fat_g}
              unit="g"
              color="text-blue-500"
            />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Targets are calculated based on your stats and goals
          </p>
        </SectionCard>

        {/* Basic Info Card */}
        <SectionCard
          title="Personal Info"
          icon={User}
          onEdit={() => setEditSection('basic')}
          isEditing={editSection === 'basic'}
          onSave={() => handleSave('basic')}
          onCancel={cancelEdit}
          isSaving={isSaving}
        >
          {editSection === 'basic' ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={basicInfo.name}
                  onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })}
                  placeholder="Your name"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={basicInfo.age}
                    onChange={(e) => setBasicInfo({ ...basicInfo, age: e.target.value })}
                    placeholder="Age"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Sex</Label>
                  <div className="flex gap-2 mt-1">
                    {(['male', 'female'] as const).map((sex) => (
                      <button
                        key={sex}
                        type="button"
                        onClick={() => setBasicInfo({ ...basicInfo, sex })}
                        className={cn(
                          'flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all',
                          basicInfo.sex === sex
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        {sex === 'male' ? 'Male' : 'Female'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    value={basicInfo.height_cm}
                    onChange={(e) => setBasicInfo({ ...basicInfo, height_cm: e.target.value })}
                    placeholder="175"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    value={basicInfo.weight_kg}
                    onChange={(e) => setBasicInfo({ ...basicInfo, weight_kg: e.target.value })}
                    placeholder="70"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              <InfoRow icon={User} label="Name" value={profile.basic_info?.name} />
              <InfoRow icon={Calendar} label="Age" value={profile.basic_info?.age ? `${profile.basic_info.age} years` : undefined} />
              <InfoRow icon={Ruler} label="Height" value={profile.basic_info?.height_cm ? `${profile.basic_info.height_cm} cm` : undefined} />
              <InfoRow icon={Weight} label="Weight" value={profile.basic_info?.weight_kg ? `${profile.basic_info.weight_kg} kg` : undefined} />
            </div>
          )}
        </SectionCard>

        {/* Activity Level Card */}
        <SectionCard
          title="Activity Level"
          icon={Activity}
          onEdit={() => setEditSection('activity')}
          isEditing={editSection === 'activity'}
          onSave={() => handleSave('activity')}
          onCancel={cancelEdit}
          isSaving={isSaving}
        >
          {editSection === 'activity' ? (
            <div className="space-y-2">
              {(Object.keys(ACTIVITY_LABELS) as Array<keyof typeof ACTIVITY_LABELS>).map((level) => (
                <SelectOption
                  key={level}
                  value={level}
                  label={ACTIVITY_LABELS[level].label}
                  description={ACTIVITY_LABELS[level].description}
                  selected={activityLevel === level}
                  onClick={() => setActivityLevel(level)}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {profile.basic_info?.activity_level
                    ? ACTIVITY_LABELS[profile.basic_info.activity_level]?.label
                    : 'Not set'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {profile.basic_info?.activity_level
                    ? ACTIVITY_LABELS[profile.basic_info.activity_level]?.description
                    : 'Set your activity level'}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </SectionCard>

        {/* Goals Card */}
        <SectionCard
          title="Goals"
          icon={TrendingUp}
          onEdit={() => setEditSection('goals')}
          isEditing={editSection === 'goals'}
          onSave={() => handleSave('goals')}
          onCancel={cancelEdit}
          isSaving={isSaving}
        >
          {editSection === 'goals' ? (
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Goal Type</Label>
                <div className="space-y-2">
                  {(Object.keys(GOAL_LABELS) as Array<keyof typeof GOAL_LABELS>).map((goal) => (
                    <SelectOption
                      key={goal}
                      value={goal}
                      label={GOAL_LABELS[goal].label}
                      description={GOAL_LABELS[goal].description}
                      selected={goals.goal_type === goal}
                      onClick={() => setGoals({ ...goals, goal_type: goal })}
                    />
                  ))}
                </div>
              </div>
              {goals.goal_type !== 'maintain' && (
                <>
                  <div>
                    <Label htmlFor="targetWeight">Target Weight (kg)</Label>
                    <Input
                      id="targetWeight"
                      type="number"
                      value={goals.target_weight_kg}
                      onChange={(e) => setGoals({ ...goals, target_weight_kg: e.target.value })}
                      placeholder="65"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Pace</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['slow', 'moderate', 'aggressive'] as const).map((pace) => (
                        <button
                          key={pace}
                          type="button"
                          onClick={() => setGoals({ ...goals, pace })}
                          className={cn(
                            'py-2 px-3 rounded-lg border text-sm font-medium capitalize transition-all',
                            goals.pace === pace
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/50'
                          )}
                        >
                          {pace}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Goal</span>
                <span className="font-medium">
                  {profile.goals?.goal_type
                    ? GOAL_LABELS[profile.goals.goal_type]?.label
                    : 'Not set'}
                </span>
              </div>
              {profile.goals?.target_weight_kg && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Target Weight</span>
                  <span className="font-medium">{profile.goals.target_weight_kg} kg</span>
                </div>
              )}
              {profile.goals?.pace && profile.goals?.goal_type !== 'maintain' && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pace</span>
                  <span className="font-medium capitalize">{profile.goals.pace}</span>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* Preferences Card */}
        <SectionCard
          title="Preferences"
          icon={Utensils}
          onEdit={() => setEditSection('preferences')}
          isEditing={editSection === 'preferences'}
          onSave={() => handleSave('preferences')}
          onCancel={cancelEdit}
          isSaving={isSaving}
        >
          {editSection === 'preferences' ? (
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Cooking Skill</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['beginner', 'intermediate', 'advanced'] as const).map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => setPreferences({ ...preferences, cooking_skill: skill })}
                      className={cn(
                        'py-2 px-3 rounded-lg border text-sm font-medium capitalize transition-all',
                        preferences.cooking_skill === skill
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Max Prep Time: {preferences.max_prep_time_minutes} min</Label>
                <input
                  type="range"
                  min={10}
                  max={60}
                  step={5}
                  value={preferences.max_prep_time_minutes}
                  onChange={(e) => setPreferences({ ...preferences, max_prep_time_minutes: parseInt(e.target.value) })}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>10 min</span>
                  <span>60 min</span>
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Meals Per Day</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([3, 4, 5] as const).map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setPreferences({ ...preferences, meals_per_day: count })}
                      className={cn(
                        'py-2 px-3 rounded-lg border text-sm font-medium transition-all',
                        preferences.meals_per_day === count
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      {count} meals
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              <InfoRow
                icon={ChefHat}
                label="Cooking Skill"
                value={profile.preferences?.cooking_skill
                  ? profile.preferences.cooking_skill.charAt(0).toUpperCase() + profile.preferences.cooking_skill.slice(1)
                  : undefined}
              />
              <InfoRow
                icon={Clock}
                label="Max Prep Time"
                value={profile.preferences?.max_prep_time_minutes
                  ? `${profile.preferences.max_prep_time_minutes} min`
                  : undefined}
              />
              <InfoRow
                icon={Utensils}
                label="Meals Per Day"
                value={profile.preferences?.meals_per_day}
              />
            </div>
          )}
        </SectionCard>

        {/* Account Stats Card */}
        <SectionCard title="Account" icon={Settings}>
          <div className="divide-y divide-border/50">
            <InfoRow
              icon={Calendar}
              label="Member Since"
              value={new Date(profile.created_at).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })}
            />
            <InfoRow
              icon={Zap}
              label="Plan Status"
              value={profile.plan_status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            />
          </div>
        </SectionCard>

        {/* Settings Links */}
        <div className="space-y-2">
          <motion.button
            className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border"
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span>Notifications</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </motion.button>
          <motion.button
            className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border"
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 text-muted-foreground" />
              <span>Appearance</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </motion.button>
        </div>

        {/* Logout Button */}
        <form action="/auth/signout" method="POST">
          <Button
            type="submit"
            variant="outline"
            className="w-full text-red-500 border-red-500/20 hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  )
}
