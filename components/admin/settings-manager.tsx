'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertCircle,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Settings2,
  Percent,
  Calculator,
  Scale,
  Target,
} from 'lucide-react'
import { updateSystemSetting, createSystemSetting, deleteSystemSetting } from '@/lib/actions/settings'
import type { SystemSettingRecord } from '@/lib/types/nutri'
import { cn } from '@/lib/utils'

interface SettingsManagerProps {
  initialSettings: SystemSettingRecord[]
}

// Setting metadata for display
const settingMeta: Record<string, { 
  label: string
  icon: React.ElementType
  category: 'distribution' | 'limits' | 'defaults' | 'macro'
  inputType: 'json' | 'number' | 'percent'
}> = {
  meal_distribution: {
    label: 'Meal Distribution',
    icon: Percent,
    category: 'distribution',
    inputType: 'json',
  },
  deviation_tolerance: {
    label: 'Deviation Tolerance',
    icon: Scale,
    category: 'limits',
    inputType: 'percent',
  },
  default_meals_per_day: {
    label: 'Default Meals/Day',
    icon: Settings2,
    category: 'defaults',
    inputType: 'number',
  },
  default_snacks_per_day: {
    label: 'Default Snacks/Day',
    icon: Settings2,
    category: 'defaults',
    inputType: 'number',
  },
  min_calories_per_day: {
    label: 'Min Calories/Day',
    icon: Calculator,
    category: 'limits',
    inputType: 'number',
  },
  max_calories_per_day: {
    label: 'Max Calories/Day',
    icon: Calculator,
    category: 'limits',
    inputType: 'number',
  },
  scaling_limits: {
    label: 'Scaling Limits',
    icon: Scale,
    category: 'limits',
    inputType: 'json',
  },
  macro_similarity_weights: {
    label: 'Macro Similarity Weights',
    icon: Target,
    category: 'macro',
    inputType: 'json',
  },
  min_macro_similarity_threshold: {
    label: 'Min Macro Similarity',
    icon: Target,
    category: 'macro',
    inputType: 'number',
  },
}

function formatValue(value: unknown): string {
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

function parseValue(inputType: 'json' | 'number' | 'percent', rawValue: string): unknown {
  if (inputType === 'json') {
    return JSON.parse(rawValue)
  }
  if (inputType === 'number' || inputType === 'percent') {
    return parseFloat(rawValue)
  }
  return rawValue
}

function validateMealDistribution(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return 'Must be a valid JSON object'
  }
  const dist = value as Record<string, number>
  const total = (dist.breakfast || 0) + (dist.lunch || 0) + (dist.dinner || 0) + (dist.snacks || 0)
  if (Math.abs(total - 1.0) > 0.001) {
    return `Percentages must sum to 1.0 (currently ${total.toFixed(2)})`
  }
  return null
}

export function SettingsManager({ initialSettings }: SettingsManagerProps) {
  const [settings, setSettings] = useState<SystemSettingRecord[]>(initialSettings)
  const [editingSetting, setEditingSetting] = useState<SystemSettingRecord | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newDescription, setNewDescription] = useState('')

  // Group settings by category
  const distributionSettings = settings.filter(s => settingMeta[s.key]?.category === 'distribution')
  const limitSettings = settings.filter(s => settingMeta[s.key]?.category === 'limits')
  const defaultSettings = settings.filter(s => settingMeta[s.key]?.category === 'defaults')
  const macroSettings = settings.filter(s => settingMeta[s.key]?.category === 'macro')
  const otherSettings = settings.filter(s => !settingMeta[s.key])

  function handleEdit(setting: SystemSettingRecord) {
    setEditingSetting(setting)
    setEditValue(formatValue(setting.value))
    setEditDescription(setting.description || '')
    setError(null)
  }

  async function handleSave() {
    if (!editingSetting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const meta = settingMeta[editingSetting.key]
      const inputType = meta?.inputType || 'json'
      const parsedValue = parseValue(inputType, editValue)

      // Validate meal distribution
      if (editingSetting.key === 'meal_distribution') {
        const validationError = validateMealDistribution(parsedValue)
        if (validationError) {
          setError(validationError)
          setIsSubmitting(false)
          return
        }
      }

      const result = await updateSystemSetting(
        editingSetting.key,
        parsedValue,
        editDescription
      )

      if (!result.success) {
        setError(result.error || 'Failed to update setting')
        setIsSubmitting(false)
        return
      }

      // Update local state
      setSettings(prev => prev.map(s => 
        s.key === editingSetting.key 
          ? { ...s, value: parsedValue, description: editDescription }
          : s
      ))

      setSuccess(`Updated ${editingSetting.key}`)
      setEditingSetting(null)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid value')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCreate() {
    if (!newKey.trim()) {
      setError('Key is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const parsedValue = JSON.parse(newValue)
      const result = await createSystemSetting(newKey, parsedValue, newDescription)

      if (!result.success) {
        setError(result.error || 'Failed to create setting')
        setIsSubmitting(false)
        return
      }

      // Add to local state
      setSettings(prev => [...prev, {
        key: newKey,
        value: parsedValue,
        description: newDescription,
        updated_at: new Date().toISOString(),
        updated_by: null,
      }])

      setSuccess(`Created ${newKey}`)
      setShowNewDialog(false)
      setNewKey('')
      setNewValue('')
      setNewDescription('')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON value')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(key: string) {
    if (!confirm(`Are you sure you want to delete "${key}"?`)) return

    const result = await deleteSystemSetting(key)
    if (result.success) {
      setSettings(prev => prev.filter(s => s.key !== key))
      setSuccess(`Deleted ${key}`)
      setTimeout(() => setSuccess(null), 3000)
    } else {
      setError(result.error || 'Failed to delete setting')
    }
  }

  function renderSettingCard(setting: SystemSettingRecord) {
    const meta = settingMeta[setting.key]
    const Icon = meta?.icon || Settings2

    return (
      <Card key={setting.key} className="relative">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">
                {meta?.label || setting.key}
              </CardTitle>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleEdit(setting)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {!meta && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(setting.key)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {setting.description && (
            <CardDescription>{setting.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {renderSettingValue(setting)}
        </CardContent>
      </Card>
    )
  }

  function renderSettingValue(setting: SystemSettingRecord) {
    const value = setting.value

    // Meal distribution - show as percentage bars
    if (setting.key === 'meal_distribution' && typeof value === 'object') {
      const dist = value as Record<string, number>
      return (
        <div className="space-y-2">
          {Object.entries(dist).map(([meal, pct]) => (
            <div key={meal} className="flex items-center gap-3">
              <span className="w-20 text-sm capitalize text-muted-foreground">
                {meal}
              </span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full",
                    meal === 'breakfast' && 'bg-amber-500',
                    meal === 'lunch' && 'bg-green-500',
                    meal === 'dinner' && 'bg-blue-500',
                    meal === 'snacks' && 'bg-purple-500',
                  )}
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
              <span className="w-12 text-sm text-right font-medium">
                {(pct * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )
    }

    // Scaling limits
    if (setting.key === 'scaling_limits' && typeof value === 'object') {
      const limits = value as { min_scale_factor: number; max_scale_factor: number }
      return (
        <div className="flex gap-4">
          <Badge variant="outline">Min: {limits.min_scale_factor}x</Badge>
          <Badge variant="outline">Max: {limits.max_scale_factor}x</Badge>
        </div>
      )
    }

    // Percentage values
    if (setting.key === 'deviation_tolerance') {
      const num = typeof value === 'number' ? value : parseFloat(String(value))
      return (
        <Badge variant="secondary" className="text-base">
          ±{(num * 100).toFixed(0)}%
        </Badge>
      )
    }

    // Simple number values
    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)))) {
      const num = typeof value === 'number' ? value : parseFloat(value)
      return (
        <Badge variant="secondary" className="text-base">
          {num.toLocaleString()}
        </Badge>
      )
    }

    // JSON objects
    return (
      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          <Check className="h-4 w-4" />
          <span className="text-sm">{success}</span>
        </div>
      )}

      {error && !editingSetting && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Meal Distribution Section */}
      {distributionSettings.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Calorie Distribution
          </h2>
          <div className="grid gap-4">
            {distributionSettings.map(renderSettingCard)}
          </div>
        </section>
      )}

      {/* Limits Section */}
      {limitSettings.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Limits & Tolerances
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {limitSettings.map(renderSettingCard)}
          </div>
        </section>
      )}

      {/* Defaults Section */}
      {defaultSettings.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Default Values
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {defaultSettings.map(renderSettingCard)}
          </div>
        </section>
      )}

      {/* Macro Similarity Settings */}
      {macroSettings.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Target className="h-5 w-5" />
            Macro Comparison
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Configure how recipe and ingredient alternatives are scored based on macronutrient similarity
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {macroSettings.map(renderSettingCard)}
          </div>
        </section>
      )}

      {/* Other/Custom Settings */}
      {otherSettings.length > 0 && (
        <section>
          <Separator className="my-6" />
          <h2 className="text-lg font-semibold mb-3">Custom Settings</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {otherSettings.map(renderSettingCard)}
          </div>
        </section>
      )}

      {/* Add New Button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setShowNewDialog(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Custom Setting
      </Button>

      {/* Edit Dialog */}
      <Dialog open={!!editingSetting} onOpenChange={() => setEditingSetting(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Edit {settingMeta[editingSetting?.key || '']?.label || editingSetting?.key}
            </DialogTitle>
            <DialogDescription>
              Update the value for this system setting
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              {settingMeta[editingSetting?.key || '']?.inputType === 'json' ? (
                <Textarea
                  id="value"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={6}
                  className="font-mono text-sm"
                />
              ) : (
                <Input
                  id="value"
                  type="number"
                  step={settingMeta[editingSetting?.key || '']?.inputType === 'percent' ? '0.01' : '1'}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                />
              )}
              {settingMeta[editingSetting?.key || '']?.inputType === 'percent' && (
                <p className="text-xs text-muted-foreground">
                  Enter as decimal (e.g., 0.25 for 25%)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSetting(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Setting Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Custom Setting</DialogTitle>
            <DialogDescription>
              Create a new system setting with a unique key
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="newKey">Key</Label>
              <Input
                id="newKey"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="my_custom_setting"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newValue">Value (JSON)</Label>
              <Textarea
                id="newValue"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                rows={4}
                className="font-mono text-sm"
                placeholder='{"key": "value"}'
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newDescription">Description</Label>
              <Textarea
                id="newDescription"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                placeholder="What this setting controls..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Setting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
