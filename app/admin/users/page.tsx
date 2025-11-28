import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Manage user accounts and roles
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            User management features coming soon
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This page will include:
          </p>
          <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>View all users with their roles</li>
            <li>Change user roles (admin, moderator, client)</li>
            <li>User activity logs</li>
            <li>Account management</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
