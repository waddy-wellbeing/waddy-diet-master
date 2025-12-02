import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/app/navigation/bottom-nav'
import { PushNotificationPrompt } from '@/components/push-notification-prompt'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user has completed onboarding
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, onboarding_step')
    .eq('user_id', user.id)
    .single()

  // Get current path to determine if we're in onboarding
  // This will be handled by individual pages

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>
      {/* Only show bottom nav if onboarding is complete */}
      {profile?.onboarding_completed && <BottomNav />}
      {/* Push notification prompt - shows once per session for non-subscribed users */}
      {profile?.onboarding_completed && <PushNotificationPrompt />}
    </div>
  )
}
