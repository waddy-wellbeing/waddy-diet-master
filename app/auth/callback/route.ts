import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Auth callback route handler.
 *
 * Handles two Supabase email link formats:
 *  1. PKCE flow  — ?code=xxx&next=/update-password
 *  2. OTP flow   — ?token_hash=xxx&type=recovery&next=/update-password
 *
 * Hash-fragment tokens (#access_token=…) never reach the server;
 * those are handled client-side in update-password-form.tsx via
 * onAuthStateChange('PASSWORD_RECOVERY').
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'

  const supabase = await createClient()

  // --- PKCE flow (code) ---
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = next
      redirectUrl.searchParams.delete('code')
      redirectUrl.searchParams.delete('next')
      return NextResponse.redirect(redirectUrl)
    }
  }

  // --- OTP / token_hash flow (used by some Supabase configs & older email templates) ---
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as Parameters<typeof supabase.auth.verifyOtp>[0]['type'],
    })

    if (!error) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = next
      redirectUrl.searchParams.delete('token_hash')
      redirectUrl.searchParams.delete('type')
      redirectUrl.searchParams.delete('next')
      return NextResponse.redirect(redirectUrl)
    }
  }

  // If all exchange attempts failed, redirect to login with error
  const errorUrl = request.nextUrl.clone()
  errorUrl.pathname = '/login'
  errorUrl.searchParams.set('error', 'auth_callback_failed')
  errorUrl.searchParams.delete('code')
  errorUrl.searchParams.delete('token_hash')
  errorUrl.searchParams.delete('type')
  errorUrl.searchParams.delete('next')
  return NextResponse.redirect(errorUrl)
}
