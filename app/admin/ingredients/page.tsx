import { Suspense } from 'react'
import { getIngredients, getFoodGroups } from '@/lib/actions/ingredients'
import { IngredientsTable } from '@/components/admin/ingredients-table'
import { Skeleton } from '@/components/ui/skeleton'

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    foodGroup?: string
  }>
}

export default async function AdminIngredientsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = parseInt(params.page ?? '1', 10)
  const search = params.search ?? ''
  const foodGroup = params.foodGroup ?? ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ingredients</h1>
        <p className="text-muted-foreground">
          Manage the ingredients database
        </p>
      </div>

      <Suspense fallback={<IngredientsTableSkeleton />}>
        <IngredientsTableWrapper
          page={page}
          search={search}
          foodGroup={foodGroup}
        />
      </Suspense>
    </div>
  )
}

async function IngredientsTableWrapper({
  page,
  search,
  foodGroup,
}: {
  page: number
  search: string
  foodGroup: string
}) {
  const [ingredientsResult, foodGroups] = await Promise.all([
    getIngredients({ page, search, foodGroup, pageSize: 20 }),
    getFoodGroups(),
  ])

  return (
    <IngredientsTable
      ingredients={ingredientsResult.ingredients}
      total={ingredientsResult.total}
      page={page}
      pageSize={20}
      foodGroups={foodGroups}
    />
  )
}

function IngredientsTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Toolbar skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-10 w-20" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-[180px]" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border bg-card">
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex gap-4">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[80px]" />
            <Skeleton className="h-4 w-[60px]" />
            <Skeleton className="h-4 w-[60px]" />
            <Skeleton className="h-4 w-[60px]" />
            <Skeleton className="h-4 w-[60px]" />
          </div>
          {/* Rows */}
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex gap-4 py-2">
              <Skeleton className="h-5 w-[250px]" />
              <Skeleton className="h-5 w-[100px]" />
              <Skeleton className="h-5 w-[80px]" />
              <Skeleton className="h-5 w-[60px]" />
              <Skeleton className="h-5 w-[60px]" />
              <Skeleton className="h-5 w-[60px]" />
              <Skeleton className="h-5 w-[60px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
