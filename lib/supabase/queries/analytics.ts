/**
 * Analytics Query Utilities
 * Admin-only queries for retrieving analytics data
 */

import { createClient } from '@/lib/supabase/server'
import {
  AnalyticsSession,
  AnalyticsEvent,
  AnalyticsErrorLog,
  SessionDetail,
  ErrorReport,
  UserJourneyMetrics,
} from '@/lib/types/analytics'

// ============================================================================
// SESSION QUERIES
// ============================================================================

/**
 * Get sessions with filtering and pagination
 */
export async function getSessions(params: {
  limit?: number
  offset?: number
  userId?: string
  deviceType?: string
  startDate?: string
  endDate?: string
  archived?: boolean
}): Promise<{ sessions: AnalyticsSession[]; total: number }> {
  const supabase = await createClient()
  const limit = params.limit || 50
  const offset = params.offset || 0

  let query = supabase
    .from('analytics_sessions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (params.userId) {
    query = query.eq('user_id', params.userId)
  }
  if (params.deviceType) {
    query = query.eq('device_type', params.deviceType)
  }
  if (params.archived !== undefined) {
    query = query.eq('archived', params.archived)
  }
  if (params.startDate) {
    query = query.gte('created_at', params.startDate)
  }
  if (params.endDate) {
    query = query.lte('created_at', params.endDate)
  }

  const { data, count, error } = await query.range(offset, offset + limit - 1)

  if (error) {
    console.error('Failed to fetch sessions:', error)
    throw new Error(`Failed to fetch sessions: ${error.message}`)
  }

  return {
    sessions: data || [],
    total: count || 0,
  }
}

/**
 * Get detailed session with all events and errors
 */
export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const supabase = await createClient()

  // Get session
  const { data: session, error: sessionError } = await supabase
    .from('analytics_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single()

  if (sessionError) {
    console.error('Failed to fetch session detail:', sessionError)
    return null
  }

  // Get events
  const { data: events } = await supabase
    .from('analytics_events')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  // Get errors
  const { data: errors } = await supabase
    .from('analytics_error_logs')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  return {
    ...session,
    events: events || [],
    errors: errors || [],
    event_count: events?.length || 0,
    error_count: errors?.length || 0,
  } as SessionDetail
}

/**
 * Get user's sessions summary
 */
export async function getUserSessions(userId: string): Promise<AnalyticsSession[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('analytics_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch user sessions:', error)
    throw new Error(`Failed to fetch user sessions: ${error.message}`)
  }

  return data || []
}

// ============================================================================
// EVENT QUERIES
// ============================================================================

/**
 * Get events with filtering
 */
export async function getEvents(params: {
  limit?: number
  offset?: number
  sessionId?: string
  userId?: string
  eventType?: string
  eventCategory?: string
  pagePath?: string
  startDate?: string
  endDate?: string
}): Promise<{ events: AnalyticsEvent[]; total: number }> {
  const supabase = await createClient()
  const limit = params.limit || 100
  const offset = params.offset || 0

  let query = supabase
    .from('analytics_events')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (params.sessionId) query = query.eq('session_id', params.sessionId)
  if (params.userId) query = query.eq('user_id', params.userId)
  if (params.eventType) query = query.eq('event_type', params.eventType)
  if (params.eventCategory) query = query.eq('event_category', params.eventCategory)
  if (params.pagePath) query = query.eq('page_path', params.pagePath)
  if (params.startDate) query = query.gte('created_at', params.startDate)
  if (params.endDate) query = query.lte('created_at', params.endDate)

  const { data, count, error } = await query.range(offset, offset + limit - 1)

  if (error) {
    console.error('Failed to fetch events:', error)
    throw new Error(`Failed to fetch events: ${error.message}`)
  }

  return {
    events: data || [],
    total: count || 0,
  }
}

/**
 * Get events for a specific session (timeline view)
 */
export async function getSessionTimeline(sessionId: string): Promise<AnalyticsEvent[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('analytics_events')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch session timeline:', error)
    throw new Error(`Failed to fetch session timeline: ${error.message}`)
  }

  return data || []
}

/**
 * Get popular pages
 */
export async function getPopularPages(days: number = 7): Promise<Array<{ page_path: string; count: number }>> {
  const supabase = await createClient()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data, error } = await supabase
    .from('analytics_events')
    .select('page_path')
    .eq('event_type', 'page_view')
    .gte('created_at', startDate.toISOString())

  if (error) {
    console.error('Failed to fetch popular pages:', error)
    return []
  }

  // Count occurrences
  const counts: Record<string, number> = {}
  data?.forEach((event) => {
    counts[event.page_path] = (counts[event.page_path] || 0) + 1
  })

  return Object.entries(counts)
    .map(([page_path, count]) => ({ page_path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

// ============================================================================
// ERROR QUERIES
// ============================================================================

/**
 * Get error logs with filtering
 */
export async function getErrorLogs(params: {
  limit?: number
  offset?: number
  userId?: string
  sessionId?: string
  errorType?: string
  severity?: string
  isResolved?: boolean
  startDate?: string
  endDate?: string
}): Promise<{ errors: AnalyticsErrorLog[]; total: number }> {
  const supabase = await createClient()
  const limit = params.limit || 100
  const offset = params.offset || 0

  let query = supabase
    .from('analytics_error_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (params.userId) query = query.eq('user_id', params.userId)
  if (params.sessionId) query = query.eq('session_id', params.sessionId)
  if (params.errorType) query = query.eq('error_type', params.errorType)
  if (params.severity) query = query.eq('severity', params.severity)
  if (params.isResolved !== undefined) query = query.eq('is_resolved', params.isResolved)
  if (params.startDate) query = query.gte('created_at', params.startDate)
  if (params.endDate) query = query.lte('created_at', params.endDate)

  const { data, count, error } = await query.range(offset, offset + limit - 1)

  if (error) {
    console.error('Failed to fetch error logs:', error)
    throw new Error(`Failed to fetch error logs: ${error.message}`)
  }

  return {
    errors: data || [],
    total: count || 0,
  }
}

/**
 * Get error report (aggregated)
 */
export async function getErrorReport(days: number = 7): Promise<ErrorReport[]> {
  const supabase = await createClient()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data, error } = await supabase
    .from('analytics_error_logs')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch error report:', error)
    return []
  }

  // Aggregate by error type
  const reportMap: Record<string, ErrorReport> = {}

  data?.forEach((errorLog) => {
    const key = errorLog.error_type
    if (!reportMap[key]) {
      reportMap[key] = {
        error_type: errorLog.error_type,
        severity: errorLog.severity,
        count: 0,
        last_occurred: errorLog.created_at,
        first_occurred: errorLog.created_at,
        affected_users: 0,
        affected_sessions: 0,
        component_breakdown: {},
      }
    }

    reportMap[key].count += 1
    reportMap[key].last_occurred = errorLog.created_at

    if (errorLog.user_id && reportMap[key].affected_users === 0) {
      // Simple check - can be optimized with Set
      reportMap[key].affected_users += 1
    }

    if (errorLog.session_id && reportMap[key].affected_sessions === 0) {
      reportMap[key].affected_sessions += 1
    }

    if (errorLog.component) {
      reportMap[key].component_breakdown![errorLog.component] =
        (reportMap[key].component_breakdown![errorLog.component] || 0) + 1
    }
  })

  return Object.values(reportMap).sort((a, b) => b.count - a.count)
}

/**
 * Get critical errors (not resolved)
 */
export async function getCriticalErrors(): Promise<AnalyticsErrorLog[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('analytics_error_logs')
    .select('*')
    .eq('severity', 'critical')
    .eq('is_resolved', false)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Failed to fetch critical errors:', error)
    return []
  }

  return data || []
}

/**
 * Resolve error log
 */
export async function resolveError(
  errorId: string,
  resolvedBy: string,
  notes?: string
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('analytics_error_logs')
    .update({
      is_resolved: true,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
      resolution_notes: notes || null,
    })
    .eq('id', errorId)

  if (error) {
    console.error('Failed to resolve error:', error)
    throw new Error(`Failed to resolve error: ${error.message}`)
  }
}

// ============================================================================
// USER JOURNEY QUERIES
// ============================================================================

/**
 * Get user journey metrics
 */
export async function getUserJourneyMetrics(userId: string): Promise<UserJourneyMetrics | null> {
  const supabase = await createClient()

  // Get all sessions for user
  const { data: sessions, error: sessionsError } = await supabase
    .from('analytics_sessions')
    .select('*')
    .eq('user_id', userId)

  if (sessionsError) {
    console.error('Failed to fetch user journey metrics:', sessionsError)
    return null
  }

  if (!sessions || sessions.length === 0) {
    return null
  }

  // Get all events for user
  const { data: events } = await supabase
    .from('analytics_events')
    .select('*')
    .eq('user_id', userId)

  // Get all errors for user
  const { data: errors } = await supabase
    .from('analytics_error_logs')
    .select('*')
    .eq('user_id', userId)

  // Aggregate metrics
  const pagePathCounts: Record<string, number> = {}
  const featuresSet = new Set<string>()
  let totalDuration = 0

  events?.forEach((event) => {
    pagePathCounts[event.page_path] = (pagePathCounts[event.page_path] || 0) + 1
  })

  sessions.forEach((session) => {
    session.features_used?.forEach((f: string) => featuresSet.add(f))
    totalDuration += session.total_duration_seconds || 0
  })

  const avgSessionDuration = sessions.length > 0 ? totalDuration / sessions.length : 0

  // Calculate engagement score
  const engagementScore =
    Math.min(100, (events?.length || 0) * 2 + (sessions.length || 0) * 5) ||
    sessions[0]?.engagement_score ||
    0

  return {
    user_id: userId,
    total_sessions: sessions.length,
    total_events: events?.length || 0,
    total_errors: errors?.length || 0,
    avg_session_duration_seconds: Math.round(avgSessionDuration),
    most_visited_pages: Object.entries(pagePathCounts)
      .map(([page_path, count]) => ({ page_path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    features_used: Array.from(featuresSet),
    first_visit: sessions.length > 0 ? sessions[sessions.length - 1].created_at : '',
    last_visit: sessions[0]?.created_at || '',
    engagement_score: Math.round(engagementScore),
  }
}

// ============================================================================
// PAGE VIEW QUERIES
// ============================================================================

/**
 * Get page view metrics
 */
export async function getPageViewMetrics(pagePath: string, days: number = 7) {
  const supabase = await createClient()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data, error } = await supabase
    .from('analytics_page_views')
    .select('*')
    .eq('page_path', pagePath)
    .gte('event_date', startDate.toISOString().split('T')[0])
    .order('event_date', { ascending: false })

  if (error) {
    console.error('Failed to fetch page view metrics:', error)
    return []
  }

  return data || []
}

// ============================================================================
// ADMIN UTILITIES
// ============================================================================

/**
 * Check if current user is admin
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (error) return false
  return data?.role === 'admin' || data?.role === 'moderator'
}
