import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { UpdatePasswordForm } from './update-password-form'

// This page is intentionally NOT a server component — the auth session
// from a password-reset link may arrive via a hash fragment or a fresh
// cookie that hasn't propagated to the server yet (common on iOS Safari).
// All auth gating is handled client-side in UpdatePasswordForm.
export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Loading…</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <UpdatePasswordForm />
    </Suspense>
  )
}
