'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'
import { loadGuestOnboardingData, clearGuestOnboardingData, hasGuestCompletedOnboarding, type GuestOnboardingData } from '@/lib/utils/guest-storage'

export function OnboardingContent() {
  const searchParams = useSearchParams()
  const [isReady, setIsReady] = useState(false)
  const [guestData, setGuestData] = useState<GuestOnboardingData | null>(null)

  useEffect(() => {
    // Check if there's completed guest onboarding data
    if (hasGuestCompletedOnboarding()) {
      const data = loadGuestOnboardingData()
      if (data) {
        console.log('Found completed guest onboarding data, pre-filling form...')
        setGuestData(data)
      }
    }
    setIsReady(true)
  }, [])

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <OnboardingFlow 
      initialData={guestData || undefined}
      onComplete={() => {
        // Clear guest data after successful save
        clearGuestOnboardingData()
      }}
    />
  )
}
