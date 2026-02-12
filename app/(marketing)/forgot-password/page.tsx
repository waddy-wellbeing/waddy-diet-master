'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/lib/validators/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  async function onSubmit(data: ForgotPasswordFormData) {
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: data.email }),
      })

      const result = await response.json()

      if (!result.success) {
        toast.error(result.error || 'Failed to send reset email')
        setIsLoading(false)
        return
      }

      setEmailSent(true)
      toast.success('Check your email for the reset link!')
    } catch (error) {
      toast.error('An error occurred. Please try again.')
      console.error('Reset password error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">⚡</span>
            <span className="font-bold text-primary">Waddy</span>
          </div>
          <CardTitle className="text-2xl font-bold">Reset your password</CardTitle>
          <CardDescription>
            {emailSent
              ? 'We sent you an email with a reset link. Check your inbox.'
              : "Enter your email and we'll send you a link to reset your password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <div className="space-y-4">
              <div className="p-3 bg-primary/10 rounded-lg text-sm">
                <p className="font-medium text-primary">📧 Email sent!</p>
                <p className="text-muted-foreground mt-1">
                  If an account exists for that email, you&apos;ll receive a password reset link shortly.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setEmailSent(false)}
              >
                Send again
              </Button>
              <div className="text-center text-sm">
                <Link href="/login" className="text-primary hover:underline">
                  Back to sign in
                </Link>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send reset link'}
                </Button>
              </form>

              <div className="mt-4 text-center text-sm">
                Remember your password?{' '}
                <Link href="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
