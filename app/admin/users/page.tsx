import { Suspense } from 'react'
import { getUsers } from '@/lib/actions/users'
import { UsersTable } from '@/components/admin/users-table'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = {
  title: 'Users | BiteRight Admin',
  description: 'Manage users and assign meal plans',
}

async function UsersContent() {
  const { data: users, count, error } = await getUsers()

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">Error loading users: {error}</p>
      </div>
    )
  }

  return <UsersTable initialUsers={users || []} initialCount={count} />
}

function UsersSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filter skeleton */}
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-48" />
      </div>
      
      {/* Stats skeleton */}
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      
      {/* Table skeleton */}
      <div className="rounded-lg border">
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20 ml-auto" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Manage user accounts and assign meal plans
        </p>
      </div>

      {/* Users Table */}
      <Suspense fallback={<UsersSkeleton />}>
        <UsersContent />
      </Suspense>
    </div>
  )
}
