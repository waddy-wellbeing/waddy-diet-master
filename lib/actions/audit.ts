'use server'

import { createClient } from '@/lib/supabase/server'

// =============================================================================
// Types
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'
export type LogCategory = 
  | 'auth'
  | 'user_action'
  | 'admin_action'
  | 'system'
  | 'error'
  | 'api'
  | 'database'
  | 'security'

export interface AuditLogEntry {
  level: LogLevel
  category: LogCategory
  action: string
  resourceType?: string
  resourceId?: string
  details?: Record<string, unknown>
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  errorMessage?: string
  errorStack?: string
  errorCode?: string
  requestPath?: string
  requestMethod?: string
  durationMs?: number
  tags?: string[]
}

export interface AuditLog {
  id: string
  created_at: string
  level: LogLevel
  category: LogCategory
  user_id: string | null
  user_email: string | null
  user_role: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  details: Record<string, unknown>
  error_message: string | null
  error_code: string | null
  request_path: string | null
}

// =============================================================================
// Log an audit event
// =============================================================================

export async function logAuditEvent(entry: AuditLogEntry): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = await createClient()
    
    // Get current user info if available
    const { data: { user } } = await supabase.auth.getUser()
    
    let userRole: string | null = null
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single()
      
      userRole = profile?.role ?? null
    }

    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        level: entry.level,
        category: entry.category,
        action: entry.action,
        user_id: user?.id ?? null,
        user_email: user?.email ?? null,
        user_role: userRole,
        resource_type: entry.resourceType ?? null,
        resource_id: entry.resourceId ?? null,
        details: entry.details ?? {},
        old_values: entry.oldValues ?? null,
        new_values: entry.newValues ?? null,
        error_message: entry.errorMessage ?? null,
        error_stack: entry.errorStack ?? null,
        error_code: entry.errorCode ?? null,
        request_path: entry.requestPath ?? null,
        request_method: entry.requestMethod ?? null,
        duration_ms: entry.durationMs ?? null,
        tags: entry.tags ?? null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Failed to log audit event:', error)
      return { success: false, error: error.message }
    }

    return { success: true, id: data.id }
  } catch (err) {
    console.error('Error logging audit event:', err)
    return { success: false, error: 'Failed to log audit event' }
  }
}

// =============================================================================
// Convenience functions for common log types
// =============================================================================

export async function logAdminAction(
  action: string,
  resourceType: string,
  resourceId: string,
  details?: Record<string, unknown>,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
) {
  return logAuditEvent({
    level: 'info',
    category: 'admin_action',
    action,
    resourceType,
    resourceId,
    details,
    oldValues,
    newValues,
  })
}

export async function logError(
  action: string,
  error: Error | string,
  details?: Record<string, unknown>
) {
  const errorMessage = error instanceof Error ? error.message : error
  const errorStack = error instanceof Error ? error.stack : undefined

  return logAuditEvent({
    level: 'error',
    category: 'error',
    action,
    errorMessage,
    errorStack,
    details,
  })
}

export async function logAuthEvent(
  action: 'login' | 'logout' | 'signup' | 'password_reset' | 'password_change',
  success: boolean,
  details?: Record<string, unknown>
) {
  return logAuditEvent({
    level: success ? 'info' : 'warn',
    category: 'auth',
    action: `auth.${action}`,
    details: { ...details, success },
  })
}

export async function logSecurityEvent(
  action: string,
  details?: Record<string, unknown>
) {
  return logAuditEvent({
    level: 'warn',
    category: 'security',
    action,
    details,
  })
}

// =============================================================================
// Query audit logs (admin only)
// =============================================================================

interface GetAuditLogsParams {
  page?: number
  pageSize?: number
  level?: LogLevel
  category?: LogCategory
  userId?: string
  action?: string
  resourceType?: string
  startDate?: string
  endDate?: string
}

export async function getAuditLogs({
  page = 1,
  pageSize = 50,
  level,
  category,
  userId,
  action,
  resourceType,
  startDate,
  endDate,
}: GetAuditLogsParams = {}): Promise<{
  logs: AuditLog[]
  total: number
  error: string | null
}> {
  const supabase = await createClient()
  
  // Check admin access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { logs: [], total: 0, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    return { logs: [], total: 0, error: 'Unauthorized' }
  }

  // Build query
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (level) {
    query = query.eq('level', level)
  }
  if (category) {
    query = query.eq('category', category)
  }
  if (userId) {
    query = query.eq('user_id', userId)
  }
  if (action) {
    query = query.ilike('action', `%${action}%`)
  }
  if (resourceType) {
    query = query.eq('resource_type', resourceType)
  }
  if (startDate) {
    query = query.gte('created_at', startDate)
  }
  if (endDate) {
    query = query.lte('created_at', endDate)
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    return { logs: [], total: 0, error: error.message }
  }

  return {
    logs: data ?? [],
    total: count ?? 0,
    error: null,
  }
}

// =============================================================================
// Get recent errors (for dashboard)
// =============================================================================

export async function getRecentErrors(limit = 10): Promise<{
  errors: AuditLog[]
  error: string | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .in('level', ['error', 'fatal'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return { errors: [], error: error.message }
  }

  return { errors: data ?? [], error: null }
}

// =============================================================================
// Get activity stats (for dashboard)
// =============================================================================

export async function getActivityStats(days = 7): Promise<{
  stats: {
    totalEvents: number
    errorCount: number
    uniqueUsers: number
    topActions: { action: string; count: number }[]
  }
  error: string | null
}> {
  const supabase = await createClient()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get total events
  const { count: totalEvents } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate.toISOString())

  // Get error count
  const { count: errorCount } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .in('level', ['error', 'fatal'])
    .gte('created_at', startDate.toISOString())

  // Get unique users
  const { data: uniqueUsersData } = await supabase
    .from('audit_logs')
    .select('user_id')
    .not('user_id', 'is', null)
    .gte('created_at', startDate.toISOString())

  const uniqueUsers = new Set(uniqueUsersData?.map(u => u.user_id)).size

  // Get top actions
  const { data: actionsData } = await supabase
    .from('audit_logs')
    .select('action')
    .gte('created_at', startDate.toISOString())
    .limit(1000)

  const actionCounts: Record<string, number> = {}
  actionsData?.forEach(({ action }) => {
    actionCounts[action] = (actionCounts[action] || 0) + 1
  })

  const topActions = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([action, count]) => ({ action, count }))

  return {
    stats: {
      totalEvents: totalEvents ?? 0,
      errorCount: errorCount ?? 0,
      uniqueUsers,
      topActions,
    },
    error: null,
  }
}
