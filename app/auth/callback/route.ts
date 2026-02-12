import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Auth callback route handler.
 * Exchanges the `code` from Supabase email links (password reset, magic link, etc.)
 * for a session, then redirects to the target page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Successful code exchange — redirect to the intended destination
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = next
      redirectUrl.searchParams.delete('code')
      redirectUrl.searchParams.delete('next')
      return NextResponse.redirect(redirectUrl)
    }
  }

  // If code exchange failed or no code, redirect to an error page
  const errorUrl = request.nextUrl.clone()
  errorUrl.pathname = '/login'
  errorUrl.searchParams.set('error', 'auth_callback_failed')
  errorUrl.searchParams.delete('code')
  errorUrl.searchParams.delete('next')
  return NextResponse.redirect(errorUrl)
}
