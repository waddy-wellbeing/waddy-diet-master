import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { OnboardingContent } from './onboarding-content'

export const metadata: Metadata = {
  title: 'Get Started | Waddy Diet Master',
  description: 'Set up your personalized nutrition plan',
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Not logged in - redirect to guest onboarding
    redirect('/get-started')
  }

  // Check if user has already completed onboarding
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .single()

  if (profile?.onboarding_completed) {
    redirect('/dashboard')
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <OnboardingContent />
    </Suspense>
  )
}
