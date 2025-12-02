import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Not logged in - redirect to get started page
    redirect('/get-started')
  }

  // Check if user has completed onboarding
  // Use maybeSingle() to handle new users without a profile yet
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