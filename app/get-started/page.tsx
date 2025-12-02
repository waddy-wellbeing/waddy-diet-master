import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Get Started | Waddy Diet Master',
  description: 'Start your personalized nutrition journey',
}

export default async function GetStartedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If user is logged in, redirect appropriately
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profile?.onboarding_completed) {
      redirect('/dashboard')
    } else {
      redirect('/onboarding')
    }
  }

  // Guest user - go directly to onboarding flow
  redirect('/get-started/onboarding')
}
