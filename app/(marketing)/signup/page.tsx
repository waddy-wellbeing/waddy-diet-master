import { Suspense } from 'react'
import { SignupForm } from './signup-form'

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md h-96 bg-card rounded-xl animate-pulse" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}
