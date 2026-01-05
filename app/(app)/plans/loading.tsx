import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function PlansLoading() {
  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Date Navigation */}
      <Card className="bg-gradient-to-r from-lime-50 to-transparent dark:from-lime-950/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-10 w-10 rounded-md" />
            <div className="flex-1 text-center">
              <Skeleton className="h-8 w-40 mx-auto mb-2" />
              <Skeleton className="h-4 w-32 mx-auto" />
            </div>
            <Skeleton className="h-10 w-10 rounded-md" />
          </div>
        </CardContent>
      </Card>

      {/* Nutrition Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-1.5 w-full mt-2 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Meals */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-32 mt-2" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Build Button */}
      <Skeleton className="h-10 w-full" />
    </div>
  )
}
