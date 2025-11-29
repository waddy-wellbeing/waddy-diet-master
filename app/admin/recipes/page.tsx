import { Suspense } from 'react'
import { RecipesTable, RecipesTableSkeleton } from '@/components/admin/recipes-table'
import { getRecipes, getCuisines } from '@/lib/actions/recipes'

interface PageProps {
  searchParams: Promise<{
    search?: string
    page?: string
    mealType?: string
    cuisine?: string
  }>
}

async function RecipesTableWrapper({
  searchParams,
}: {
  searchParams: {
    search?: string
    page?: string
    mealType?: string
    cuisine?: string
  }
}) {
  const page = parseInt(searchParams.page ?? '1', 10)
  const pageSize = 20

  const [recipesResult, cuisinesResult] = await Promise.all([
    getRecipes({
      search: searchParams.search,
      page,
      pageSize,
      mealType: searchParams.mealType,
      cuisine: searchParams.cuisine,
    }),
    getCuisines(),
  ])

  if (recipesResult.error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Failed to load recipes: {recipesResult.error}
      </div>
    )
  }

  return (
    <RecipesTable
      recipes={recipesResult.recipes}
      total={recipesResult.total}
      page={page}
      pageSize={pageSize}
      cuisines={cuisinesResult}
    />
  )
}

export default async function AdminRecipesPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recipes</h1>
        <p className="text-muted-foreground">
          Manage all recipes in the database
        </p>
      </div>

      <Suspense fallback={<RecipesTableSkeleton />}>
        <RecipesTableWrapper searchParams={resolvedSearchParams} />
      </Suspense>
    </div>
  )
}
