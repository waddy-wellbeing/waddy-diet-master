import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UtensilsCrossed, Carrot, Leaf, Users } from 'lucide-react'

async function getStats() {
  const supabase = await createClient()

  const [recipesResult, ingredientsResult, spicesResult, usersResult] = await Promise.all([
    supabase.from('recipes').select('id', { count: 'exact', head: true }),
    supabase.from('ingredients').select('id', { count: 'exact', head: true }),
    supabase.from('spices').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ])

  return {
    recipes: recipesResult.count ?? 0,
    ingredients: ingredientsResult.count ?? 0,
    spices: spicesResult.count ?? 0,
    users: usersResult.count ?? 0,
  }
}

export default async function AdminDashboardPage() {
  const stats = await getStats()

  const statCards = [
    {
      title: 'Total Recipes',
      value: stats.recipes,
      description: 'Recipes in the database',
      icon: UtensilsCrossed,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Ingredients',
      value: stats.ingredients,
      description: 'Available ingredients',
      icon: Carrot,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Spices',
      value: stats.spices,
      description: 'Spices & seasonings',
      icon: Leaf,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'Users',
      value: stats.users,
      description: 'Registered users',
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your BiteRight admin panel
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common admin tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <QuickActionLink href="/admin/recipes" label="Manage Recipes" />
            <QuickActionLink href="/admin/ingredients" label="Manage Ingredients" />
            <QuickActionLink href="/admin/spices" label="Manage Spices" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Activity feed coming soon...
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Database and services health</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm">All systems operational</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function QuickActionLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
    >
      <span>{label}</span>
      <span className="text-muted-foreground">→</span>
    </a>
  )
}
