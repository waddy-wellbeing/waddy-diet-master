'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { signupSchema, type SignupFormData } from '@/lib/validators/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { hasGuestCompletedOnboarding } from '@/lib/utils/guest-storage'
import { toast } from 'sonner'

export function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasGuestData, setHasGuestData] = useState(false)
  const fromOnboarding = searchParams.get('from') === 'onboarding'

  useEffect(() => {
    setHasGuestData(hasGuestCompletedOnboarding())
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  })

  async function onSubmit(data: SignupFormData) {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: undefined,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setIsLoading(false)
      return
    }

    // Check if the user was created and has a session (auto-confirm enabled)
    const hasSession = !!signUpData.session
    
    if (!hasSession) {
      // Email confirmation required
      toast.success('Check your email to confirm your account!')
      setIsLoading(false)
      return
    }

    // User is auto-confirmed, redirect to onboarding
    // The onboarding flow will handle everything as an authenticated user
    toast.success('Account created! Let\'s set up your plan ⚡')
    router.push('/onboarding')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">⚡</span>
            <span className="font-bold text-primary">Waddy</span>
          </div>
          <CardTitle className="text-2xl font-bold">
            {hasGuestData ? 'Save Your Plan' : 'Create an account'}
          </CardTitle>
          <CardDescription>
            {hasGuestData
              ? 'Create an account to save your personalized plan'
              : 'Enter your email and create a password to get started'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasGuestData && (
            <div className="mb-4 p-3 bg-primary/10 rounded-lg text-sm">
              <p className="font-medium text-primary">✓ Your plan is ready!</p>
              <p className="text-muted-foreground">Sign up to save it and start tracking.</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register('email')}
                aria-invalid={errors.email ? 'true' : 'false'}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
              <Label htmlFor="confirmPassword">Confirm Password</Label>
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
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
