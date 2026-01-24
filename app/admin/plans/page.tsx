import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getRecentUsers } from "@/lib/actions/admin-plans";
import { PlansContent } from "./plans-content";

function PlansLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meal Plans</h1>
        <p className="text-muted-foreground">View and manage user meal plans</p>
      </div>

      <Card className="h-[calc(100vh-200px)]">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading meal plans...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

async function PlansData() {
  const result = await getRecentUsers(20);
  const initialUsers = result.success && result.data ? result.data : [];

  return <PlansContent initialUsers={initialUsers} />;
}

export default function AdminPlansPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meal Plans</h1>
        <p className="text-muted-foreground">View and manage user meal plans</p>
      </div>

      <Suspense fallback={<PlansLoading />}>
        <PlansData />
      </Suspense>
    </div>
  );
}
