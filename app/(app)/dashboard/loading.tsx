import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-24 animate-in fade-in duration-200">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>

      {/* Week Selector Skeleton */}
      <div className="px-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="flex justify-between">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-11 w-11 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Calorie Ring Skeleton */}
      <div className="px-4 mb-6 flex justify-center">
        <Skeleton className="h-40 w-40 rounded-full" />
      </div>

      {/* Meals Section */}
      <div className="px-4">
        <Skeleton className="h-6 w-24 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="flex">
                <Skeleton className="w-24 h-24" />
                <div className="flex-1 p-3 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-7 w-20 mt-2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
