import { createClient } from '@/lib/supabase/server'

export type UserRole = 'admin' | 'moderator' | 'client'

export interface UserProfile {
  id: string
  user_id: string
  role: UserRole
  basic_info: Record<string, unknown>
  targets: Record<string, unknown>
  preferences: Record<string, unknown>
  goals: Record<string, unknown>
  onboarding_completed: boolean
  onboarding_step: number
  created_at: string
  updated_at: string
}

export interface AuthUser {
  id: string
  email: string | undefined
  profile: UserProfile | null
}

/**
 * Get the current authenticated user with their profile.
 * For use in Server Components and Server Actions.
 */
export async function getUser(): Promise<AuthUser | null> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return {
    id: user.id,
    email: user.email,
    profile: profile as UserProfile | null,
  }
}

/**
 * Check if the current user has admin access (admin or moderator role).
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getUser()
  if (!user?.profile) return false
  return user.profile.role === 'admin' || user.profile.role === 'moderator'
}

/**
 * Check if the current user has the specified role.
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const user = await getUser()
  if (!user?.profile) return false
  return user.profile.role === role
}

/**
 * Require authentication. Throws an error if not authenticated.
 * Use in Server Actions that require auth.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getUser()
  if (!user) {
    throw new Error('Authentication required')
  }
  return user
}

/**
 * Require admin access. Throws an error if not admin/moderator.
 * Use in Server Actions that require admin access.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth()
  if (!user.profile || (user.profile.role !== 'admin' && user.profile.role !== 'moderator')) {
    throw new Error('Admin access required')
  }
  return user
}
