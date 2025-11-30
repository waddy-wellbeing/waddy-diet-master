import { Suspense } from 'react'
import { getSystemSettings } from '@/lib/actions/settings'
import { SettingsManager } from '@/components/admin/settings-manager'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = {
  title: 'System Settings | BiteRight Admin',
  description: 'Manage system-wide settings for meal distribution and scaling',
}

async function SettingsContent() {
  const { data: settings, error } = await getSystemSettings()

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">Error loading settings: {error}</p>
      </div>
    )
  }

  return <SettingsManager initialSettings={settings || []} />
}

function SettingsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-lg border p-4">
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-4 w-full mb-3" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground">
          Configure meal distribution, scaling limits, and default values
        </p>
      </div>

      {/* Settings */}
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </div>
  )
}
