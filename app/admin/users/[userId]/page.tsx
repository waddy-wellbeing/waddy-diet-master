'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  User,
  Target,
  Heart,
  Flag,
  Calendar,
  RefreshCw,
  Save,
  Activity,
  Scale,
  Utensils,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  getUser, 
  type UserWithProfile 
} from '@/lib/actions/users'
import { 
  BasicInfoEditor,
  TargetsEditor,
  PreferencesEditor,
  GoalsEditor,
  PlanStatusEditor,
  MealStructureEditor 
} from '@/components/admin/user-editors'
import type { PlanStatus } from '@/lib/types/nutri'

const statusConfig: Record<PlanStatus, { label: string; color: string }> = {
  pending_assignment: { label: 'Pending Assignment', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  active: { label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  paused: { label: 'Paused', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.userId as string
  
  const [user, setUser] = useState<UserWithProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      setLoading(true)
      const { data, error } = await getUser(userId)
      if (error) {
        setError(error)
      } else {
        setUser(data)
      }
      setLoading(false)
    }
    loadUser()
  }, [userId])

  const handleUserUpdate = (updatedUser: UserWithProfile) => {
    setUser(updatedUser)
  }

  if (loading) {
    return <UserDetailSkeleton />
  }

  if (error || !user) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/users">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">User Not Found</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {error || 'The user could not be found.'}
          </CardContent>
        </Card>
      </div>
    )
  }

  const status = user.profile?.plan_status || 'pending_assignment'
  const statusInfo = statusConfig[status]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/users">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.profile?.avatar_url || undefined} />
            <AvatarFallback className="text-lg">
              {user.profile?.name?.slice(0, 2).toUpperCase() || 
               user.profile?.basic_info?.name?.slice(0, 2).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">
              {user.profile?.name || user.profile?.basic_info?.name || 'Unnamed User'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {user.email} • Joined {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Badge className={statusInfo.color}>
          {statusInfo.label}
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickStat 
          icon={<Activity className="h-4 w-4 text-blue-500" />}
          label="Daily Calories"
          value={user.profile?.targets?.daily_calories ? `${user.profile.targets.daily_calories} kcal` : 'Not set'}
        />
        <QuickStat 
          icon={<Scale className="h-4 w-4 text-purple-500" />}
          label="Weight"
          value={user.profile?.basic_info?.weight_kg ? `${user.profile.basic_info.weight_kg} kg` : 'Not set'}
        />
        <QuickStat 
          icon={<Utensils className="h-4 w-4 text-orange-500" />}
          label="Meals/Day"
          value={user.profile?.preferences?.meal_structure?.length || user.profile?.preferences?.meals_per_day || 'Not set'}
        />
        <QuickStat 
          icon={<Flag className="h-4 w-4 text-green-500" />}
          label="Goal"
          value={formatGoal(user.profile?.goals?.goal_type)}
        />
      </div>

      {/* Tabs for different sections */}
      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
          <TabsTrigger value="basic" className="gap-1">
            <User className="h-4 w-4 hidden sm:inline" />
            Basic
          </TabsTrigger>
          <TabsTrigger value="targets" className="gap-1">
            <Target className="h-4 w-4 hidden sm:inline" />
            Targets
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-1">
            <Heart className="h-4 w-4 hidden sm:inline" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="goals" className="gap-1">
            <Flag className="h-4 w-4 hidden sm:inline" />
            Goals
          </TabsTrigger>
          <TabsTrigger value="meals" className="gap-1">
            <Utensils className="h-4 w-4 hidden sm:inline" />
            Meals
          </TabsTrigger>
          <TabsTrigger value="status" className="gap-1">
            <Calendar className="h-4 w-4 hidden sm:inline" />
            Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <BasicInfoEditor user={user} onUpdate={handleUserUpdate} />
        </TabsContent>

        <TabsContent value="targets">
          <TargetsEditor user={user} onUpdate={handleUserUpdate} />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesEditor user={user} onUpdate={handleUserUpdate} />
        </TabsContent>

        <TabsContent value="goals">
          <GoalsEditor user={user} onUpdate={handleUserUpdate} />
        </TabsContent>

        <TabsContent value="meals">
          <MealStructureEditor user={user} onUpdate={handleUserUpdate} />
        </TabsContent>

        <TabsContent value="status">
          <PlanStatusEditor user={user} onUpdate={handleUserUpdate} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function QuickStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          {icon}
          {label}
        </div>
        <p className="text-xl font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  )
}

function formatGoal(goal?: string): string {
  if (!goal) return 'Not set'
  return goal.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function UserDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
