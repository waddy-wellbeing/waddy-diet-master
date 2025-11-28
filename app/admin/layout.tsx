import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { AdminSidebar, MobileNav } from '@/components/admin/sidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()

  // Redirect if not authenticated
  if (!user) {
    redirect('/login?redirect=/admin')
  }

  // Redirect if not admin or moderator
  if (!user.profile || (user.profile.role !== 'admin' && user.profile.role !== 'moderator')) {
    redirect('/dashboard')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      {/* Desktop Sidebar */}
      <AdminSidebar
        userEmail={user.email}
        userRole={user.profile.role}
      />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden">
          <MobileNav
            userEmail={user.email}
            userRole={user.profile.role}
          />
          <h1 className="font-semibold">BiteRight Admin</h1>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
