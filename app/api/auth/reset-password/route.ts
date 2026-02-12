import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Route Handler for sending password reset emails.
 * Uses request headers to build the correct redirect URL.
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get the host from request headers (most reliable)
    const host = request.headers.get('host')
    const protocol = request.nextUrl.protocol.replace(':', '')

    let siteUrl = 'https://app.waddyclub.com' // fallback

    if (host) {
      siteUrl = `${protocol}://${host}`
    } else if (process.env.NEXT_PUBLIC_SITE_URL) {
      siteUrl = process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
    } else if (process.env.VERCEL_URL) {
      siteUrl = `https://${process.env.VERCEL_URL}`
    }

    console.log('[Reset Password API] Site URL:', siteUrl)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/update-password`,
    })

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Reset Password API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
