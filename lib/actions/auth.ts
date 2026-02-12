'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

/**
 * Get the site URL from the request headers (most reliable for Server Actions)
 */
async function getSiteUrlFromRequest(): Promise<string> {
  const headersList = await headers()
  
  // Try to get the host from headers (works in all environments)
  const host = headersList.get('host')
  const protocol = headersList.get('x-forwarded-proto') || 'https'
  
  if (host) {
    // On localhost, use http, otherwise use https
    const finalProtocol = host.includes('localhost') ? 'http' : protocol
    return `${finalProtocol}://${host}`
  }
  
  // Fallback to environment variables
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  
  // Last resort fallback
  return 'http://localhost:3000'
}

export async function sendPasswordResetEmail(email: string) {
  const supabase = await createClient()
  const siteUrl = await getSiteUrlFromRequest()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/update-password`,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
