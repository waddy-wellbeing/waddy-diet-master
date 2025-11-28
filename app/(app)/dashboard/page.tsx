import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function DashboardPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  // If user is admin, show link to admin panel
  const isAdmin = user.profile?.role === 'admin' || user.profile?.role === 'moderator'

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Welcome back!</h1>
        <p className="text-muted-foreground">
          {user.email}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
            <CardDescription>
              {user.profile?.onboarding_completed 
                ? 'Your profile is set up'
                : 'Complete your onboarding to get started'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!user.profile?.onboarding_completed && (
              <Button asChild>
                <Link href="/onboarding">Complete Onboarding</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Admin Access</CardTitle>
              <CardDescription>
                You have {user.profile?.role} privileges
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/admin">Go to Admin Panel</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
