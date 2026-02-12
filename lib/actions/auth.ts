'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

/**
 * Get the site URL from the request headers (most reliable for Server Actions)
 */
async function getSiteUrlFromRequest(): Promise<string> {
  try {
    const headersList = await headers()
    
    // Get host and protocol from headers
    const host = headersList.get('host')
    const xForwardedProto = headersList.get('x-forwarded-proto')
    const xForwardedHost = headersList.get('x-forwarded-host')
    
    // Use x-forwarded headers if available (set by proxies/load balancers)
    const finalHost = xForwardedHost || host
    const finalProtocol = xForwardedProto || (finalHost?.includes('localhost') ? 'http' : 'https')
    
    if (finalHost) {
      return `${finalProtocol}://${finalHost}`
    }
  } catch (e) {
    console.error('Error reading headers:', e)
  }
  
  // Fallback to environment variables
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  
  // Last resort
  return 'https://app.waddyclub.com'
}

export async function sendPasswordResetEmail(email: string) {
  const supabase = await createClient()
  const siteUrl = await getSiteUrlFromRequest()

  console.log('[Reset Password] Site URL:', siteUrl)

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/update-password`,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
