import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminPlansPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meal Plans</h1>
        <p className="text-muted-foreground">
          View and manage user meal plans
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meal Plan Analytics</CardTitle>
          <CardDescription>
            Plan management coming in Phase 6
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This page will include:
          </p>
          <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>View all user meal plans</li>
            <li>Plan analytics dashboard</li>
            <li>Popular recipes statistics</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
