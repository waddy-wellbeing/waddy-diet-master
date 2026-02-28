'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { updatePasswordSchema, type UpdatePasswordFormData } from '@/lib/validators/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

/**
 * UpdatePasswordForm
 *
 * Handles password reset across ALL delivery mechanisms Supabase uses:
 *
 * 1. PKCE flow  (/auth/callback?code=…  → sets cookie → redirects here)
 *    → supabase.auth.getUser() returns the user immediately.
 *
 * 2. OTP flow   (/auth/callback?token_hash=…  → sets cookie → redirects here)
 *    → same as above after the callback exchange.
 *
 * 3. Hash fragment  (#access_token=…&type=recovery)
 *    → Never hits the server; @supabase/ssr automatically parses it
 *      client-side and fires PASSWORD_RECOVERY via onAuthStateChange.
 *
 * On iOS the session cookie may not yet be visible to the server when the
 * page first renders (new browser tab from mail app), so we intentionally
 * skip the server-side auth guard and do all gating here with getUser().
 */
export function UpdatePasswordForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  // null = checking, true = ready, false = no valid session found
  const [sessionReady, setSessionReady] = useState<boolean | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema),
  })

  useEffect(() => {
    const supabase = createClient()

    // First, check if a session already exists (covers PKCE + OTP flows
    // where the callback route already set the cookie before redirecting here)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setSessionReady(true)
        return
      }

      // No session yet — listen for the PASSWORD_RECOVERY event which fires
      // when the Supabase JS client parses the #access_token hash fragment.
      // This is the path taken on iOS Safari when Mail opens a new tab.
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event) => {
          if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
            setSessionReady(true)
            subscription.unsubscribe()
          }
        }
      )

      // Give it 8 seconds before showing the link-expired message
      const timeout = setTimeout(() => {
        setSessionReady((prev) => {
          if (prev === null) return false
          return prev
        })
        subscription.unsubscribe()
      }, 8000)

      return () => {
        clearTimeout(timeout)
        subscription.unsubscribe()
      }
    })
  }, [])

  async function onSubmit(data: UpdatePasswordFormData) {
    setIsLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({ password: data.password })

    if (error) {
      toast.error(error.message)
      setIsLoading(false)
      return
    }

    toast.success('Password updated successfully! ⚡')
    router.push('/dashboard')
    router.refresh()
  }

  // Loading state while we wait for the session
  if (sessionReady === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Verifying your reset link…</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Link expired / invalid — no valid session found
  if (sessionReady === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">⚡</span>
              <span className="font-bold text-primary">Waddy</span>
            </div>
            <CardTitle className="text-2xl font-bold">Link expired</CardTitle>
            <CardDescription>
              This password reset link has expired or already been used.
              Please request a new one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/forgot-password">Request new reset link</Link>
            </Button>
            <div className="text-center text-sm">
              <Link href="/login" className="text-primary hover:underline">
                Back to sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Session valid — show the password update form
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">⚡</span>
            <span className="font-bold text-primary">Waddy</span>
          </div>
          <CardTitle className="text-2xl font-bold">Set new password</CardTitle>
          <CardDescription>
            Enter your new password below. Make sure it&apos;s at least 6 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                {...register('password')}
                aria-invalid={errors.password ? 'true' : 'false'}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                {...register('confirmPassword')}
                aria-invalid={errors.confirmPassword ? 'true' : 'false'}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating…
                </>
              ) : (
                'Update password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
