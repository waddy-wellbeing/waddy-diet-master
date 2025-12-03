import { Skeleton } from '@/components/ui/skeleton'

export default function MealBuilderLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-24 animate-in fade-in duration-200">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <Skeleton className="h-8 w-36 mb-2" />
        <Skeleton className="h-4 w-44" />
      </div>

      {/* Meal Cards Grid */}
      <div className="px-4 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="relative aspect-[4/5] rounded-2xl overflow-hidden">
            <Skeleton className="absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 p-3 space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
