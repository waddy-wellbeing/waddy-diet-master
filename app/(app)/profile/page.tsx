import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileContent } from './profile-content'
import type { Profile } from '@/lib/types/nutri'

export const metadata: Metadata = {
  title: 'Profile | Waddy Diet Master',
  description: 'Manage your profile and preferences',
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  return <ProfileContent profile={profile as Profile} userEmail={user.email || ''} />
}
