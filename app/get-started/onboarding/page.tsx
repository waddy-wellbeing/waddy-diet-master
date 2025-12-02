import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GuestOnboardingFlow } from '@/components/onboarding/guest-onboarding-flow'

export const metadata: Metadata = {
  title: 'Set Up Your Plan | Waddy Diet Master',
  description: 'Create your personalized nutrition plan',
}

export default async function GuestOnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If user is logged in, redirect to proper onboarding
  if (user) {
    redirect('/onboarding')
  }

  return <GuestOnboardingFlow />
}
