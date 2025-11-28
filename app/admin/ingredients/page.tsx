import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminIngredientsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ingredients</h1>
        <p className="text-muted-foreground">
          Manage the ingredients database
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ingredient Management</CardTitle>
          <CardDescription>
            Full CRUD for ingredients coming in Phase 4
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This page will include:
          </p>
          <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Ingredient list with search by name and food group</li>
            <li>Create/edit ingredient form with macro/micro editing</li>
            <li>Bulk CSV import</li>
            <li>Duplicate detection</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
