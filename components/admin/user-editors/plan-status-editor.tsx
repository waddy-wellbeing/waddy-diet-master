"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updatePlanStatus } from "@/lib/actions/users"
import type { UserWithProfile } from "@/lib/actions/users"
import { Loader2, Save, ClipboardList, CheckCircle, Clock, XCircle, Pause } from "lucide-react"

interface PlanStatusEditorProps {
  user: UserWithProfile
  onUpdate?: (user: UserWithProfile) => void
}

const PLAN_STATUSES = [
  { 
    value: "pending_assignment", 
    label: "Pending Assignment", 
    icon: Clock, 
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    description: "User completed onboarding, waiting for plan assignment"
  },
  { 
    value: "active", 
    label: "Active", 
    icon: CheckCircle, 
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    description: "User has an active meal plan"
  },
  { 
    value: "paused", 
    label: "Paused", 
    icon: Pause, 
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    description: "Plan temporarily paused by user or admin"
  },
  { 
    value: "expired", 
    label: "Expired", 
    icon: XCircle, 
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    description: "Plan has expired"
  },
] as const

type PlanStatusValue = 'pending_assignment' | 'active' | 'paused' | 'expired'

export function PlanStatusEditor({ user, onUpdate }: PlanStatusEditorProps) {
  const [status, setStatus] = useState<PlanStatusValue>(
    (user.profile?.plan_status as PlanStatusValue) || "pending_assignment"
  )
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    
    const result = await updatePlanStatus(user.id, status)
    
    setSaving(false)
    if (result.success) {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
      // Notify parent of update
      if (onUpdate) {
        onUpdate({
          ...user,
          profile: user.profile ? {
            ...user.profile,
            plan_status: status as import('@/lib/types/nutri').PlanStatus,
          } : null,
        })
      }
    }
  }

  const currentStatusInfo = PLAN_STATUSES.find(s => s.value === status)
  const CurrentIcon = currentStatusInfo?.icon || Clock

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Plan Status
        </CardTitle>
        <CardDescription>
          Manage the user&apos;s meal plan status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status Display */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Current Status</p>
          <div className={`flex items-center gap-3 p-4 rounded-lg ${currentStatusInfo?.bgColor}`}>
            <CurrentIcon className={`h-6 w-6 ${currentStatusInfo?.color}`} />
            <div>
              <p className="font-medium">{currentStatusInfo?.label}</p>
              <p className="text-sm text-muted-foreground">
                {currentStatusInfo?.description}
              </p>
            </div>
          </div>
        </div>

        {/* Status Selection */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Change Status</p>
          <Select value={status} onValueChange={(value: PlanStatusValue) => setStatus(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAN_STATUSES.map((statusOption) => {
                const Icon = statusOption.icon
                return (
                  <SelectItem key={statusOption.value} value={statusOption.value}>
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${statusOption.color}`} />
                      <span>{statusOption.label}</span>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Status Options Grid */}
        <div className="grid grid-cols-2 gap-2">
          {PLAN_STATUSES.map((statusOption) => {
            const Icon = statusOption.icon
            return (
              <button
                key={statusOption.value}
                type="button"
                onClick={() => setStatus(statusOption.value)}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                  status === statusOption.value
                    ? `border-primary ${statusOption.bgColor}`
                    : "border-muted hover:border-muted-foreground/50"
                }`}
              >
                <Icon className={`h-5 w-5 ${statusOption.color}`} />
                <div>
                  <p className="text-sm font-medium">{statusOption.label}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Onboarding Status */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-2">
          <h4 className="font-medium text-sm">Onboarding Status</h4>
          <div className="flex items-center gap-2">
            {user.profile?.onboarding_completed ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Completed</span>
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">
                  In Progress (Step {user.profile?.onboarding_step || 1})
                </span>
              </>
            )}
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving || status === user.profile?.plan_status}
          className="w-full"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating...
            </>
          ) : success ? (
            <>
              <Save className="mr-2 h-4 w-4" />
              Updated!
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Update Status
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
