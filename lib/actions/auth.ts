'use server'

import { createClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/utils/site-url'

export async function sendPasswordResetEmail(email: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/update-password`,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
