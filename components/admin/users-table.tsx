'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  MoreHorizontal,
  UserCog,
  Pause,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react'
import { UserWithProfile, updatePlanStatus } from '@/lib/actions/users'
import { PlanAssignmentDialog } from './plan-assignment-dialog'
import type { PlanStatus } from '@/lib/types/nutri'
import { cn } from '@/lib/utils'

interface UsersTableProps {
  initialUsers: UserWithProfile[]
  initialCount: number
}

const statusConfig: Record<PlanStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ElementType }> = {
  pending_assignment: { label: 'Pending', variant: 'outline', icon: Clock },
  active: { label: 'Active', variant: 'default', icon: CheckCircle2 },
  paused: { label: 'Paused', variant: 'secondary', icon: Pause },
  expired: { label: 'Expired', variant: 'destructive', icon: AlertCircle },
}

export function UsersTable({ initialUsers, initialCount }: UsersTableProps) {
  const [users, setUsers] = useState<UserWithProfile[]>(initialUsers)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<PlanStatus | 'all'>('all')
  const [selectedUser, setSelectedUser] = useState<UserWithProfile | null>(null)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = search === '' || 
      user.profile?.basic_info?.name?.toLowerCase().includes(search.toLowerCase()) ||
      user.id.toLowerCase().includes(search.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || 
      user.profile?.plan_status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / pageSize)
  const paginatedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize)

  async function handleStatusChange(userId: string, newStatus: PlanStatus) {
    const result = await updatePlanStatus(userId, newStatus)
    if (result.success) {
      setUsers(prev => prev.map(u => 
        u.id === userId 
          ? { ...u, profile: u.profile ? { ...u.profile, plan_status: newStatus } : null }
          : u
      ))
    }
  }

  function handleAssignClick(user: UserWithProfile) {
    setSelectedUser(user)
    setShowAssignDialog(true)
  }

  function handleAssignSuccess(userId: string, mealCount: number) {
    setUsers(prev => prev.map(u => 
      u.id === userId 
        ? { 
            ...u, 
            profile: u.profile ? { 
              ...u.profile, 
              plan_status: 'active' as PlanStatus,
              preferences: { ...u.profile.preferences, meals_per_day: mealCount }
            } : null 
          }
        : u
    ))
    setShowAssignDialog(false)
    setSelectedUser(null)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select 
          value={statusFilter} 
          onValueChange={(v) => setStatusFilter(v as PlanStatus | 'all')}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending_assignment">Pending Assignment</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard 
          label="Total Users" 
          value={users.length} 
          icon={<UserCog className="h-4 w-4" />}
        />
        <StatCard 
          label="Pending" 
          value={users.filter(u => u.profile?.plan_status === 'pending_assignment').length}
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
        />
        <StatCard 
          label="Active" 
          value={users.filter(u => u.profile?.plan_status === 'active').length}
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
          className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
        />
        <StatCard 
          label="Paused" 
          value={users.filter(u => u.profile?.plan_status === 'paused').length}
          icon={<Pause className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>TDEE / Calories</TableHead>
              <TableHead>Meals</TableHead>
              <TableHead>Onboarding</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((user) => {
                const status = user.profile?.plan_status || 'pending_assignment'
                const config = statusConfig[status]
                const StatusIcon = config.icon

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Link 
                        href={`/admin/users/${user.id}`}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {user.profile?.name?.slice(0, 2).toUpperCase() || 
                             user.profile?.basic_info?.name?.slice(0, 2).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium hover:underline">
                            {user.profile?.name || user.profile?.basic_info?.name || 'Unnamed User'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {user.id.slice(0, 8)}...
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.profile?.targets?.daily_calories ? (
                        <div>
                          <span className="font-medium">
                            {user.profile.targets.daily_calories} cal
                          </span>
                          {user.profile.targets.tdee && (
                            <span className="text-xs text-muted-foreground ml-1">
                              (TDEE: {user.profile.targets.tdee})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.profile?.preferences?.meal_structure ? (
                        <span className="font-medium">
                          {user.profile.preferences.meal_structure.length} meals
                        </span>
                      ) : user.profile?.preferences?.meals_per_day ? (
                        <span className="text-muted-foreground">
                          {user.profile.preferences.meals_per_day} requested
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.profile?.onboarding_completed ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          Complete
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Step {user.profile?.onboarding_step || 0}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/users/${user.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAssignClick(user)}>
                            <UserCog className="h-4 w-4 mr-2" />
                            Assign Meal Plan
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {status !== 'active' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'active')}>
                              <Play className="h-4 w-4 mr-2" />
                              Set Active
                            </DropdownMenuItem>
                          )}
                          {status !== 'paused' && status === 'active' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'paused')}>
                              <Pause className="h-4 w-4 mr-2" />
                              Pause Plan
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredUsers.length)} of {filteredUsers.length}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Assignment Dialog */}
      <PlanAssignmentDialog
        user={selectedUser}
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        onSuccess={handleAssignSuccess}
      />
    </div>
  )
}

function StatCard({ 
  label, 
  value, 
  icon, 
  className 
}: { 
  label: string
  value: number
  icon: React.ReactNode
  className?: string 
}) {
  return (
    <div className={cn("rounded-lg border p-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}
