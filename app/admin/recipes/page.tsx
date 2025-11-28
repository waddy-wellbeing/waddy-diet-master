import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminRecipesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recipes</h1>
        <p className="text-muted-foreground">
          Manage all recipes in the database
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recipe Management</CardTitle>
          <CardDescription>
            Full CRUD for recipes coming in Phase 3
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This page will include:
          </p>
          <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Recipe list with search and filters</li>
            <li>Create/edit recipe form</li>
            <li>Ingredient picker with nutrition calculation</li>
            <li>Image upload integration</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
