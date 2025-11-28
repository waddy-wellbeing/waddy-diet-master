import { Suspense } from 'react'
import { getSpices } from '@/lib/actions/spices'
import { SpicesTable, SpicesTableSkeleton } from '@/components/admin/spices-table'

interface SpicesPageProps {
  searchParams: Promise<{
    page?: string
    search?: string
  }>
}

async function SpicesTableLoader({ searchParams }: SpicesPageProps) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const search = params.search || ''
  const pageSize = 20

  const { spices, total, error } = await getSpices({
    page,
    pageSize,
    search,
  })

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-destructive">Error loading spices: {error}</p>
      </div>
    )
  }

  return (
    <SpicesTable
      spices={spices}
      total={total}
      page={page}
      pageSize={pageSize}
    />
  )
}

export default async function AdminSpicesPage(props: SpicesPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Spices</h1>
        <p className="text-muted-foreground">
          Manage reference spices for recipe ingredients. These don&apos;t contribute to macro calculations.
        </p>
      </div>

      <Suspense fallback={<SpicesTableSkeleton />}>
        <SpicesTableLoader searchParams={props.searchParams} />
      </Suspense>
    </div>
  )
}
